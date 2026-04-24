import React, { createContext, useContext, useEffect, useState } from "react";
import type { GuidancePlan, LumaUserContext } from "./public-types.js";
import type { LumaClientConfig } from "./LumaClient.js";
import { LumaSDK } from "./LumaSDK.js";

interface LumaContextType {
    sdk: LumaSDK | null;
    currentPlan: GuidancePlan | null;
    isInitialized: boolean;
}

const LumaContext = createContext<LumaContextType>({
    sdk: null,
    currentPlan: null,
    isInitialized: false,
});

export interface LumaProviderProps {
    config: LumaClientConfig;
    userContext?: LumaUserContext;
    children: React.ReactNode;
}

export function LumaProvider({ config, userContext, children }: LumaProviderProps) {
    const [sdk, setSdk] = useState<LumaSDK | null>(null);
    const [currentPlan, setCurrentPlan] = useState<GuidancePlan | null>(null);

    useEffect(() => {
        // Initialize SDK only once
        const lumaSdk = new LumaSDK(config, userContext ?? {});
        setSdk(lumaSdk);

        // Expose SDK on window for console debugging (e.g. setDebug, startWalkthrough)
        if (typeof window !== "undefined") {
            (window as any).__LUMA_SDK__ = lumaSdk;
        }

        // Subscribe to engine guidance
        const unsubscribe = lumaSdk.subscribe((plan: any) => {
            setCurrentPlan(plan);
        });

        return () => {
            unsubscribe();
            if (typeof window !== "undefined") (window as any).__LUMA_SDK__ = null;
            // TODO: Clean up SDK instance
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.apiKey, userContext?.userId]); // Removed config.projectId as it doesn't exist on LumaClientConfig

    return (
        <LumaContext.Provider value={{ sdk, currentPlan, isInitialized: !!sdk }}>
            {children}
        </LumaContext.Provider>
    );
}

export function useLuma() {
    return useContext(LumaContext);
}
