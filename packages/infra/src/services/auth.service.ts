import { httpClient } from '../http/client';

export interface LoginCredentials {
    email: string;
    password: string;
    strategy?: 'local';
}

export interface RegisterCredentials {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
}

export interface AuthResponse {
    accessToken: string;
    user: any;
    permissions: string[];
    roles: string[];
}

export const AuthService = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const { data } = await httpClient.post<AuthResponse>('/authentication', {
            strategy: 'local',
            ...credentials
        });

        if (data.accessToken && typeof window !== 'undefined') {
            localStorage.setItem('lumaway_token', data.accessToken);
            // Optional: Set cookie for middleware if needed, though usually handled by app logic
            document.cookie = `lumaway_token=${data.accessToken}; path=/; max-age=86400; SameSite=Strict`;
        }

        return data;
    },

    async logout() {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('lumaway_token');
            localStorage.removeItem('lumaway_active_org');
            document.cookie = 'lumaway_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
        }
    },

    async register(credentials: RegisterCredentials): Promise<AuthResponse> {
        // Create the user account
        await httpClient.post('/auth-register', credentials);

        // Auto-login after registration
        const { data } = await httpClient.post<AuthResponse>('/authentication', {
            strategy: 'local',
            email: credentials.email,
            password: credentials.password,
        });

        if (data.accessToken && typeof window !== 'undefined') {
            localStorage.setItem('lumaway_token', data.accessToken);
            document.cookie = `lumaway_token=${data.accessToken}; path=/; max-age=86400; SameSite=Strict`;
        }

        return data;
    },

    getToken(): string | null {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('lumaway_token');
        }
        return null;
    }
};
