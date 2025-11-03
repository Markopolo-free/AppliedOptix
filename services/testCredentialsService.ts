// testCredentialsService.ts
// Service to load test credentials from JSON file for development/testing

import testCredentials from '../test-credentials.json';

export interface Credential {
  username: string;
  password: string;
}

export function getTestCredentials(): Credential[] {
  return testCredentials.credentials || [];
}

export function validateCredentials(username: string, password: string): boolean {
  const credentials = getTestCredentials();
  return credentials.some(c => c.username === username && c.password === password);
}

export function userExistsInTestCredentials(username: string): boolean {
  const credentials = getTestCredentials();
  return credentials.some(c => c.username === username);
}
