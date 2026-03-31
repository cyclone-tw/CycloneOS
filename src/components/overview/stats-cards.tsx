"use client";

import { useEffect, useState } from "react";
import { Activity, Zap, MessageSquare } from "lucide-react";

interface StatsData {
  operations: number | null;
  openclaw: number | null;
  sessionsToday: number | null;
  sessionsWeek: number | null;
}

export function StatsCards() {
  const [data, setData] = useState<StatsData>({
    operations: null,
    openclaw: null,
    sessionsToday: null,
    sessionsWeek: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const results: StatsData = { operations: null, openclaw: null, sessionsToday: null, sessionsWeek: null };

      const fetches = [
        fetch("/api/audit")
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => { if (j) results.operations = j.todayCount ?? 0; })
          .catch(() => {}),
        fetch("/api/openclaw")
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => { if (j) results.openclaw = j.todayCount ?? 0; })
          .catch(() => {}),
        fetch("/api/sessions")
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            if (j) {
              results.sessionsToday = j.todayCount ?? 0;
              results.sessionsWeek = j.sessions?.length ?? 0;
            }
          })
          .catch(() => {}),
      ];

      await Promise.all(fetches);
      setData(results);
      setLoading(false);
    };

    fetchStats();
  }, []);

  const cards = [
    {
      label: "Operations",
      value: data.operations,
      icon: Activity,
      color: "text-cy-accent",
    },
    {
      label: "OpenClaw",
      value: data.openclaw,
      icon: Zap,
      color: "text-cy-warning",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="cy-glass rounded-lg p-4"
        >
          <div className="flex items-center gap-2">
            <card.icon className={`h-4 w-4 ${card.color}`} />
            <span className="text-xs text-cy-muted">{card.label}</span>
          </div>
          <div className="mt-2">
            {loading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-cy-input" />
            ) : (
              <span className="text-2xl font-bold text-cy-text">
                {card.value !== null ? card.value : "\u2014"}
              </span>
            )}
          </div>
        </div>
      ))}
      {/* Sessions card with today / 7d */}
      <div className="cy-glass rounded-lg p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-cy-success" />
          <span className="text-xs text-cy-muted">Sessions</span>
        </div>
        <div className="mt-2">
          {loading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-cy-input" />
          ) : (
            <div className="flex items-baseline gap-3">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-cy-text">
                  {data.sessionsToday ?? "\u2014"}
                </span>
                <span className="text-xs text-cy-muted">今日</span>
              </div>
              {data.sessionsWeek !== null && (
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-cy-text/60">
                    {data.sessionsWeek}
                  </span>
                  <span className="text-xs text-cy-muted">近 7 天</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
