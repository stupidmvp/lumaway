import { PermissionsProviderWrapper } from "@/components/permissions-provider-wrapper";
import { ProjectSearchProvider } from "@/components/project-search-context";
import { SidebarProvider } from "@/components/ui/sidebar";
import { GlobalLoadingIndicator } from "@/components/global-loading-indicator";

export default function EditorLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <PermissionsProviderWrapper>
            <ProjectSearchProvider>
                <SidebarProvider>
                    <GlobalLoadingIndicator />
                    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
                        {children}
                    </div>
                </SidebarProvider>
            </ProjectSearchProvider>
        </PermissionsProviderWrapper>
    );
}
