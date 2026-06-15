// src/utils/checkServiceAccount.ts
export const hasServiceAccount = (): boolean => {
  try {
    // Attempt to import the service account JSON (Git-ignored by default)
    // The path is relative to the project root.
    // Using dynamic import so that bundlers don't include it in production builds.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../serviceAccountKey.json');
    // If the file exists and contains a client_email field we consider it valid.
    return !!config && typeof config.client_email === 'string';
  } catch (e) {
    // File not found or parse error – treat as absent.
    return false;
  }
};
