import Modal from 'react-modal';
import React, { useState, useEffect } from 'react';
import { useTheme, ThemeConfig, defaultTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../services/auditService';

const ThemeConfigurator: React.FC = () => {
  const { themeLibrary, activeTheme, setActiveTheme, updateTheme, resetTheme } = useTheme();
  const { currentUser } = useAuth();
  const [theme, setTheme] = useState<ThemeConfig>(activeTheme);
  const [themeName, setThemeName] = useState<string>(activeTheme.themeName || '');
  const [activeColor, setActiveColor] = useState<keyof ThemeConfig['branding']>('primaryColor');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  // Sync with current theme from context
  useEffect(() => {
    setTheme(activeTheme);
    setThemeName(activeTheme.themeName || '');
  }, [activeTheme]);

  const updateColor = (key: keyof ThemeConfig['branding'], value: string) => {
    setTheme({
      ...theme,
      branding: { ...theme.branding, [key]: value }
    });
    setHasChanges(true);
  };

  const updateClientName = (name: string) => {
    setTheme({ ...theme, clientName: name });
    setHasChanges(true);
  };

  const updateThemeName = (name: string) => {
    setTheme({ ...theme, themeName: name });
    setThemeName(name);
    setHasChanges(true);
  };

  const updateSiteName = (name: string) => {
    setTheme({
      ...theme,
      branding: { ...theme.branding, siteName: name }
    });
    setHasChanges(true);
  };

  const saveTheme = async () => {
    if (!themeName.trim()) {
      setShowNameModal(true);
      setPendingSave(true);
      return;
    }
    setIsSaving(true);
    try {
      await updateTheme({ ...theme, themeName });
      setHasChanges(false);
      if (currentUser) {
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'update',
          entityType: 'reference',
          entityId: 'theme',
          entityName: `Theme: ${themeName}`
        });
      }
      alert('Theme saved successfully!');
    } catch (error) {
      console.error('Error saving theme:', error);
      alert('Failed to save theme. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameModalSave = () => {
    setShowNameModal(false);
    if (pendingSave && themeName.trim()) {
      setPendingSave(false);
      saveTheme();
    }
  };

  const handleResetTheme = async () => {
    if (!window.confirm('Are you sure you want to reset to the default theme? This cannot be undone.')) {
      return;
    }
    
    setIsSaving(true);
    try {
      await resetTheme();
      setHasChanges(false);
      
      // Log audit
      if (currentUser) {
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'delete',
          entityType: 'reference',
          entityId: 'theme',
          entityName: 'Application Theme (Reset to Default)'
        });
      }
      
      alert('Theme reset to default!');
    } catch (error) {
      console.error('Error resetting theme:', error);
      alert('Failed to reset theme. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const exportTheme = () => {
    const json = JSON.stringify({ ...theme, themeName }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.clientName.toLowerCase()}-${themeName.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadPreset = (presetName: string) => {
    if (presetName === 'greentransit') {
      setTheme({
        clientName: 'GreenTransit',
        branding: {
          logo: '/logos/greentransit.jpg',
          siteName: 'GreenTransit Portal',
          primaryColor: '#10b981',
          secondaryColor: '#059669',
          accentColor: '#34d399',
          backgroundColor: '#f0fdf4',
          textPrimary: '#064e3b',
          textSecondary: '#047857',
          successColor: '#10b981',
          errorColor: '#dc2626'
        },
        colorPalette: defaultTheme.colorPalette
      });
    } else {
      setTheme(defaultTheme);
    }
    setHasChanges(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Theme Configurator</h1>
        <p className="text-gray-600 mb-8">Customize colors, branding, and export a theme JSON for site cloning</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel: Configuration */}
          <div className="space-y-6">
            {/* Presets */}
            <Modal
              isOpen={showNameModal}
              onRequestClose={() => setShowNameModal(false)}
              contentLabel="Enter Theme Name"
              ariaHideApp={false}
              style={{ content: { maxWidth: '400px', margin: 'auto', padding: '2em' } }}
            >
              <h2 className="text-xl font-semibold mb-4">Enter Theme Name</h2>
              <input
                type="text"
                value={themeName}
                onChange={e => setThemeName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 mb-4"
                placeholder="Theme Name"
              />
              <button
                onClick={handleNameModalSave}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                disabled={!themeName.trim()}
              >
                Save Theme
              </button>
            </Modal>
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Presets</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => loadPreset('default')}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Default
                </button>
                <button
                  onClick={() => loadPreset('greentransit')}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  GreenTransit
                </button>
              </div>
            </div>

            {/* Client Info & Theme Name */}
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Client & Theme Info</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client Name</label>
                  <input
                    type="text"
                    value={theme.clientName}
                    onChange={(e) => updateClientName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Theme Name</label>
                  <div className="flex gap-2">
                    <select
                      value={themeLibrary.themes.some(t => t.themeName === themeName) ? themeName : ''}
                      onChange={e => {
                        const selected = e.target.value;
                        if (selected) {
                          updateThemeName(selected);
                          const found = themeLibrary.themes.find(t => t.themeName === selected);
                          if (found) {
                            setTheme(found);
                            if (setActiveTheme) setActiveTheme(selected);
                          }
                        } else {
                          setThemeName('');
                          updateThemeName('');
                        }
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      style={{ minWidth: '160px' }}
                    >
                      <option value="">(New Theme Name)</option>
                      {themeLibrary.themes.map((t, idx) => (
                        <option key={t.themeName} value={t.themeName}>{t.themeName}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={themeName}
                      onChange={e => updateThemeName(e.target.value)}
                      placeholder="Enter theme name"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Select an existing theme or enter a new name.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
                  <input
                    type="text"
                    value={theme.branding.siteName}
                    onChange={(e) => updateSiteName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font Family
                    <span className="ml-2 text-xs text-blue-600">(Changes apply immediately)</span>
                  </label>
                  <select
                    value={theme.branding.fontFamily || 'system-ui, -apple-system, sans-serif'}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      console.log('🎨 Changing font from:', theme.branding.fontFamily, 'to:', newFont);
                      setTheme({
                        ...theme,
                        branding: { ...theme.branding, fontFamily: newFont }
                      });
                      setHasChanges(true);
                      // Apply font immediately for preview with !important
                      document.documentElement.style.setProperty('--app-font-family', newFont);
                      document.body.style.setProperty('font-family', newFont, 'important');
                      console.log('✅ Font applied to body. Current body font:', window.getComputedStyle(document.body).fontFamily);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    style={{ fontFamily: theme.branding.fontFamily || 'system-ui, -apple-system, sans-serif' }}
                  >
                    <option value="system-ui, -apple-system, sans-serif" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>System Default</option>
                    <option value="'Inter', sans-serif" style={{ fontFamily: "'Inter', sans-serif" }}>Inter (Modern)</option>
                    <option value="'Roboto', sans-serif" style={{ fontFamily: "'Roboto', sans-serif" }}>Roboto (Google)</option>
                    <option value="'Open Sans', sans-serif" style={{ fontFamily: "'Open Sans', sans-serif" }}>Open Sans</option>
                    <option value="'Lato', sans-serif" style={{ fontFamily: "'Lato', sans-serif" }}>Lato</option>
                    <option value="'Montserrat', sans-serif" style={{ fontFamily: "'Montserrat', sans-serif" }}>Montserrat</option>
                    <option value="'Poppins', sans-serif" style={{ fontFamily: "'Poppins', sans-serif" }}>Poppins</option>
                    <option value="'Source Sans Pro', sans-serif" style={{ fontFamily: "'Source Sans Pro', sans-serif" }}>Source Sans Pro</option>
                    <option value="'Caveat', cursive" style={{ fontFamily: "'Caveat', cursive" }}>Caveat (Handwriting)</option>
                    <option value="Georgia, serif" style={{ fontFamily: 'Georgia, serif' }}>Georgia (Serif)</option>
                    <option value="'Times New Roman', serif" style={{ fontFamily: "'Times New Roman', serif" }}>Times New Roman</option>
                    <option value="'Courier New', monospace" style={{ fontFamily: "'Courier New', monospace" }}>Courier New (Mono)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Note: Some fonts may require Google Fonts to be loaded</p>
                </div>
              </div>
            </div>

            {/* Color Palette */}
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Color Palette</h2>
              <div className="grid grid-cols-5 gap-3 mb-6">
                {theme.colorPalette.map((color, idx) => (
                  <button
                    key={idx}
                    onClick={() => updateColor(activeColor, color)}
                    className="h-12 rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-colors"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>

              <div className="space-y-3">
                {Object.entries(theme.branding).filter(([key]) => key.includes('Color')).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={value as string}
                      onChange={(e) => updateColor(key as keyof ThemeConfig['branding'], e.target.value)}
                      onFocus={() => setActiveColor(key as keyof ThemeConfig['branding'])}
                      className="w-12 h-12 rounded cursor-pointer border-2 border-gray-300"
                    />
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                      </label>
                      <input
                        type="text"
                        value={value as string}
                        onChange={(e) => updateColor(key as keyof ThemeConfig['branding'], e.target.value)}
                        className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Theme */}
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Apply Theme</h2>
              <div className="space-y-3">
                <button
                  onClick={saveTheme}
                  disabled={!hasChanges || isSaving}
                  className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
                    hasChanges && !isSaving
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? '💾 Saving...' : hasChanges ? '💾 Save & Apply Theme' : '✓ Theme Saved'}
                </button>
                <button
                  onClick={handleResetTheme}
                  disabled={isSaving}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  🔄 Reset to Default
                </button>
              </div>
              {hasChanges && (
                <p className="mt-3 text-sm text-amber-600 font-medium">
                  ⚠️ You have unsaved changes
                </p>
              )}
            </div>

            {/* Export */}
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Export Theme</h2>
              <button
                onClick={exportTheme}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                � Download {theme.clientName}.json
              </button>
              <p className="mt-3 text-sm text-gray-600">
                Use with: <code className="bg-gray-100 px-2 py-1 rounded">node scripts/clone-site.js {theme.clientName.toLowerCase()}</code>
              </p>
            </div>
          </div>

          {/* Right Panel: Live Preview */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Live Preview</h2>
            <div
              className="border-4 rounded-xl p-8"
              style={{
                borderColor: theme.branding.primaryColor,
                backgroundColor: theme.branding.backgroundColor
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="h-16 w-16 rounded-lg flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: theme.branding.primaryColor }}
                >
                  {theme.clientName.charAt(0)}
                </div>
                <h1 className="text-3xl font-bold" style={{ color: theme.branding.textPrimary }}>
                  {theme.branding.siteName}
                </h1>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {['Total Users', 'Revenue', 'Active', 'Trips'].map((label, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border-2"
                    style={{
                      borderColor: theme.branding.secondaryColor,
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <h3 className="text-sm font-medium" style={{ color: theme.branding.textSecondary }}>
                      {label}
                    </h3>
                    <p className="mt-2 text-2xl font-bold" style={{ color: theme.branding.textPrimary }}>
                      {idx === 1 ? '€12,540' : '1,234'}
                    </p>
                  </div>
                ))}
              </div>

              <button
                className="mt-6 w-full py-3 rounded-lg text-white font-semibold"
                style={{ backgroundColor: theme.branding.primaryColor }}
              >
                Primary Button
              </button>

              <button
                className="mt-3 w-full py-3 rounded-lg text-white font-semibold"
                style={{ backgroundColor: theme.branding.successColor }}
              >
                Success Action
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeConfigurator;
