import { ENV } from './env';

export const API_URL = ENV.API_URL;

export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
    // Get token from storage (client-side only check)
    const token = typeof window !== 'undefined' ? localStorage.getItem('lumaway_token') : null;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        (headers as any)['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        // If 401, clear session data and redirect to login
        if (res.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('lumaway_token');
            localStorage.removeItem('lumaway_active_org');
            document.cookie = 'lumaway_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
            const currentPath = window.location.pathname;
            const redirectParam = currentPath !== '/login' && currentPath !== '/register' ? `?redirect=${encodeURIComponent(currentPath)}` : '';
            window.location.href = `/login${redirectParam}`;
        }
        const errorMessage = typeof error.message === 'string'
            ? error.message
            : typeof error.error === 'string'
                ? error.error
                : error.message || error.error
                    ? JSON.stringify(error.message || error.error)
                    : `API Error: ${res.statusText}`;
        throw new Error(errorMessage);
    }

    return res.json();
}

export const api = {
    get: (endpoint: string) => fetchAPI(endpoint, { method: 'GET' }),
    post: (endpoint: string, body: any) => fetchAPI(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }),
    patch: (endpoint: string, body: any) => fetchAPI(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }),
    delete: (endpoint: string) => fetchAPI(endpoint, { method: 'DELETE' }),
};
