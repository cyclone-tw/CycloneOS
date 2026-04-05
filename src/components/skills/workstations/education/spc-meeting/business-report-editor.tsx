"use client";

interface BusinessReportEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function BusinessReportEditor({ value, onChange }: BusinessReportEditorProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-cy-muted">資源班業務報告</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="本學期資源班重要行事..."
        rows={4}
        className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text focus:border-cy-accent focus:outline-none resize-y"
      />
    </div>
  );
}
