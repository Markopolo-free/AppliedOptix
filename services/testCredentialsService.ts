// testCredentialsService.ts
// Service to load test credentials from JSON file for development/testing
// Returns empty credentials in production if the file is not available

// Conditional import - only available in dev (file is in .gitignore)
// Load test credentials from public directory for all environments
let testCredentialsData: { credentials: Credential[] } | undefined = undefined;
try {
  // @ts-ignore
  testCredentialsData = await (await fetch('/test-credentials.json')).json();
} catch (e) {
  console.log('Test credentials not loaded (file not found - expected in production)');
}

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