// secretsService.ts
// Simple persistent secrets storage using localStorage

export type Secret = {
  username: string;
  password: string;
};

const SECRETS_KEY = 'adaptiveOptixSecrets';

export function saveSecret(secret: Secret) {
  const secrets = getSecrets();
  secrets.push(secret);
  localStorage.setItem(SECRETS_KEY, JSON.stringify(secrets));
}

export function getSecrets(): Secret[] {
  const raw = localStorage.getItem(SECRETS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function userExists(username: string): boolean {
  return getSecrets().some(s => s.username === username);
}

export function getSecretForUser(username: string): Secret | undefined {
  return getSecrets().find(s => s.username === username);
}

// Debug utility - remove in production
export function debugSecrets(): void {
  console.log('All stored secrets:', getSecrets());
}
