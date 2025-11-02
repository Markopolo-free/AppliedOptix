import React, { useState } from 'react';

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
    errorColor: '#ef4444'
  },
  colorPalette: [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ]
};

const ThemeConfigurator: React.FC = () => {
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);
  const [activeColor, setActiveColor] = useState<keyof ThemeConfig['branding']>('primaryColor');

  const updateColor = (key: keyof ThemeConfig['branding'], value: string) => {
    setTheme({
      ...theme,
      branding: { ...theme.branding, [key]: value }
    });
  };

  const updateClientName = (name: string) => {
    setTheme({ ...theme, clientName: name });
  };

  const updateSiteName = (name: string) => {
    setTheme({
      ...theme,
      branding: { ...theme.branding, siteName: name }
    });
  };

  const exportTheme = () => {
    const json = JSON.stringify(theme, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.clientName.toLowerCase()}.json`;
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

            {/* Client Info */}
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Client Info</h2>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
                  <input
                    type="text"
                    value={theme.branding.siteName}
                    onChange={(e) => updateSiteName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
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

            {/* Export */}
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Export Theme</h2>
              <button
                onClick={exportTheme}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                💾 Download {theme.clientName}.json
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
