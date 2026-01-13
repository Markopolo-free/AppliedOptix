// AuthContext.tsx
// Context for managing authenticated user state and role-based access control

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserRole } from '../enums';
import { getTenantFeatures } from '../TenantFeatureConfig';

// Inline ProductDomain type to avoid circular dependency
type ProductDomain = 'dashboard' | 'admin' | 'fx' | 'emobility' | 'fintech';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  profilePicture?: string; // Base64 or URL
  // DOMAIN SYSTEM: Added 2026-01-12 for multi-portal support
  allowedDomains?: ProductDomain[];  // Which domains this user can access
  defaultDomain?: ProductDomain;     // Default domain on login
  tenantId?: string;                 // Tenant identifier for data isolation
}

interface AuthContextType {
  currentUser: AuthUser | null;
  setCurrentUser: (user: AuthUser | null) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  logout: () => void;
  tenantOverride: string | null;  // Admin can override tenant for demo purposes
  setTenantOverride: (tenantId: string | null) => void;
  effectiveTenantId: string;  // The actual tenant ID to use (override or user's tenant)
  getTenantAllowedViews: () => string[];  // Get feature list for current effective tenant
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [tenantOverride, setTenantOverride] = useState<string | null>(null);

  const logout = () => {
    setCurrentUser(null);
    setTenantOverride(null);
  };

  // Determine effective tenant: use override if set (and user is admin), otherwise use user's tenant
  const effectiveTenantId = 
    (tenantOverride && currentUser?.role === UserRole.Administrator) 
      ? tenantOverride 
      : (currentUser?.tenantId || 'default-tenant');

  // Get feature list for the effective tenant
  const getTenantAllowedViews = () => getTenantFeatures(effectiveTenantId);

  const value: AuthContextType = {
    currentUser,
    setCurrentUser,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === UserRole.Administrator,
    logout,
    tenantOverride,
    setTenantOverride,
    effectiveTenantId,
    getTenantAllowedViews,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
