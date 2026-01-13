import React, { useState } from 'react';
import { ProductDomain, View } from '../types';
import { DOMAIN_MENU_CONFIG, AVAILABLE_VIEWS } from '../DomainMenuConfig';

/**
 * Domain Menu Builder
 * 
 * Visual tool for customizing which features appear in each domain.
 * Use this for quick demo configuration without editing code files.
 * 
 * IMPORTANT: Changes made here are temporary (in-memory only).
 * To persist changes, copy the generated configuration to DomainMenuConfig.ts
 */

const DomainMenuBuilder: React.FC = () => {
  const [config, setConfig] = useState(DOMAIN_MENU_CONFIG);
  const [selectedDomain, setSelectedDomain] = useState<ProductDomain>('fintech');
  const [showCode, setShowCode] = useState(false);

  const currentConfig = config[selectedDomain];
  const availableViewsArray = Object.entries(AVAILABLE_VIEWS) as [View, string][];

  const isViewSelected = (view: View): boolean => {
    return currentConfig.views.includes(view);
  };

  const toggleView = (view: View) => {
    setConfig(prev => ({
      ...prev,
      [selectedDomain]: {
        ...prev[selectedDomain],
        views: isViewSelected(view)
          ? prev[selectedDomain].views.filter(v => v !== view)
          : [...prev[selectedDomain].views, view]
      }
    }));
  };

  const moveViewUp = (view: View) => {
    const views = [...currentConfig.views];
    const index = views.indexOf(view);
    if (index > 0) {
      [views[index - 1], views[index]] = [views[index], views[index - 1]];
      setConfig(prev => ({
        ...prev,
        [selectedDomain]: { ...prev[selectedDomain], views }
      }));
    }
  };

  const moveViewDown = (view: View) => {
    const views = [...currentConfig.views];
    const index = views.indexOf(view);
    if (index < views.length - 1) {
      [views[index], views[index + 1]] = [views[index + 1], views[index]];
      setConfig(prev => ({
        ...prev,
        [selectedDomain]: { ...prev[selectedDomain], views }
      }));
    }
  };

  const generateCode = (): string => {
    return `// Copy this to DomainMenuConfig.ts
${selectedDomain}: {
  label: '${currentConfig.label}',
  icon: '${currentConfig.icon}',
  description: '${currentConfig.description}',
  color: '${currentConfig.color}',
  views: [
${currentConfig.views.map(v => `    '${v}',`).join('\n')}
  ]
},`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateCode());
    alert('Configuration copied to clipboard! Paste it into DomainMenuConfig.ts');
  };

  const getViewDescription = (view: View): string => {
    return AVAILABLE_VIEWS[view as keyof typeof AVAILABLE_VIEWS] || view;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Domain Menu Builder</h1>
        <p className="text-gray-600">
          Customize which features appear in each domain for customer demonstrations.
          Changes here are temporary - copy the configuration to save permanently.
        </p>
      </div>

      {/* Domain Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Domain to Configure:
        </label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(config) as ProductDomain[]).map(domain => (
            <button
              key={domain}
              onClick={() => setSelectedDomain(domain)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedDomain === domain
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {config[domain].icon} {config[domain].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Configuration */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {currentConfig.icon} {currentConfig.label}
            </h2>
            <span className="text-sm text-gray-500">
              {currentConfig.views.length} features
            </span>
          </div>

          <div className="space-y-2 mb-4">
            {currentConfig.views.map((view, index) => (
              <div
                key={view}
                className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{view}</div>
                  <div className="text-sm text-gray-600">{getViewDescription(view)}</div>
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => moveViewUp(view)}
                    disabled={index === 0}
                    className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-30"
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveViewDown(view)}
                    disabled={index === currentConfig.views.length - 1}
                    className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-30"
                    title="Move down"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => toggleView(view)}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Available Features */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Available Features
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Click to add features to {currentConfig.label}
          </p>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {availableViewsArray.map(([view, description]) => {
              const isSelected = isViewSelected(view);
              return (
                <button
                  key={view}
                  onClick={() => toggleView(view)}
                  disabled={isSelected}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <div className="font-medium text-gray-800">{view}</div>
                  <div className="text-sm text-gray-600">{description}</div>
                  {isSelected && (
                    <div className="text-xs text-green-600 mt-1">✓ Already added</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Export Configuration */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            💾 Save Configuration
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCode(!showCode)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              {showCode ? 'Hide' : 'Show'} Code
            </button>
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              📋 Copy to Clipboard
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-700 mb-2">
          <strong>To make these changes permanent:</strong>
        </p>
        <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1 mb-4">
          <li>Click "Copy to Clipboard" above</li>
          <li>Open <code className="bg-gray-200 px-1 rounded">DomainMenuConfig.ts</code></li>
          <li>Find the <code className="bg-gray-200 px-1 rounded">{selectedDomain}</code> section</li>
          <li>Replace it with the copied configuration</li>
          <li>Save the file - changes apply immediately!</li>
        </ol>

        {showCode && (
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
            {generateCode()}
          </pre>
        )}
      </div>
    </div>
  );
};

export default DomainMenuBuilder;
