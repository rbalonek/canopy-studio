import { Bars } from '../components/Bars';
import { Delta } from '../components/Delta';
import { Icon } from '../components/Icon';
import { Spark } from '../components/Spark';

type Usage = {
  title: string;
  value: string;
  cap: string;
  percent: number;
  delta: number;
  warn?: boolean;
};

type Invoice = {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: 'Paid' | 'Open' | 'Past due' | 'Refunded';
};

const USAGE: Usage[] = [
  { title: 'AI generation spend', value: '$184', cap: '$400 soft · $600 hard', percent: 46, delta: 12.1 },
  { title: 'Scheduled posts',     value: '142',  cap: '500 soft · 800 hard',   percent: 28, delta: 8.4 },
  { title: 'Scraped pages',       value: '284',  cap: '300 soft · 500 hard',   percent: 94, delta: 22.5, warn: true },
];

const PAYMENT_METHODS = [
  { brand: 'Visa',       last4: '•••• 4242', exp: '09/28', def: true  },
  { brand: 'Mastercard', last4: '•••• 8821', exp: '03/27', def: false },
];

const INVOICES: Invoice[] = [
  { id: 'INV-20250412', date: 'Apr 12', description: 'Growth plan · Apr cycle',  amount: '$482.00', status: 'Past due' },
  { id: 'INV-20250312', date: 'Mar 12', description: 'Growth plan · Mar cycle',  amount: '$482.00', status: 'Paid' },
  { id: 'INV-20250212', date: 'Feb 12', description: 'Growth plan · Feb cycle',  amount: '$482.00', status: 'Paid' },
  { id: 'INV-20250112', date: 'Jan 12', description: 'Starter plan · Jan cycle', amount: '$148.00', status: 'Paid' },
  { id: 'INV-20241212', date: 'Dec 12', description: 'Starter plan · Dec cycle', amount: '$148.00', status: 'Refunded' },
];

const INVOICE_PILL: Record<Invoice['status'], string> = {
  'Past due': 'red',
  Paid: 'green',
  Open: 'amber',
  Refunded: 'gray',
};

const TAX_DETAILS: [string, string][] = [
  ['Billing email', 'billing@redwood.co'],
  ['Company legal name', 'Redwood Digital Strategies LLC'],
  ['Address', '284 Ember Row, Portland OR 97204'],
  ['VAT / Tax ID', '—'],
  ['Currency', 'USD'],
];

const SPEND_CATEGORIES = [
  { name: 'OpenAI',           color: 'var(--accent)' },
  { name: 'Claude',           color: 'var(--ai)' },
  { name: 'DALL-E',           color: '#F59E0B' },
  { name: 'Meta scheduling',  color: '#10B981' },
  { name: 'Scraping',         color: '#EF4444' },
];

