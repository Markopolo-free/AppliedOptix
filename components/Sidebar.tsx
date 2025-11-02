
import React from 'react';
import { DashboardIcon, UsersIcon, PricingIcon, CampaignIcon, LoyaltyIcon, CloseIcon, ZoneIcon, ServiceIcon } from './icons';

type View = 'dashboard' | 'users' | 'services' | 'pricing' | 'campaigns' | 'loyalty' | 'zones' | 'theme';

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
  const handleNavClick = (view: View) => {
    setCurrentView(view);
    if (window.innerWidth < 1024) { // Close sidebar on mobile after navigation
        setSidebarOpen(false);
    }
  };
  
  const navItems = [
    { view: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { view: 'users', label: 'User Management', icon: <UsersIcon /> },
    { view: 'services', label: 'Service Management', icon: <ServiceIcon /> },
    { view: 'pricing', label: 'Pricing Rules', icon: <PricingIcon /> },
    { view: 'zones', label: 'Pricing Zones', icon: <ZoneIcon /> },
    { view: 'campaigns', label: 'Campaigns', icon: <CampaignIcon /> },
    { view: 'loyalty', label: 'Loyalty Programs', icon: <LoyaltyIcon /> },
    { view: 'theme', label: '🎨 Theme Builder', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path></svg> },
  ];

  return (
    <>
        <div className={`fixed inset-y-0 left-0 z-30 w-64 px-4 py-5 overflow-y-auto bg-gray-800 transition-transform duration-300 ease-in-out transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <span className="ml-2 text-2xl font-semibold text-white">eMobility</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 lg:hidden">
            <CloseIcon />
          </button>
        </div>

        <nav className="mt-10">
          {navItems.map(item => (
            <NavLink
              key={item.view}
              icon={item.icon}
              label={item.label}
              isActive={currentView === item.view}
              onClick={() => handleNavClick(item.view as View)}
            />
          ))}
        </nav>
      </div>
      {isSidebarOpen && <div className="fixed inset-0 bg-black opacity-50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}
    </>
  );
};

export default Sidebar;