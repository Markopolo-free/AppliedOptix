import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../services/firebase';

interface ThemeConfig {
  clientName: string;
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

const defaultTheme: ThemeConfig = {
  clientName: 'AppliedOptix',
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

interface ThemeContextType {
  theme: ThemeConfig;
  updateTheme: (theme: ThemeConfig) => Promise<void>;
  resetTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);

  // Load theme from Firebase on mount
  useEffect(() => {
    const themeRef = ref(db, 'theme');
    const unsubscribe = onValue(themeRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTheme(data);
        applyThemeToDOM(data);
      } else {
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
    
    // Apply font family with !important to override Tailwind
    if (themeConfig.branding.fontFamily) {
      // Set a CSS variable so all elements (including those with Tailwind font utilities) can consume it
      root.style.setProperty('--app-font-family', themeConfig.branding.fontFamily);
      document.body.style.setProperty('font-family', themeConfig.branding.fontFamily, 'important');
      console.log('Applied font from theme:', themeConfig.branding.fontFamily);
    }
    
    // Update document title
    document.title = themeConfig.branding.siteName;
  };

  const updateTheme = async (newTheme: ThemeConfig) => {
    try {
      const themeRef = ref(db, 'theme');
      await set(themeRef, newTheme);
      setTheme(newTheme);
      applyThemeToDOM(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
      throw error;
    }
  };

  const resetTheme = async () => {
    try {
      const themeRef = ref(db, 'theme');
      await set(themeRef, defaultTheme);
      setTheme(defaultTheme);
      applyThemeToDOM(defaultTheme);
    } catch (error) {
      console.error('Error resetting theme:', error);
      throw error;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme }}>
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

export type { ThemeConfig };
export { defaultTheme };
