import { Fragment } from 'react';
import { Icon } from '../components/Icon';

type FlowStep = { title: string; body: string; icon: string };

const NEW_USER_FLOW: FlowStep[] = [
  { title: '1. Signup',     body: 'OAuth · email · magic link',     icon: 'link' },
  { title: '2. Verify',     body: 'Email verification pending',     icon: 'check' },
  { title: '3. Workspace',  body: 'Agency vs Business',             icon: 'users' },
  { title: '4. Details',    body: 'Name, logo, tz',                 icon: 'gear' },
  { title: '5. Meta',       body: 'OAuth + select Pages',           icon: 'link' },
  { title: '6. Client',     body: 'Add + scrape site',              icon: 'users' },
  { title: '7. Team',       body: 'Invite seats',                   icon: 'users' },
  { title: '8. Overview',   body: 'First dashboard view',           icon: 'home' },
];

const DAILY_OPERATOR_FLOW: FlowStep[] = [
  { title: 'Add client',           body: 'Right drawer · 4 steps',        icon: 'plus' },
  { title: 'Scrape site',          body: 'Select pages · ~3m',            icon: 'refresh' },
  { title: 'Scrape competitors',   body: '3 domains · AI analysis',       icon: 'brain' },
  { title: 'Connect META',         body: 'OAuth · select accounts',       icon: 'link' },
  { title: 'Ad Studio',            body: 'AI-grounded variants',          icon: 'sparkles' },
  { title: 'Approve',              body: 'Side-by-side review',           icon: 'check' },
  { title: 'Bulk schedule',        body: 'FB + IG routing',               icon: 'queue' },
  { title: 'Monitor',              body: 'Ad Performance + alerts',       icon: 'chart' },
];

function Flow({ steps }: { steps: FlowStep[] }) {
  return (
    <div className="row gap-8" style={{ overflowX: 'auto', padding: '4px 0' }}>
      {steps.map((s, i) => (
        <Fragment key={s.title}>
          <div className="card card-pad stack gap-6" style={{ minWidth: 180, flex: 1 }}>
            <div className="row gap-6">
              <div className="ph" style={{ width: 24, height: 24 }}>
                <Icon name={s.icon} size={12} />
              </div>
              <span className="meta" style={{ fontSize: 11 }}>
                Step {i + 1}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
            <div className="meta" style={{ fontSize: 11 }}>
              {s.body}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ color: 'var(--fg-3)', alignSelf: 'center' }}>→</div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

export function Golden() {
  return (
    <div className="content wide">
      <div className="stack gap-8" style={{ marginBottom: 20 }}>
        <span className="anno">WIREFRAME · Golden-path flows</span>
        <h1 className="h0">Two end-to-end flows</h1>
      </div>

      <div className="card card-pad-lg stack gap-16" style={{ marginBottom: 24 }}>
        <div className="stack gap-4">
          <span className="h2">New user flow</span>
          <span className="meta">
            Signup (Supabase OAuth) → email verify → onboarding 1–6 → first overview view
          </span>
        </div>
        <Flow steps={NEW_USER_FLOW} />
      </div>

      <div className="card card-pad-lg stack gap-16">
        <div className="stack gap-4">
          <span className="h2">Daily operator flow</span>
          <span className="meta">
            Onboard client → scrape site + competitors → connect META → generate ads → approve →
            bulk-schedule to FB + IG
          </span>
        </div>
        <Flow steps={DAILY_OPERATOR_FLOW} />
        <div className="divider" />
        <div className="meta">
          All long-running jobs (META refresh, bulk scrape, AI generation) surface the Progress
          Banner + top-bar notification bell. Approvals are gated — the Publishing Queue header
          shows "🔒 Auto-publish is off".
        </div>
      </div>
    </div>
  );
}
