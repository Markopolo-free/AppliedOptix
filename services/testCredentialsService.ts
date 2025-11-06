// testCredentialsService.ts
// Service to load test credentials from JSON file for development/testing
// Returns empty credentials in production if the file is not available

// Conditional import - only available in dev (file is in .gitignore)
// @ts-ignore
const testCredentialsModules = import.meta.glob('../test-credentials.json', { eager: true, import: 'default' });
const testCredentialsData = testCredentialsModules['../test-credentials.json'] as { credentials: Credential[] } | undefined;

export interface Credential {
  username: string;
  password: string;
}

export function getTestCredentials(): Credential[] {
  if (!testCredentialsData) {
    console.log('Test credentials not loaded (file not found - expected in production)');
    return [];
  }
  return testCredentialsData.credentials || [];
}

export function validateCredentials(username: string, password: string): boolean {
  const credentials = getTestCredentials();
  return credentials.some(c => c.username === username && c.password === password);
}

export function userExistsInTestCredentials(username: string): boolean {
  const credentials = getTestCredentials();
  return credentials.some(c => c.username === username);
}