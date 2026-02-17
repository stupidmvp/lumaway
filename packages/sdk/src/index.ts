import { LumaSDK } from './LumaSDK';

if (typeof window !== 'undefined') {
    // Auto-initialize (Antigravity: Zero config)
    new LumaSDK();
}

export { LumaSDK };
