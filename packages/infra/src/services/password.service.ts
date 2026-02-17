import { httpClient } from '../http/client';

export const PasswordService = {
    /**
     * Change password for the authenticated user.
     * Requires current password verification.
     */
    changePassword: async (data: { currentPassword: string; newPassword: string }) => {
        const response = await httpClient.post('/auth-change-password', data);
        return response.data;
    },

    /**
     * Request a password reset email.
     * Always returns success to prevent email enumeration.
     */
    forgotPassword: async (data: { email: string }) => {
        const response = await httpClient.post('/auth-forgot-password', data);
        return response.data;
    },

    /**
     * Reset password using a token from the reset email.
     */
    resetPassword: async (data: { token: string; newPassword: string }) => {
        const response = await httpClient.post('/auth-reset-password', data);
        return response.data;
    },
};


