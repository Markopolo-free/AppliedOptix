// testCredentialsService.ts
// Service to load test credentials from JSON file for development/testing
// Returns empty credentials in production if the file is not available

export interface Credential {
  username: string;
  password: string;
}

// Safe getter for test credentials - returns empty array if file not found
function loadTestCredentials(): Credential[] {
  // In production/Vercel, test-credentials.json won't exist (it's in .gitignore)
  // Return empty credentials to prevent build errors
  if (import.meta.env.PROD) {
    return [];
  }
  
  // Development: try to load the file
  try {
    // This will only work locally where test-credentials.json exists
    // @ts-ignore - Optional import for development only
    const data = require('../test-credentials.json');
    return data?.credentials || [];
  } catch {
    return [];
  }
}

const cachedCredentials = loadTestCredentials();

export function getTestCredentials(): Credential[] {
  return cachedCredentials;
}

export function validateCredentials(username: string, password: string): boolean {
  const credentials = getTestCredentials();
  return credentials.some(c => c.username === username && c.password === password);
}

export function userExistsInTestCredentials(username: string): boolean {
  const credentials = getTestCredentials();
  return credentials.some(c => c.username === username);
}
