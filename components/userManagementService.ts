// userManagementService.ts
// Utility to fetch users from UserManager's Firebase DB

import { db } from '../services/firebase';
import { ref, get } from 'firebase/database';

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
