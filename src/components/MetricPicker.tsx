import { useEffect, useRef, useState } from 'react';
import { METRICS, type MetricDef, type MetricGroup } from '../lib/metaMetrics';

const GROUP_ORDER: MetricGroup[] = ['Core', 'Conversions', 'Engagement', 'Efficiency', 'More actions'];

/** Selection persisted to localStorage, seeded from `defaults` on first use.
 * Dynamic (auto-discovered) keys are kept verbatim; the view drops any that
 * aren't available for the current data at render time. */
export function usePersistentSelection(
  storageKey: string,
  defaults: string[],
): [string[], (keys: string[]) => void] {
  const [keys, setKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed) && parsed.length) return parsed.filter((k) => typeof k === 'string');
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

/** Dropdown of grouped metric checkboxes. `metrics` is the full available set
 * (curated + auto-discovered); `selected` is an ordered list of keys. */
export function MetricPicker({
  selected,
  onChange,
  metrics = METRICS,
  label = 'Metrics',
}: {
  selected: string[];
  onChange: (keys: string[]) => void;
  metrics?: MetricDef[];
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

  const order = metrics.map((m) => m.key);
  const sel = new Set(selected);
  const toggle = (key: string) => {
    if (sel.has(key)) {
      if (selected.length <= 1) return; // keep at least one
      onChange(selected.filter((k) => k !== key));
    } else {
      const next = new Set(sel);
      next.add(key);
      onChange(order.filter((k) => next.has(k)));
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
            width: 280,
            maxHeight: 400,
            overflowY: 'auto',
            padding: 8,
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          }}
        >
          {GROUP_ORDER.map((group) => {
            const items = metrics.filter((m) => m.group === group);
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
                    style={{ padding: '5px 6px', borderRadius: 6, cursor: 'pointer', alignItems: 'center' }}
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
