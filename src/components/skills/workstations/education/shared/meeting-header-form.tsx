"use client";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "date" | "time" | "select" | "number";
  defaultValue?: string;
  options?: { label: string; value: string }[];
  readOnly?: boolean;
  placeholder?: string;
}

interface MeetingHeaderFormProps {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function MeetingHeaderForm({ fields, values, onChange }: MeetingHeaderFormProps) {
  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div key={field.key} className="flex items-center gap-3">
          <label className="w-24 shrink-0 text-right text-xs text-cy-muted">
            {field.label}
          </label>
          {field.type === "select" ? (
            <select
              value={values[field.key] ?? field.defaultValue ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              disabled={field.readOnly}
              className="flex-1 rounded-md border border-cy-border bg-cy-input px-3 py-1.5 text-sm text-cy-text focus:border-cy-accent focus:outline-none disabled:opacity-50"
            >
              <option value="">請選擇</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === "number" ? "number" : "text"}
              value={values[field.key] ?? field.defaultValue ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              readOnly={field.readOnly}
              placeholder={field.placeholder}
              className="flex-1 rounded-md border border-cy-border bg-cy-input px-3 py-1.5 text-sm text-cy-text focus:border-cy-accent focus:outline-none read-only:opacity-50"
            />
          )}
        </div>
      ))}
    </div>
  );
}
