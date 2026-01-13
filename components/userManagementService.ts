// userManagementService.ts
// Utility to fetch users from UserManager's Firebase DB

import { db } from '../services/firebase';
import { ref, get } from 'firebase/database';
import { User } from '../types';

export async function getAllUserEmails(): Promise<string[]> {
  const usersRef = ref(db, 'users');
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.keys(data).map(key => data[key].email);
}

export async function userEmailExists(email: string): Promise<boolean> {
  const emails = await getAllUserEmails();
  return emails.includes(email);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const usersRef = ref(db, 'users');
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return null;
  const data = snapshot.val();
  
  const userKey = Object.keys(data).find(key => data[key].email === email);
  if (!userKey) return null;
  
  return {
    id: userKey,
    name: data[userKey].name,
    email: data[userKey].email,
    role: data[userKey].role,
    profilePicture: data[userKey].profilePicture,
    createdAt: data[userKey].createdAt,
    lastModifiedAt: data[userKey].lastModifiedAt,
    lastModifiedBy: data[userKey].lastModifiedBy,
    // MULTI-TENANT: Include domain and tenant information from user record
    allowedDomains: data[userKey].allowedDomains || ['admin', 'dashboard'],
    defaultDomain: data[userKey].defaultDomain || 'dashboard',
    tenantId: data[userKey].tenantId || 'default-tenant',
  };
}

export async function getAllUsers(): Promise<User[]> {
  const usersRef = ref(db, 'users');
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  
  return Object.keys(data).map(key => ({
    id: key,
    name: data[key].name,
    email: data[key].email,
    role: data[key].role,
    profilePicture: data[key].profilePicture,
    createdAt: data[key].createdAt,
    lastModifiedAt: data[key].lastModifiedAt,
    lastModifiedBy: data[key].lastModifiedBy,
    // MULTI-TENANT: Include domain and tenant information
    allowedDomains: data[key].allowedDomains || ['admin', 'dashboard'],
    defaultDomain: data[key].defaultDomain || 'dashboard',
    tenantId: data[key].tenantId || 'default-tenant',
  }));
}
