"use client";
import { useState } from "react";

type Field = { key: string; label: string; multiline?: boolean };

export default function InlineEdit({
  initial,
  fields,
  onSave,
  onCancel,
}: {
  initial: Record<string, string>;
  fields: Field[];
  onSave: (v: Record<string, string>) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-xs text-zinc-400">{f.label}</span>
          {f.multiline ? (
            <textarea
              value={v[f.key] ?? ""}
              rows={6}
              onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
              className="mt-1 w-full rounded bg-zinc-800 px-3 py-2 text-sm"
            />
          ) : (
            <input
              value={v[f.key] ?? ""}
              onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
              className="mt-1 w-full rounded bg-zinc-800 px-3 py-2 text-sm"
            />
          )}
        </label>
      ))}
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(v);
            } finally {
              setBusy(false);
            }
          }}
          className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium disabled:opacity-50"
        >
          Сохранить
        </button>
        {onCancel && (
          <button onClick={onCancel} className="flex-1 rounded-lg bg-zinc-700 py-2 text-sm">
            Отмена
          </button>
        )}
      </div>
    </div>
  );
}
