import React from 'react';
import { ProductDomain, DOMAIN_METADATA, DomainMetadata } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface TopMenuProps {
  currentDomain: ProductDomain;
  setCurrentDomain: (domain: ProductDomain) => void;
}

const TopMenu: React.FC<TopMenuProps> = ({ currentDomain, setCurrentDomain }) => {
  const { currentUser } = useAuth();

  // Get user's allowed domains (default to all if not specified)
  const allowedDomains: ProductDomain[] = currentUser?.allowedDomains || [
    'dashboard',
    'admin',
    'fx',
    'emobility',
    'fintech'
  ];

  // Filter domains based on user access
  const accessibleDomains = Object.values(DOMAIN_METADATA).filter(domain =>
    allowedDomains.includes(domain.id)
  );

  const handleDomainClick = (domain: ProductDomain) => {
    // SECURITY: Verify user has access before switching
    if (allowedDomains.includes(domain)) {
      setCurrentDomain(domain);
    } else {
      console.warn(`Access denied to domain: ${domain}`);
      alert('You do not have permission to access this domain.');
    }
  };

  const getDomainButtonClasses = (domain: DomainMetadata) => {
    const isActive = currentDomain === domain.id;
    const baseClasses = 'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg';
    
    if (isActive) {
      const colorClasses = {
        blue: 'bg-blue-600 text-white shadow-md',
        gray: 'bg-gray-600 text-white shadow-md',
        green: 'bg-green-600 text-white shadow-md',
        yellow: 'bg-yellow-500 text-gray-900 shadow-md',
        purple: 'bg-purple-600 text-white shadow-md'
      };
      return `${baseClasses} ${colorClasses[domain.color as keyof typeof colorClasses]}`;
    }
    
    return `${baseClasses} bg-white text-gray-700 hover:bg-gray-100 border border-gray-300`;
  };

  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-300 shadow-sm">
      <div className="max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-2 py-3 overflow-x-auto">
          {accessibleDomains.map((domain) => (
            <button
              key={domain.id}
              onClick={() => handleDomainClick(domain.id)}
              className={getDomainButtonClasses(domain)}
              title={domain.description}
              aria-label={`Switch to ${domain.label}`}
            >
              <span className="text-lg" role="img" aria-label={domain.label}>
                {domain.icon}
              </span>
              <span className="whitespace-nowrap">{domain.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Domain description bar - shown for non-dashboard domains */}
      {currentDomain !== 'dashboard' && (
        <div className="bg-white border-t border-gray-200 px-4 sm:px-6 lg:px-8 py-2">
          <p className="text-sm text-gray-600">
            {DOMAIN_METADATA[currentDomain].description}
          </p>
        </div>
      )}
    </div>
  );
};

export default TopMenu;
