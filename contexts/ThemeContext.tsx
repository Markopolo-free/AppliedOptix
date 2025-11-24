import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../services/firebase';

// ThemeConfig remains the same
interface ThemeConfig {
  clientName: string;
  themeName: string;
  branding: {
    logo: string;
    siteName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textPrimary: string;
    textSecondary: string;
    successColor: string;
    errorColor: string;
    fontFamily?: string;
  };
  colorPalette: string[];
}

// ThemeLibrary: multiple named themes per client
interface ThemeLibrary {
  clientName: string;
  themes: ThemeConfig[];
}

const defaultTheme: ThemeConfig = {
  clientName: 'AppliedOptix',
  themeName: 'Default',
  branding: {
    logo: '/logo.jpg',
    siteName: 'Staff Portal',
    primaryColor: '#3b82f6',
    secondaryColor: '#2563eb',
    accentColor: '#60a5fa',
    backgroundColor: '#f8fafc',
    textPrimary: '#1f2937',
    textSecondary: '#6b7280',
    successColor: '#10b981',
    errorColor: '#ef4444',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  colorPalette: [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ]
};

const defaultLibrary: ThemeLibrary = {
  clientName: 'AppliedOptix',
  themes: [defaultTheme]
};

interface ThemeContextType {
  themeLibrary: ThemeLibrary;
  activeTheme: ThemeConfig;
  setActiveTheme: (themeName: string) => void;
  updateTheme: (theme: ThemeConfig) => Promise<void>;
  resetTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeLibrary, setThemeLibrary] = useState<ThemeLibrary>(defaultLibrary);
  const [activeTheme, setActiveThemeState] = useState<ThemeConfig>(defaultTheme);

  // Load theme library from Firebase on mount
  useEffect(() => {
    const themeRef = ref(db, 'themeLibrary');
    const unsubscribe = onValue(themeRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.themes) {
        setThemeLibrary(data);
        // Restore theme from localStorage if available
        const savedThemeName = localStorage.getItem('selectedThemeName');
        const found = savedThemeName ? data.themes.find((t: any) => t.themeName === savedThemeName) : null;
        if (found) {
          setActiveThemeState(found);
          applyThemeToDOM(found);
        } else {
          setActiveThemeState(data.themes[0] || defaultTheme);
          applyThemeToDOM(data.themes[0] || defaultTheme);
        }
      } else {
        setThemeLibrary(defaultLibrary);
        setActiveThemeState(defaultTheme);
        applyThemeToDOM(defaultTheme);
      }
    });
    return () => unsubscribe();
  }, []);

  const applyThemeToDOM = (themeConfig: ThemeConfig) => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', themeConfig.branding.primaryColor);
    root.style.setProperty('--secondary-color', themeConfig.branding.secondaryColor);
    root.style.setProperty('--accent-color', themeConfig.branding.accentColor);
    root.style.setProperty('--background-color', themeConfig.branding.backgroundColor);
    root.style.setProperty('--text-primary', themeConfig.branding.textPrimary);
    root.style.setProperty('--text-secondary', themeConfig.branding.textSecondary);
    root.style.setProperty('--success-color', themeConfig.branding.successColor);
    root.style.setProperty('--error-color', themeConfig.branding.errorColor);
    if (themeConfig.branding.fontFamily) {
      root.style.setProperty('--app-font-family', themeConfig.branding.fontFamily);
      document.body.style.setProperty('font-family', themeConfig.branding.fontFamily, 'important');
    }
    document.title = themeConfig.branding.siteName;
  };

  const setActiveTheme = (themeName: string) => {
    const found = themeLibrary.themes.find(t => t.themeName === themeName);
    if (found) {
      setActiveThemeState(found);
      applyThemeToDOM(found);
      localStorage.setItem('selectedThemeName', themeName);
    }
  };

  const updateTheme = async (newTheme: ThemeConfig) => {
    try {
      // Replace or add theme in library
      let updatedThemes = themeLibrary.themes.filter(t => t.themeName !== newTheme.themeName);
      updatedThemes.push(newTheme);
      const updatedLibrary = { ...themeLibrary, themes: updatedThemes };
      const themeRef = ref(db, 'themeLibrary');
      await set(themeRef, updatedLibrary);
      setThemeLibrary(updatedLibrary);
      setActiveThemeState(newTheme);
      applyThemeToDOM(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
      throw error;
    }
  };

  const resetTheme = async () => {
    try {
      const themeRef = ref(db, 'themeLibrary');
      await set(themeRef, defaultLibrary);
      setThemeLibrary(defaultLibrary);
      setActiveThemeState(defaultTheme);
      applyThemeToDOM(defaultTheme);
    } catch (error) {
      console.error('Error resetting theme:', error);
      throw error;
    }
  };

  return (
    <ThemeContext.Provider value={{ themeLibrary, activeTheme, setActiveTheme, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export type { ThemeConfig, ThemeLibrary };
export { defaultTheme, defaultLibrary };
