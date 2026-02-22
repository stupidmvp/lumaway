export interface LumaUserContext {
    userId?: string;

    roles?: string[];
    locale?: string;

    flags?: Record<string, boolean>;

    user?: {
        firstName?: string;
        lastName?: string;
        email?: string;
    };
}
