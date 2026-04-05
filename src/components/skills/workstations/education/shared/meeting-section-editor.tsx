"use client";

export interface SectionDef {
  key: string;
  label: string;
  placeholder?: string;
  minRows?: number;
}

interface MeetingSectionEditorProps {
  sections: SectionDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function MeetingSectionEditor({ sections, values, onChange }: MeetingSectionEditorProps) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.key}>
          <label className="mb-1.5 block text-xs font-medium text-cy-muted">
            {section.label}
          </label>
          <textarea
            value={values[section.key] ?? ""}
            onChange={(e) => onChange(section.key, e.target.value)}
            placeholder={section.placeholder}
            rows={section.minRows ?? 4}
            className="w-full rounded-md border border-cy-border bg-cy-input px-3 py-2 text-sm text-cy-text focus:border-cy-accent focus:outline-none resize-y"
          />
        </div>
      ))}
    </div>
  );
}
