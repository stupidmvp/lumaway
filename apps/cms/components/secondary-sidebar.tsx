'use client';

/**
 * A global portal target for the secondary sidebar.
 * Components like LumenReviewPanel can use React Portals to render content here.
 */
export function SecondarySidebar() {
    return (
        <div id="secondary-sidebar-portal-target" className="flex shrink-0 relative bg-background empty:hidden shadow-sm" />
    );
}
