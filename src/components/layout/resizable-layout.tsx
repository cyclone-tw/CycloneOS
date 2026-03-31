"use client";

import { Panel, Group, Separator } from "react-resizable-panels";
import { Sidebar } from "./sidebar";
import { DashboardPanel } from "./dashboard-panel";
import { useAppStore, type SidebarPage } from "@/stores/app-store";

const FULL_WIDTH_PAGES: SidebarPage[] = ["skills", "timeline", "settings"];

export function ResizableLayout({ chatPanel }: { chatPanel: React.ReactNode }) {
  const { activePage } = useAppStore();
  const isFullWidth = FULL_WIDTH_PAGES.includes(activePage);

  return (
    <div className="flex h-screen">
      <Sidebar />
      {!isFullWidth ? (
        <Group orientation="horizontal">
          <Panel defaultSize={60} minSize={30}>
            <DashboardPanel />
          </Panel>
          <Separator className="w-px bg-cy-border hover:bg-cy-accent/30 transition-colors" />
          <Panel defaultSize={40} minSize={25}>
            {chatPanel}
          </Panel>
        </Group>
      ) : (
        <div className="flex-1 overflow-hidden">
          <DashboardPanel />
        </div>
      )}
    </div>
  );
}
