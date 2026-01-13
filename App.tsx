import React, { useState, lazy, Suspense, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import LandingPage from './components/LandingPage';
import Sidebar from './components/Sidebar';
import { View } from './types';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import { NotificationToast } from './components/NotificationToast';
import { initNotifications } from './services/notificationService';
import TokenStatus from './components/TokenStatus';
import TopMenu from './components/TopMenu';


// Lazy-load manager components for route-based code splitting
const FXMarginBuilder = lazy(() => import('./components/FXMarginBuilder') as Promise<{ default: React.ComponentType<any> }>);
const UserManager = lazy(() => import('./components/UserManager'));
const CampaignManager = lazy(() => import('./components/CampaignManager'));
const PricingManager = lazy(() => import('./components/PricingManager'));
const LoyaltyManager = lazy(() => import('./components/LoyaltyManager'));
const ZoneManager = lazy(() => import('./components/ZoneManager'));
const ServiceManager = lazy(() => import('./components/ServiceManager'));
const ThemeConfigurator = lazy(() => import('./components/ThemeConfigurator'));
const ReferenceDataManager = lazy(() => import('./components/ReferenceDataManager'));
const AuditManager = lazy(() => import('./components/AuditManager'));
const FXPricingManager = lazy(() => import('./components/FXPricingManager'));
const DiscountAmountTypeManager = lazy(() => import('./components/DiscountAmountTypeManager'));
const UserDiscountGroupManager = lazy(() => import('./components/UserDiscountGroupManager'));
const FXCampaignManager = lazy(() => import('./components/FXCampaignManager'));
const FXDiscountOptionManager = lazy(() => import('./components/FXDiscountOptionManager'));
const DataExtractionManager = lazy(() => import('./components/DataExtractionManager'));
const BundledPricingManager = lazy(() => import('./components/BundledPricingManager'));
const CompanyDetailsManager = lazy(() => import('./components/CompanyDetailsManager'));
const CustomerManager = lazy(() => import('./components/CustomerManager'));
const CustomerActivityManager = lazy(() => import('./components/CustomerActivityManager'));
const CalculatorService = lazy(() => import('./components/CalculatorService.tsx'));
const CampaignsReport = lazy(() => import('./components/CampaignsReport'));
const MGMNotificationManager = lazy(() => import('./components/MGMNotificationManager'));
const PushTestAdmin = lazy(() => import('./components/PushTestAdmin'));
const TokenListAdmin = lazy(() => import('./components/TokenListAdmin'));
const ReferralCodeManager = lazy(() => import('./components/ReferralCodeManager'));
const DomainMenuBuilder = lazy(() => import('./components/DomainMenuBuilder'));

// View type now imported from types.ts

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setAuthenticated] = useState(false);

  // Initialize Firebase notifications on app load
  useEffect(() => {
    initNotifications().catch((error) => {
      console.error('Failed to initialize notifications:', error);
    });
    // If permission not yet granted, proactively request on app load to surface any errors
    try {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        // Lazy import to avoid bundling cost upfront
        import('./services/notificationService').then(({ requestNotificationPermission }) => {
          requestNotificationPermission().catch((e) => console.warn('Notification permission request failed:', e));
        });
      }
    } catch (e) {
      console.warn('Notification permission bootstrap failed:', e);
    }
  }, []);

  const handleAuthSuccess = () => {
    setAuthenticated(true);
  };

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
      case 'reference':
        return <ReferenceDataManager />;
      case 'audit':
        return <AuditManager />;
      case 'fxpricing':
        return <FXPricingManager />;
      case 'fxmarginbuilder':
        return <FXMarginBuilder />;
      case 'discountAmountTypes':
        return <DiscountAmountTypeManager />;
      case 'discountgroups':
        return <UserDiscountGroupManager />;
      case 'fxcampaigns':
        return <FXCampaignManager />;
      case 'fxdiscountoptions':
        return <FXDiscountOptionManager />;
      case 'dataextract':
        return <DataExtractionManager />;
      case 'bundledpricing':
        return <BundledPricingManager />;
      case 'companyDetails':
        return <CompanyDetailsManager />;
      case 'simulation':
        return <div className="space-y-6"><h1 className="text-3xl font-bold text-gray-800 mb-4">Simulation</h1><p>Select a submenu: Customers, Activities, or Pricing Calculator.</p></div>;
      case 'customerManager':
        return <CustomerManager />;
      case 'customerActivityManager':
        return <CustomerActivityManager />;
      case 'calculatorService':
        return <CalculatorService setCurrentView={setCurrentView} />;
      case 'campaignsReport':
        return <CampaignsReport />;
      case 'mgmNotifications':
        return <MGMNotificationManager />;
      case 'pushTestAdmin':
        return <PushTestAdmin />;
      case 'tokenListAdmin':
        return <TokenListAdmin />;
      case 'referralCodes':
        return <ReferralCodeManager />;
      case 'domainMenuBuilder':
        return <DomainMenuBuilder />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          {!isAuthenticated ? (
            <LandingPage onAuthSuccess={handleAuthSuccess} />
          ) : (
            <div className="flex h-screen bg-gray-100 font-sans">
              <Sidebar 
                currentView={currentView} 
                setCurrentView={setCurrentView} 
                isSidebarOpen={isSidebarOpen} 
                setSidebarOpen={setSidebarOpen}
              />
              <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
                <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6 lg:p-8">
                  <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>}>
                    {renderView()}
                  </Suspense>
                </main>
              </div>
            </div>
          )}
          <NotificationToast />
          <TokenStatus />
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;