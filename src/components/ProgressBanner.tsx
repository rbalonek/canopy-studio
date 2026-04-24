import { AIBadge } from './AIBadge';

type Props = {
  label: string;
  pct?: number;
  eta?: string;
};

export function ProgressBanner({ label, pct = 42, eta = '~4m' }: Props) {
  return (
    <div className="banner ai" style={{ gap: 16 }}>
      <AIBadge />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{label}</div>
        <div
          style={{
            marginTop: 6,
            height: 4,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 999,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'var(--ai)',
              borderRadius: 999,
            }}
          />
        </div>
      </div>
      <span className="meta">
        {pct}% · {eta}
      </span>
      <a className="btn sm ghost" style={{ color: 'var(--ai-2)' }}>
        Notify me
      </a>
    </div>
  );
}
