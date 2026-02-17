import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ClientLayoutContent } from "@/app/ClientLayoutContent";
import { TopBar } from "@/components/top-bar";
import { ProjectSearchProvider } from "@/components/project-search-context";
import { PermissionsProviderWrapper } from "@/components/permissions-provider-wrapper";
import { GlobalLoadingIndicator } from "@/components/global-loading-indicator";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PermissionsProviderWrapper>
      <ProjectSearchProvider>
        <SidebarProvider>
          <GlobalLoadingIndicator />
          <div className="flex flex-col h-screen w-full overflow-hidden">
            <TopBar />
            <div className="flex-1 min-h-0 flex w-full">
              <AppSidebar />
              <ClientLayoutContent>
                {children}
              </ClientLayoutContent>
            </div>
          </div>
        </SidebarProvider>
      </ProjectSearchProvider>
    </PermissionsProviderWrapper>
  );
}
