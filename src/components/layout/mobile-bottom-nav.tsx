"use client";

import { useAppStore, type SidebarPage } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Mail,
  HardDrive,
  MessageCircle,
  Settings,
  type LucideIcon,
} from "lucide-react";

const MOBILE_NAV: { page: SidebarPage; icon: LucideIcon; label: string }[] = [
  { page: "overview", icon: LayoutDashboard, label: "Overview" },
  { page: "gmail", icon: Mail, label: "Mail" },
  { page: "drive", icon: HardDrive, label: "Drive" },
];

export function MobileBottomNav() {
  const { activePage, mobileView, setActivePage, setMobileView } = useAppStore();

  return (
    <nav className="flex items-center justify-around border-t border-cy-border bg-cy-card/90 backdrop-blur-sm px-2 py-1.5 safe-bottom">
      {MOBILE_NAV.map((item) => (
        <button
          key={item.page}
          onClick={() => {
            setActivePage(item.page);
          }}
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-[3.5rem]",
            activePage === item.page && mobileView === "dashboard"
              ? "text-cy-accent"
              : "text-cy-muted"
          )}
        >
          <item.icon className="h-5 w-5" strokeWidth={1.8} />
          <span className="text-[10px]">{item.label}</span>
        </button>
      ))}

      {/* Chat toggle */}
      <button
        onClick={() => setMobileView(mobileView === "chat" ? "dashboard" : "chat")}
        className={cn(
          "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-[3.5rem]",
          mobileView === "chat" ? "text-cy-accent" : "text-cy-muted"
        )}
      >
        <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
        <span className="text-[10px]">Chat</span>
      </button>

      {/* Settings */}
      <button
        onClick={() => setActivePage("settings")}
        className={cn(
          "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-[3.5rem]",
          activePage === "settings" && mobileView === "dashboard"
            ? "text-cy-accent"
            : "text-cy-muted"
        )}
      >
        <Settings className="h-5 w-5" strokeWidth={1.8} />
        <span className="text-[10px]">Settings</span>
      </button>
    </nav>
  );
}
