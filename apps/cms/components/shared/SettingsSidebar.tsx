'use client';

import { cn } from '@/lib/utils';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { useState } from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

// ── Types ────────────────────────────────────────────────────────────────

export interface SettingsTabDef<T extends string = string> {
    key: T;
    label: string;
    icon: React.ElementType;
}

interface SettingsSidebarProps<T extends string> {
    tabs: SettingsTabDef<T>[];
    activeTab: T;
    onTabChange: (tab: T) => void;
    /** Optional heading shown above the tab list (only when expanded) */
    heading?: string;
}

// ── Component ────────────────────────────────────────────────────────────

export function SettingsSidebar<T extends string>({
    tabs,
    activeTab,
    onTabChange,
    heading,
}: SettingsSidebarProps<T>) {
    const [collapsed, setCollapsed] = useState(true);

    return (
        <TooltipProvider delayDuration={0}>
            <nav
                className={cn(
                    "shrink-0 border-r border-border bg-background overflow-y-auto py-3 transition-all duration-200",
                    collapsed ? "w-12 px-1" : "w-56 px-2"
                )}
            >
                {/* Collapse / expand toggle */}
                <div className={cn(
                    "flex items-center mb-2",
                    collapsed ? "justify-center" : "justify-between px-2.5"
                )}>
                    {!collapsed && heading && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted truncate">
                            {heading}
                        </p>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={() => setCollapsed((v) => !v)}
                                className="p-1 rounded-md text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors cursor-pointer"
                            >
                                {collapsed ? (
                                    <PanelLeft className="h-3.5 w-3.5" />
                                ) : (
                                    <PanelLeftClose className="h-3.5 w-3.5" />
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                            {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        </TooltipContent>
                    </Tooltip>
                </div>

                {/* Tab items */}
                <ul className="space-y-0.5">
                    {tabs.map(({ key, label, icon: Icon }) => (
                        <li key={key}>
                            {collapsed ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={() => onTabChange(key)}
                                            className={cn(
                                                "w-full flex items-center justify-center p-2 rounded-md transition-all cursor-pointer",
                                                activeTab === key
                                                    ? "bg-accent-blue/10 text-accent-blue"
                                                    : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                                            )}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="text-xs">
                                        {label}
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onTabChange(key)}
                                    className={cn(
                                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all cursor-pointer",
                                        activeTab === key
                                            ? "bg-accent-blue/10 text-accent-blue"
                                            : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                                    )}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    {label}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </nav>
        </TooltipProvider>
    );
}