export function Billing() {
  return (
    <div className="content wide">
      <div className="banner red" style={{ marginBottom: 16 }}>
        <Icon name="warn" size={14} />
        <span>Invoice INV-20250412 is 9 days past due · $482.00</span>
        <div style={{ flex: 1 }} />
        <button className="btn sm">Update payment</button>
        <button className="btn primary sm">Pay now →</button>
      </div>

      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4">
          <h1 className="h0">Billing</h1>
          <span className="meta">Plan · usage · payments · invoices · tax details</span>
        </div>
      </div>

      <div className="stack gap-16">
        <div className="card">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="h2">Plan</span>
            <button className="btn">Change plan</button>
          </div>
          <div className="grid grid-4 gap-16" style={{ padding: 20 }}>
            <div className="stack gap-4">
              <span className="meta">Current plan</span>
              <div style={{ fontSize: 20, fontWeight: 600 }}>Growth</div>
              <span className="pill teal">
                <span className="dot" />
                Active
              </span>
            </div>
            <div className="stack gap-4">
              <span className="meta">Seats</span>
              <div style={{ fontSize: 20, fontWeight: 600 }}>4 / 10</div>
              <span className="meta">6 available</span>
            </div>
            <div className="stack gap-4">
              <span className="meta">Renewal</span>
              <div style={{ fontSize: 20, fontWeight: 600 }}>May 12</div>
              <span className="meta">21 days</span>
            </div>
            <div className="stack gap-4">
              <span className="meta">Price</span>
              <div style={{ fontSize: 20, fontWeight: 600 }}>$248/mo</div>
              <span className="meta">Billed monthly</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="h2">Usage this cycle</span>
            <a className="meta" style={{ color: 'var(--accent)' }}>
              Export CSV →
            </a>
          </div>
          <div className="grid grid-3 gap-16" style={{ padding: 20, gap: 20 }}>
            {USAGE.map((u, i) => (
              <div key={u.title} className="stack gap-6">
                <div className="row between">
                  <span className="meta">{u.title}</span>
                  <Delta v={u.delta} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>{u.value}</div>
                <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 999 }}>
                  <div
                    style={{
                      width: `${u.percent}%`,
                      height: '100%',
                      background: u.warn ? 'var(--amber)' : 'var(--accent)',
                      borderRadius: 999,
                    }}
                  />
                </div>
                <span className="meta" style={{ fontSize: 11 }}>
                  {u.cap}
                </span>
                <Spark seed={i + 2} w={180} h={22} />
                {u.warn && (
                  <div className="banner amber" style={{ padding: '6px 8px', fontSize: 12 }}>
                    94% of soft cap — upgrade to Agency for unlimited scrapes.
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: 20, borderTop: '1px solid var(--border)' }}>
            <div className="meta" style={{ marginBottom: 8 }}>
              Daily spend by category
            </div>
            <Bars h={140} n={21} seed={4} />
            <div className="row gap-12 meta" style={{ marginTop: 8, fontSize: 11 }}>
              {SPEND_CATEGORIES.map((c) => (
                <span key={c.name} className="row gap-4">
                  <div
                    style={{ width: 8, height: 8, borderRadius: 2, background: c.color }}
                  />
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="h2">Payment methods</span>
            <button className="btn sm">
              <Icon name="plus" size={12} /> Add method
            </button>
          </div>
          {PAYMENT_METHODS.map((c, i) => (
            <div
              key={`${c.brand}-${c.last4}`}
              className="row between"
              style={{ padding: 16, borderBottom: i === 0 ? '1px solid var(--border)' : 0 }}
            >
              <div className="row gap-12">
                <div className="ph" style={{ width: 40, height: 28, borderRadius: 4 }}>
                  {c.brand.slice(0, 2)}
                </div>
                <div className="stack">
                  <span style={{ fontWeight: 500 }}>
                    {c.brand} {c.last4}
                  </span>
                  <span className="meta">Expires {c.exp}</span>
                </div>
                {c.def && (
                  <span className="pill teal">
                    <span className="dot" />
                    Default
                  </span>
                )}
              </div>
              <div className="row gap-8">
                {!c.def && <button className="btn ghost sm">Set default</button>}
                <button className="btn ghost sm danger">Remove</button>
              </div>
            </div>
          ))}
          <div
            style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}
            className="meta"
          >
            🔒 Payments processed securely · SSL encryption
          </div>
        </div>

        <div className="card">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="h2">Invoices &amp; receipts</span>
            <div className="row gap-8">
              {['All', 'Paid', 'Open', 'Past due'].map((f, i) => (
                <span key={f} className={`pill ${i === 0 ? 'teal' : ''}`}>
                  {i === 0 && <span className="dot" />}
                  {f}
                </span>
              ))}
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {INVOICES.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td className="meta">{r.date}</td>
                  <td>{r.description}</td>
                  <td>{r.amount}</td>
                  <td>
                    <span className={`pill ${INVOICE_PILL[r.status]}`}>
                      <span className="dot" />
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <div className="row gap-4">
                      <button className="btn ghost sm">View</button>
                      <button className="btn ghost sm">PDF</button>
                      {r.status === 'Past due' && (
                        <button className="btn primary sm">Pay now</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="h2">Tax &amp; billing details</span>
          </div>
          <div className="grid grid-2 gap-16" style={{ padding: 20, gap: 16 }}>
            {TAX_DETAILS.map(([k, v]) => (
              <div key={k} className="stack gap-4">
                <span className="meta">{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn sm">Edit details</button>
          </div>
        </div>

        <div className="card bdr-amber" style={{ background: 'rgba(245,158,11,0.05)' }}>
          <div className="card-pad stack gap-8">
            <div className="row between">
              <span style={{ fontWeight: 500 }}>✦ Approaching your scrape limit</span>
              <span className="pill amber">
                <span className="dot" />
                94%
              </span>
            </div>
            <div className="meta">
              Upgrade to Agency for unlimited scraping + 25 seats. Saves $2,400/year vs. overage.
            </div>
            <div className="row gap-8">
              <button className="btn primary sm">Upgrade to Agency →</button>
              <button className="btn ghost sm">Compare plans</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="h2">Pay outstanding balance</span>
            <span className="meta">Secure hosted checkout</span>
          </div>
          <div style={{ padding: 20 }}>
            <div
              className="card card-pad stack gap-10"
              style={{ maxWidth: 440, margin: '0 auto', background: 'var(--bg-2)' }}
            >
              <div className="row between">
                <span style={{ fontWeight: 500 }}>Pay $482.00 USD</span>
                <Icon name="close" size={14} />
              </div>
              <div className="ph" style={{ height: 36 }}>
                Card number
              </div>
              <div className="row gap-8">
                <div className="ph" style={{ height: 36, flex: 1 }}>
                  MM / YY
                </div>
                <div className="ph" style={{ height: 36, flex: 1 }}>
                  CVC
                </div>
                <div className="ph" style={{ height: 36, flex: 1 }}>
                  ZIP
                </div>
              </div>
              <button className="btn primary" style={{ padding: 10 }}>
                Pay $482.00
              </button>
              <span className="meta" style={{ textAlign: 'center' }}>
                🔒 Encrypted checkout modal
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
