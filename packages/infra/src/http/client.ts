import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3030'; // NOTE: infra package reads env directly since it's shared across apps

export const httpClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token + active organization header
httpClient.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('lumaway_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Inject the active organization context so the backend can scope queries
        const activeOrgId = localStorage.getItem('lumaway_active_org');
        if (activeOrgId) {
            config.headers['X-Organization-Id'] = activeOrgId;
        }
    }
    return config;
});

// Response interceptor for global error handling (optional but good practice)
httpClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Handle unauthorized (optional: redirect to login or clear storage)
            if (typeof window !== 'undefined') {
                // localStorage.removeItem('lumaway_token'); // Strict mode might not want auto-clear
            }
        }
        return Promise.reject(error);
    }
);
