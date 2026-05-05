import { PermissionsProviderWrapper } from "@/components/permissions-provider-wrapper";
import { ProjectSearchProvider } from "@/components/project-search-context";
import { SidebarProvider } from "@/components/ui/sidebar";
import { GlobalLoadingIndicator } from "@/components/global-loading-indicator";
import { cookies } from "next/headers";

export default async function EditorLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const cookieStore = await cookies();
    const sidebarState = cookieStore.get("sidebar_state")?.value;
    const defaultOpen = sidebarState === undefined ? true : sidebarState === "true";

    return (
        <PermissionsProviderWrapper>
            <ProjectSearchProvider>
                <SidebarProvider defaultOpen={defaultOpen}>
                    <GlobalLoadingIndicator />
                    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
                        {children}
                    </div>
                </SidebarProvider>
            </ProjectSearchProvider>
        </PermissionsProviderWrapper>
    );
}
