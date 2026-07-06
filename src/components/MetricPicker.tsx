import { useEffect, useRef, useState } from 'react';
import { METRICS, type MetricGroup } from '../lib/metaMetrics';

const GROUP_ORDER: MetricGroup[] = ['Core', 'Conversions', 'Engagement', 'Efficiency'];

/** Selection persisted to localStorage, seeded from `defaults` on first use.
 * Unknown/removed keys are dropped so a stale saved list can't break. */
export function usePersistentSelection(
  storageKey: string,
  defaults: string[],
): [string[], (keys: string[]) => void] {
  const valid = new Set(METRICS.map((m) => m.key));
  const [keys, setKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        const filtered = parsed.filter((k) => valid.has(k));
        if (filtered.length) return filtered;
      }
    } catch {
      // ignore malformed storage
    }
    return defaults;
  });
  const update = (next: string[]) => {
    setKeys(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore quota/serialization errors
    }
  };
  return [keys, update];
}

/** Dropdown of grouped metric checkboxes. `selected` is an ordered list of
 * metric keys; toggling preserves catalog order and keeps at least one. */
export function MetricPicker({
  selected,
  onChange,
  label = 'Metrics',
}: {
  selected: string[];
  onChange: (keys: string[]) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const sel = new Set(selected);
  const toggle = (key: string) => {
    if (sel.has(key)) {
      if (selected.length <= 1) return; // keep at least one
      onChange(selected.filter((k) => k !== key));
    } else {
      // keep catalog order in the resulting list
      const next = new Set(sel);
      next.add(key);
      onChange(METRICS.filter((m) => next.has(m.key)).map((m) => m.key));
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn ghost sm" onClick={() => setOpen((v) => !v)}>
        {label} · {selected.length}
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 30,
            width: 260,
            maxHeight: 360,
            overflowY: 'auto',
            padding: 8,
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          }}
        >
          {GROUP_ORDER.map((group) => {
            const items = METRICS.filter((m) => m.group === group);
            if (!items.length) return null;
            return (
              <div key={group} style={{ marginBottom: 6 }}>
                <div
                  className="meta"
                  style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 6px' }}
                >
                  {group}
                </div>
                {items.map((m) => (
                  <label
                    key={m.key}
                    className="row gap-8"
                    style={{
                      padding: '5px 6px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sel.has(m.key)}
                      onChange={() => toggle(m.key)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontSize: 13 }}>{m.label}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
