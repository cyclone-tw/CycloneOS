// src/components/skills/workstations/education/spc-meeting/spc-meeting-panel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, Settings } from "lucide-react";
import { MeetingHeaderForm, type FieldDef } from "../shared/meeting-header-form";
import { DownloadPanel } from "../shared/download-panel";
import { CommitteeManager } from "./committee-manager";
import { ProposalForm, type ProposalData } from "./proposal-form";
import { PreviousDecisions } from "./previous-decisions";
import { BusinessReportEditor } from "./business-report-editor";
import { MeetingSectionEditor, type SectionDef } from "../shared/meeting-section-editor";
import type { CommitteeMember } from "@/lib/education/committee-parser";

interface SpcMeetingPanelProps {
  onBack: () => void;
}

const SCHOOL_DEFAULTS = {
  academicYear: "114",
  location: "本校三樓共讀站",
  timeStart: "上午08:10",
};

const EMPTY_PROPOSAL: ProposalData = {
  type: "",
  title: "",
  description: "",
  decision: "",
  students: [],
  refDoc: "",
};

type Step = 1 | 2 | 3 | 4;

export function SpcMeetingPanel({ onBack }: SpcMeetingPanelProps) {
  const [step, setStep] = useState<Step>(1);

  // Step 1: Basic info
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    academicYear: SCHOOL_DEFAULTS.academicYear,
    location: SCHOOL_DEFAULTS.location,
    timeStart: SCHOOL_DEFAULTS.timeStart,
    meetingNumber: "",
    meetingDate: "",
    chair: "",
    recorder: "",
  });
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [committeeOpen, setCommitteeOpen] = useState(false);

  // Step 2: Decisions + report
  const [previousDecisions, setPreviousDecisions] = useState("");
  const [businessReport, setBusinessReport] = useState("");

  // Step 3: Proposals
  const [proposals, setProposals] = useState<ProposalData[]>([{ ...EMPTY_PROPOSAL }]);

  // Step 4: Final
  const [finalSections, setFinalSections] = useState<Record<string, string>>({
    motions: "無",
    timeEnd: "",
  });
  const [generating, setGenerating] = useState(false);
  const [downloadResult, setDownloadResult] = useState<{
    docxUrl?: string;
    docxFilename?: string;
    mdPath?: string;
    mocUpdated?: boolean;
  } | null>(null);

  // Auto-fill: detect next meeting number + today's date + committee
  const initPanel = useCallback(async () => {
    const year = parseInt(headerValues.academicYear, 10);
    if (isNaN(year)) return;

    // Fetch next meeting number
    try {
      const histRes = await fetch(`/api/education/spc-meeting/history?year=${year}`);
      const histData = await histRes.json();
      if (histData.nextMeetingNumber) {
        setHeaderValues((v) => ({ ...v, meetingNumber: String(histData.nextMeetingNumber) }));
      }
    } catch {
      // ignore
    }

    // Auto-fill today's date in ROC format
    const now = new Date();
    const rocYear = now.getFullYear() - 1911;
    const rocDate = `${rocYear}年${now.getMonth() + 1}月${now.getDate()}日`;
    setHeaderValues((v) => ({
      ...v,
      meetingDate: v.meetingDate || rocDate,
    }));

    // Load committee roster
    try {
      const res = await fetch(`/api/education/committee?year=${year}`);
      const data = await res.json();
      if (data.members?.length) {
        setCommittee(data.members);
        const chair = data.members.find((m: CommitteeMember) => m.role === "主席");
        const recorder = data.members.find((m: CommitteeMember) => m.role.includes("記錄"));
        if (chair) setHeaderValues((v) => ({ ...v, chair: chair.name }));
        if (recorder) setHeaderValues((v) => ({ ...v, recorder: recorder.name }));
      }
    } catch {
      // No roster
    }
  }, [headerValues.academicYear]);

  useEffect(() => {
    initPanel();
  }, [initPanel]);

  // Build header field definitions
  const chairOptions = committee.map((m) => ({ label: `${m.title} ${m.name}`, value: m.name }));
  const recorderOptions = committee.map((m) => ({ label: `${m.title} ${m.name}`, value: m.name }));

  const headerFields: FieldDef[] = [
    { key: "academicYear", label: "學年度", type: "number", defaultValue: SCHOOL_DEFAULTS.academicYear },
    { key: "meetingNumber", label: "第幾次", type: "number", placeholder: "例：5" },
    { key: "meetingDate", label: "會議日期", type: "text", placeholder: "例：115年4月5日" },
    { key: "timeStart", label: "開始時間", type: "text", defaultValue: SCHOOL_DEFAULTS.timeStart },
    { key: "location", label: "地點", type: "text", defaultValue: SCHOOL_DEFAULTS.location },
    {
      key: "chair",
      label: "主席",
      type: committee.length > 0 ? "select" : "text",
      options: chairOptions,
    },
    {
      key: "recorder",
      label: "記錄",
      type: committee.length > 0 ? "select" : "text",
      options: recorderOptions,
    },
  ];

  const updateHeader = (key: string, value: string) => {
    setHeaderValues((v) => ({ ...v, [key]: value }));
  };

  // Proposal management
  const addProposal = () => setProposals([...proposals, { ...EMPTY_PROPOSAL }]);
  const updateProposal = (index: number, data: ProposalData) => {
    setProposals(proposals.map((p, i) => (i === index ? data : p)));
  };
  const removeProposal = (index: number) => {
    setProposals(proposals.filter((_, i) => i !== index));
  };

  // Generate
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const body = {
        academicYear: parseInt(headerValues.academicYear, 10),
        meetingNumber: parseInt(headerValues.meetingNumber, 10),
        date: headerValues.meetingDate,
        timeStart: headerValues.timeStart,
        timeEnd: finalSections.timeEnd,
        location: headerValues.location,
        chair: headerValues.chair,
        recorder: headerValues.recorder,
        businessReport,
        previousTracking: previousDecisions,
        proposals: proposals.map((p) => ({
          type: p.type,
          title: p.title,
          description: p.description,
          decision: p.decision,
          students: p.students,
          refDoc: p.refDoc,
        })),
        motions: finalSections.motions,
        committee: committee.map((m) => ({ title: m.title, name: m.name, role: m.role })),
      };

      const res = await fetch("/api/education/spc-meeting/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.headers.get("Content-Type")?.includes("application/vnd.openxmlformats")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const filenameMatch = disposition.match(/filename\*=UTF-8''(.+)/);
        const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : "meeting.docx";

        setDownloadResult({
          docxUrl: url,
          docxFilename: filename,
          mdPath: res.headers.get("X-Md-Path") ?? undefined,
          mocUpdated: res.headers.get("X-Moc-Updated") === "true",
        });
      }
    } catch (err) {
      console.error("Generate failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const finalSectionDefs: SectionDef[] = [
    { key: "motions", label: "臨時動議", placeholder: "無", minRows: 2 },
    { key: "timeEnd", label: "散會時間", placeholder: "例：上午09:00", minRows: 1 },
  ];

  const STEPS = ["基本資訊", "前次決議＋業務報告", "提案討論", "確認＋下載"];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 5.5rem)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          教育工作站
        </button>
        <span className="text-lg">📋</span>
        <h1 className="text-lg font-bold text-cy-text">特推會會議記錄</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 py-3 overflow-x-auto md:gap-2">
        {STEPS.map((label, i) => (
          <button
            key={i}
            onClick={() => setStep((i + 1) as Step)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors md:px-4 md:py-2 md:text-sm ${
              step === i + 1
                ? "bg-cy-accent text-white"
                : "bg-cy-input/50 text-cy-muted hover:text-cy-text"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="mx-auto w-full max-w-5xl px-4 space-y-6">
          {step === 1 && (
            <>
              <MeetingHeaderForm
                fields={headerFields}
                values={headerValues}
                onChange={updateHeader}
              />
              <div className="flex items-center gap-2 text-xs text-cy-muted">
                <span>委員名冊：{headerValues.academicYear} 學年度 ({committee.length} 人)</span>
                <button
                  onClick={() => setCommitteeOpen(true)}
                  className="flex items-center gap-1 text-cy-accent hover:text-cy-accent/80"
                >
                  <Settings className="h-3 w-3" />
                  管理
                </button>
              </div>
              <CommitteeManager
                year={parseInt(headerValues.academicYear, 10) || 114}
                isOpen={committeeOpen}
                onClose={() => setCommitteeOpen(false)}
                onSaved={(members) => {
                  setCommittee(members);
                  const chair = members.find((m) => m.role === "主席");
                  const recorder = members.find((m) => m.role.includes("記錄"));
                  if (chair) updateHeader("chair", chair.name);
                  if (recorder) updateHeader("recorder", recorder.name);
                }}
              />
              <button
                onClick={() => setStep(2)}
                className="rounded-md bg-cy-accent px-4 py-2 text-sm font-medium text-white hover:bg-cy-accent/90 transition-colors"
              >
                下一步
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <PreviousDecisions
                academicYear={parseInt(headerValues.academicYear, 10) || 114}
                meetingNumber={parseInt(headerValues.meetingNumber, 10) || 1}
                value={previousDecisions}
                onChange={setPreviousDecisions}
              />
              <BusinessReportEditor
                value={businessReport}
                onChange={setBusinessReport}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-md border border-cy-border px-4 py-2 text-sm text-cy-muted hover:text-cy-text transition-colors"
                >
                  上一步
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="rounded-md bg-cy-accent px-4 py-2 text-sm font-medium text-white hover:bg-cy-accent/90 transition-colors"
                >
                  下一步
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-4">
                {proposals.map((p, i) => (
                  <ProposalForm
                    key={i}
                    index={i}
                    data={p}
                    onChange={(data) => updateProposal(i, data)}
                    onRemove={() => removeProposal(i)}
                    canRemove={proposals.length > 1}
                  />
                ))}
              </div>
              <button
                onClick={addProposal}
                className="flex items-center gap-1.5 text-xs text-cy-accent hover:text-cy-accent/80"
              >
                <Plus className="h-3.5 w-3.5" />
                新增案由
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-md border border-cy-border px-4 py-2 text-sm text-cy-muted hover:text-cy-text transition-colors"
                >
                  上一步
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="rounded-md bg-cy-accent px-4 py-2 text-sm font-medium text-white hover:bg-cy-accent/90 transition-colors"
                >
                  下一步
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <MeetingSectionEditor
                sections={finalSectionDefs}
                values={finalSections}
                onChange={(key, val) => setFinalSections((v) => ({ ...v, [key]: val }))}
              />
              <DownloadPanel
                result={downloadResult}
                loading={generating}
                onGenerate={handleGenerate}
                generateLabel="生成會議記錄"
              />
              <button
                onClick={() => setStep(3)}
                className="rounded-md border border-cy-border px-4 py-2 text-sm text-cy-muted hover:text-cy-text transition-colors"
              >
                上一步
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
