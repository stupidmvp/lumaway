'use client';

import { usePathname } from 'next/navigation';
import { SidebarInset } from '@/components/ui/sidebar';
import { Breadcrumb } from '@/components/ui/breadcrumb';

export function ClientLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    // Use custom layout for pages that manage their own header and layout
    const isCustomLayout = pathname?.includes('/editor') ||
        pathname?.includes('/profile') ||
        pathname?.includes('/settings') ||
        pathname?.includes('/my-organization') ||
        pathname?.includes('/organizations') ||
        (pathname?.match(/\/projects\/[^/]+/) && !pathname?.endsWith('/new')) ||
        (pathname?.match(/\/walkthroughs\/[^/]+/) && !pathname?.endsWith('/new')) ||
        pathname?.match(/\/users\/[^/]+$/);

    return (
        <SidebarInset>
            {!isCustomLayout && (
                <header className="flex h-14 shrink-0 items-center border-b px-4 bg-background sticky top-0 z-10">
                    <Breadcrumb />
                </header>
            )}

            <div className={`flex-1 flex flex-col min-h-0 ${isCustomLayout ? 'p-0 h-full' : 'p-6'}`}>
                {children}
            </div>
        </SidebarInset>
    );
}
