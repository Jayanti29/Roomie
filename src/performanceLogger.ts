// src/performanceLogger.ts
/**
 * Simple logger activated only when URL contains `?debug=true`.
 * Records timestamps for real‑time events and prints them to console.
 */
export const logEvent = (label: string) => {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  if (url.includes('debug=true')) {
    console.log(`[Realtime Debug] ${label} – ${new Date().toISOString()}`);
  }
};
