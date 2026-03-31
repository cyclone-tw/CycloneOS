"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useAppStore, type SidebarPage } from "@/stores/app-store";
import { StatsCards } from "@/components/overview/stats-cards";
import { ActivityTimeline } from "@/components/overview/activity-timeline";
import { OpenClawFeed } from "@/components/overview/openclaw-feed";
import { SessionsFeed } from "@/components/overview/sessions-feed";
import { UpcomingPanel } from "@/components/overview/upcoming-panel";
import { DailyDigest } from "@/components/overview/daily-digest";
import { MailDigest } from "@/components/overview/mail-digest";
import { WeeklyDigest } from "@/components/overview/weekly-digest";
import { YtDigest } from "@/components/overview/yt-digest";
import { DrivePanel } from "@/components/drive/drive-panel";
import { GmailPanel } from "@/components/gmail/gmail-panel";
import { TimelinePanel } from "@/components/timeline/timeline-panel";
import { SkillsPanel } from "@/components/skills/skills-panel";
import type { DigestData } from "@/types/digest";

function OverviewPage() {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/digest")
      .then((res) => res.json())
      .then((data: DigestData) => setDigest(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-cy-text">Overview</h1>
      <StatsCards />
      <UpcomingPanel />
      <DailyDigest data={digest?.dailyInfo ?? null} loading={loading} />
      <YtDigest entries={digest?.ytSummaries ?? []} loading={loading} />
      <MailDigest data={digest?.mailReport ?? null} loading={loading} />
      <WeeklyDigest data={digest?.weeklyReview ?? null} loading={loading} />
      <OpenClawFeed />
      <SessionsFeed />
      <ActivityTimeline />
    </div>
  );
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-xl font-bold capitalize text-cy-text">{title}</h1>
      <p className="mt-2 text-sm text-cy-muted">{description}</p>
    </div>
  );
}

const PAGE_COMPONENTS: Record<SidebarPage, ReactNode> = {
  overview: <OverviewPage />,
  gmail: <GmailPanel />,
  drive: <DrivePanel />,
  skills: <SkillsPanel />,
  timeline: <TimelinePanel />,
  search: <PlaceholderPage title="Search" description="Cross-source search — coming soon" />,
  settings: <PlaceholderPage title="Settings" description="Settings — coming soon" />,
};

export function DashboardPanel() {
  const { activePage } = useAppStore();

  return (
    <div className="flex h-full flex-col overflow-auto bg-cy-bg p-4">
      {PAGE_COMPONENTS[activePage]}
    </div>
  );
}
