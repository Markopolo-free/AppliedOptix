
import React, { useState, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';

// Lazy-load manager components for route-based code splitting
const UserManager = lazy(() => import('./components/UserManager'));
const CampaignManager = lazy(() => import('./components/CampaignManager'));
const PricingManager = lazy(() => import('./components/PricingManager'));
const LoyaltyManager = lazy(() => import('./components/LoyaltyManager'));
const ZoneManager = lazy(() => import('./components/ZoneManager'));
const ServiceManager = lazy(() => import('./components/ServiceManager'));
const ThemeConfigurator = lazy(() => import('./components/ThemeConfigurator'));

type View = 'dashboard' | 'users' | 'services' | 'pricing' | 'campaigns' | 'loyalty' | 'zones' | 'theme';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'users':
        return <UserManager />;
      case 'services':
        return <ServiceManager />;
      case 'pricing':
        return <PricingManager />;
      case 'zones':
        return <ZoneManager />;
      case 'campaigns':
        return <CampaignManager />;
      case 'loyalty':
        return <LoyaltyManager />;
      case 'theme':
        return <ThemeConfigurator />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
        <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>}>
            {renderView()}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default App;