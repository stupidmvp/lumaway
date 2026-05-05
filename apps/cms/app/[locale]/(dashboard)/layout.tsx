import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ClientLayoutContent } from "@/app/ClientLayoutContent";
import { TopBar } from "@/components/top-bar";
import { ProjectSearchProvider } from "@/components/project-search-context";
import { PermissionsProviderWrapper } from "@/components/permissions-provider-wrapper";
import { GlobalLoadingIndicator } from "@/components/global-loading-indicator";
import { cookies } from "next/headers";

export default async function DashboardLayout({
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
