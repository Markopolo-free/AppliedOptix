// ...existing code from the remote HEAD version preserved...
// ...existing code from the remote HEAD version preserved...
import React from 'react';
import { View } from '../types';
import { DashboardIcon, UsersIcon, PricingIcon, CampaignIcon, LoyaltyIcon, CloseIcon, ZoneIcon, ServiceIcon, FXCampaignIcon, FXDiscountIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../services/auditService';
import { getTenantConfig } from '../TenantFeatureConfig';

// View type now imported from types.ts

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
}

const NavLink: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <a
    href="#"
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    className={`flex items-center px-4 py-3 text-sm font-medium transition-colors duration-200 transform rounded-lg ${
      isActive
        ? 'bg-primary-600 text-white'
        : 'text-gray-200 hover:bg-gray-700 hover:text-white'
    }`}
  >
    {icon}
    <span className="mx-4">{label}</span>
  </a>
);

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isSidebarOpen, setSidebarOpen }) => {

  const { currentUser, logout, effectiveTenantId, getTenantAllowedViews } = useAuth();
  const [featuresOpen, setFeaturesOpen] = React.useState(false);
  
  // Get features allowed for the current effective tenant
  const allowedViews = getTenantAllowedViews();
  
  // Get tenant configuration for display (with fallback for uninitialized state)
  const tenantConfig = getTenantConfig(effectiveTenantId) || { label: effectiveTenantId, views: [] };

  // Back button handler for sub-menu
  const handleBackToMainMenu = () => {
    setFeaturesOpen(false);
  };

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
    // Only close featuresOpen if not in features overlay
    // If featuresOpen is true, persist the sub-menu
  };

  const handleLogout = async () => {
    if (currentUser) {
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'logout',
        entityType: 'auth',
        metadata: { timestamp: new Date().toISOString() }
      });
    }
    logout();
    window.location.reload();
  };

  const navItems = [
    { view: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { view: 'users', label: 'User Management', icon: <UsersIcon /> },
    { view: 'fxmarginbuilder', label: 'FX Margin Builder', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> },
    { view: 'services', label: 'Service Management', icon: <ServiceIcon /> },
    { view: 'pricing', label: 'Pricing Rules', icon: <PricingIcon /> },
    { view: 'zones', label: 'Pricing Zones', icon: <ZoneIcon /> },
    { view: 'campaigns', label: 'Campaigns', icon: <CampaignIcon /> },
    { view: 'loyalty', label: 'Loyalty Programs', icon: <LoyaltyIcon /> },
    { view: 'bundledpricing', label: 'Bundled Pricing', icon: <PricingIcon /> },
    { view: 'companyDetails', label: '🏢 Company Details', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M3 7V5a2 2 0 012-2h14a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2" fill="none"/></svg> },
    { view: 'discountgroups', label: '🎫 User Discount Groups', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> },
      {
        view: 'reference',
        label: '📚 Reference Data',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>,
      },
    { view: 'dataextract', label: '🗃️ Data Extraction', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M3 7V5a2 2 0 012-2h14a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2" fill="none"/></svg> },
  ] as const;

  // Submenu items for Additional Features
  const featuresItems = [
    { view: 'theme', label: '🎨 Theme Builder', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> },
    { view: 'audit', label: '📊 Audit Log', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg> },
    { view: 'mgmNotifications', label: '📣 MGM Notifications', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg> },
    { view: 'referralCodes', label: '🎁 Referral Codes', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path></svg> },
    { view: 'pushTestAdmin', label: '🔔 Push Test Admin', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 18.5a6.5 6.5 0 116.5-6.5 6.5 6.5 0 01-6.5 6.5z"/></svg> },
    {
      view: 'simulation',
      label: '🧮 Simulation',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M8 8h8M8 12h8M8 16h8" stroke="currentColor" strokeWidth="2" fill="none"/></svg>,
      children: [
        { view: 'customerManager', label: 'Customers', icon: <UsersIcon /> },
        { view: 'customerActivityManager', label: 'Customer Activities', icon: <ServiceIcon /> },
        { view: 'calculatorService', label: 'Pricing Calculator', icon: <PricingIcon /> },
        { view: 'campaignsReport', label: 'Campaigns Report', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M3 7V5a2 2 0 012-2h14a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2" fill="none"/></svg> },
      ]
    },
    { view: 'fxcampaigns', label: 'FX Campaigns', icon: <FXCampaignIcon /> },
    { view: 'fxdiscountoptions', label: 'FX Discount Groups', icon: <FXDiscountIcon /> },
    { view: 'fxpricing', label: 'FX Pricing', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> },
    { view: 'tokenListAdmin', label: '🔑 Token List', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 11-4 0 2 2 0 014 0zM12 9v10m0 0l-3-3m3 3l3-3"></path></svg> },
    { view: 'fxmarginbuilder', label: 'FX Margin Builder', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 01-8 0M12 3v4m0 0v4m0-4h4m-4 0H8m8 8a4 4 0 01-8 0m4-4v4m0 0v4m0-4h4m-4 0H8"></path></svg> },
  ] as const;

  // TENANT FILTERING: Filter nav items based on current tenant
  const getVisibleNavItems = () => {
    return navItems.filter(item => allowedViews.includes(item.view as View));
  };

  const getVisibleFeatureItems = () => {
    return featuresItems.filter(item => {
      // Check if main item or any children are in allowed views
      if (allowedViews.includes(item.view as View)) return true;
      if ('children' in item && item.children) {
        return item.children.some(child => allowedViews.includes(child.view as View));
      }
      return false;
    });
  };

  const visibleNavItems = getVisibleNavItems();
  const visibleFeatureItems = getVisibleFeatureItems();

  return (
    <div>
      <div className={`fixed inset-y-0 left-0 z-30 w-64 px-4 py-5 bg-gray-800 transition-transform duration-300 ease-in-out transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'}}>
        {/* Sidebar header always visible */}
        <div className="flex items-center justify-between mb-8 flex-shrink-0">
          <div className="flex flex-col w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Adaptive Optix logo removed */}
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 lg:hidden">
                <CloseIcon />
              </button>
            </div>
            <div className="mt-2 ml-2 text-sm font-medium text-primary-300">
              {tenantConfig.label}
            </div>
          </div>
        </div>

        {/* Overlay sub-menu when featuresOpen is true */}
        {featuresOpen && (
          <div className="absolute inset-0 bg-gray-900 z-40 flex flex-col pt-16 px-4 overflow-y-auto">
            <div className="mb-2 flex-shrink-0">
              <div className="mb-2">
                {/* Adaptive Optix logo removed */}
              </div>
              <div className="text-sm font-medium text-primary-300">
                {tenantConfig.label}
              </div>
            </div>
            <button
              className="flex items-center text-yellow-300 mb-6 text-sm font-medium hover:text-yellow-400 focus:outline-none flex-shrink-0"
              onClick={handleBackToMainMenu}
            >
              <svg className="w-5 h-5 mr-2 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <div className="space-y-1 flex-1 overflow-y-auto">
              {visibleFeatureItems.map(item => (
                'children' in item && item.children ? (
                  <div key={item.view}>
                    <NavLink
                      icon={item.icon}
                      label={item.label}
                      isActive={currentView === item.view || item.children.some(child => currentView === child.view)}
                      onClick={() => handleNavClick(item.view as View)}
                    />
                    {/* Show children if Simulation or one of its children is active */}
                    {(currentView === item.view || item.children.some(child => currentView === child.view)) && (
                      <div className="ml-6 mt-2 space-y-1">
                        {item.children.map(child => (
                          <NavLink
                            key={child.view}
                            icon={child.icon}
                            label={child.label}
                            isActive={currentView === child.view}
                            onClick={() => handleNavClick(child.view as View)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <NavLink
                    key={item.view}
                    icon={item.icon}
                    label={item.label}
                    isActive={currentView === item.view}
                    onClick={() => handleNavClick(item.view as View)}
                  />
                )
              ))}
            </div>
          </div>
        )}

        {/* Main nav - only show when overlay is closed */}
        {!featuresOpen && (
          <nav className="mt-2 flex-1 overflow-y-auto space-y-1">
            {/* Main nav items with submenu support */}
            {visibleNavItems.map(item => (
              <NavLink
                key={item.view}
                icon={item.icon}
                label={item.label}
                isActive={currentView === item.view}
                onClick={() => handleNavClick(item.view as View)}
              />
            ))}

            {/* Collapsible Additional Features - only show if there are items to display */}
            {visibleFeatureItems.length > 0 && (
              <div className="mt-6">
                <button
                  className="flex items-center w-full px-4 py-3 text-sm font-medium text-yellow-300 rounded-lg hover:bg-gray-700 focus:outline-none focus:bg-gray-700 transition-colors duration-200"
                  onClick={() => setFeaturesOpen(true)}
                  aria-expanded={featuresOpen}
                >
                  <svg className={`w-6 h-6 transition-transform ${featuresOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  <span className="mx-4">Additional Options</span>
                </button>
              </div>
            )}
          </nav>
        )}

        {/* Logout as last menu item - pinned to bottom, only show when overlay is closed */}
        {!featuresOpen && (
            <a
              href="#"
              onClick={handleLogout}
              className="flex items-center px-4 py-3 mt-4 text-sm font-medium transition-colors duration-200 transform rounded-lg bg-red-600 text-white hover:bg-red-700 flex-shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
              </svg>
              <span className="mx-4">Logout</span>
            </a>
        )}
      </div>
      {isSidebarOpen && <div className="fixed inset-0 bg-black opacity-50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}
    </div>
  );
};

export default Sidebar;