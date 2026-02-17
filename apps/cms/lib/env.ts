/**
 * Centralized environment variables.
 * All process.env references should go through this file.
 * Next.js automatically loads .env / .env.local files — no dotenv init needed.
 */
export const ENV = {
    API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3030',
    S3_URL_BASE: (process.env.NEXT_PUBLIC_S3_URL_BASE || '').replace(/\/?$/, '/'),
} as const;

