import { useState } from 'react';
import { Empty } from '../components/Empty';
import { Icon } from '../components/Icon';

type TabId =
  | 'account'
  | 'workspace'
  | 'team'
  | 'connections'
  | 'billing'
  | 'api'
  | 'notifications'
  | 'excluded accounts';

const TABS: TabId[] = [
  'account',
  'workspace',
  'team',
  'connections',
  'billing',
  'api',
  'notifications',
  'excluded accounts',
];

type Connection = {
  name: string;
  status: string;
  clients: number;
  last: string;
  connected: boolean;
};

const CONNECTIONS: Connection[] = [
  { name: 'Meta (Facebook + Instagram)', status: 'Connected',   clients: 9, last: 'Refreshed 8m ago', connected: true },
  { name: 'Google Ads',                  status: 'Coming soon', clients: 0, last: '—',               connected: false },
  { name: 'TikTok Ads',                  status: 'Coming soon', clients: 0, last: '—',               connected: false },
  { name: 'LinkedIn Ads',                status: 'Coming soon', clients: 0, last: '—',               connected: false },
];

export function Settings() {
  const [tab, setTab] = useState<TabId>('connections');

  return (
    <div className="content wide">
      <h1 className="h0" style={{ marginBottom: 16 }}>
        Settings
      </h1>
      <div className="grid" style={{ gridTemplateColumns: '200px 1fr', gap: 20 }}>
        <div className="stack gap-4">
          {TABS.map((t) => (
            <div
              key={t}
              className={`nav-item ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
              style={{ textTransform: 'capitalize' }}
            >
              {t}
            </div>
          ))}
        </div>
        <div>
          {tab === 'connections' ? (
            <div className="stack gap-16">
              <div className="card">
                <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="h2">Connections</span>
                  <button className="btn sm">+ Connect new</button>
                </div>
                {CONNECTIONS.map((c, i) => (
                  <div
                    key={c.name}
                    className="row between"
                    style={{
                      padding: 16,
                      borderBottom: i < CONNECTIONS.length - 1 ? '1px solid var(--border)' : 0,
                    }}
                  >
                    <div className="row gap-12">
                      <div className="ph" style={{ width: 36, height: 36 }} />
                      <div className="stack">
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                        <span className="meta">
                          {c.status} · {c.clients} clients · {c.last}
                        </span>
                      </div>
                    </div>
                    {c.connected ? (
                      <div className="row gap-8">
                        <button className="btn sm">
                          <Icon name="refresh" size={12} /> Refresh
                        </button>
                        <button className="btn ghost sm">Manage</button>
                      </div>
                    ) : (
                      <button className="btn sm" disabled style={{ opacity: 0.5 }}>
                        Notify me
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Empty title={`${tab} — wireframe`} body="Form-based settings panel following shell conventions." />
          )}
        </div>
      </div>
    </div>
  );
}
