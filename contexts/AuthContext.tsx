// AuthContext.tsx
// Context for managing authenticated user state and role-based access control

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserRole } from '../types';

interface AuthUser {
  email: string;
  name: string;
  role: UserRole;
  profilePicture?: string; // Base64 or URL
}

interface AuthContextType {
  currentUser: AuthUser | null;
  setCurrentUser: (user: AuthUser | null) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const logout = () => {
    setCurrentUser(null);
  };

  const value: AuthContextType = {
    currentUser,
    setCurrentUser,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === UserRole.Administrator,
    logout,
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
