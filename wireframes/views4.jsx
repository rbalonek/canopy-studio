// CanopyStudio — views part 4: Billing, Auth, Onboarding, Golden-path flows

const ViewBilling = () => (
  <div className="content wide">
    <div className="banner red" style={{ marginBottom: 16 }}>
      <Icon name="warn" size={14} />
      <span>Invoice INV-20250412 is 9 days past due · $482.00</span>
      <div style={{ flex: 1 }} />
      <button className="btn sm">Update payment</button>
      <button className="btn primary sm">Pay now →</button>
    </div>

    <div className="row between" style={{ marginBottom: 16 }}>
      <div className="stack gap-4"><h1 className="h0">Billing</h1><span className="meta">Plan · usage · payments · invoices · tax details</span></div>
    </div>

    <div className="stack gap-16">
      <div className="card">
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}><span className="h2">Plan</span><button className="btn">Change plan</button></div>
        <div className="grid grid-4 gap-16" style={{ padding: 20 }}>
          <div className="stack gap-4"><span className="meta">Current plan</span><div style={{ fontSize: 20, fontWeight: 600 }}>Growth</div><span className="pill teal"><span className="dot" />Active</span></div>
          <div className="stack gap-4"><span className="meta">Seats</span><div style={{ fontSize: 20, fontWeight: 600 }}>4 / 10</div><span className="meta">6 available</span></div>
          <div className="stack gap-4"><span className="meta">Renewal</span><div style={{ fontSize: 20, fontWeight: 600 }}>May 12</div><span className="meta">21 days</span></div>

          <div className="stack gap-4"><span className="meta">Price</span><div style={{ fontSize: 20, fontWeight: 600 }}>$248/mo</div><span className="meta">Billed monthly</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}><span className="h2">Usage this cycle</span><a className="meta" style={{ color: 'var(--accent)' }}>Export CSV →</a></div>
        <div className="grid grid-3 gap-16" style={{ padding: 20, gap: 20 }}>
          {[
            { t: 'AI generation spend', v: '$184', cap: '$400 soft · $600 hard', p: 46, d: 12.1 },
            { t: 'Scheduled posts', v: '142', cap: '500 soft · 800 hard', p: 28, d: 8.4 },
            { t: 'Scraped pages', v: '284', cap: '300 soft · 500 hard', p: 94, d: 22.5, warn: true },
          ].map((u,i) => (
            <div key={i} className="stack gap-6">
              <div className="row between"><span className="meta">{u.t}</span><Delta v={u.d} /></div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{u.v}</div>
              <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 999 }}><div style={{ width: u.p + '%', height: '100%', background: u.warn ? 'var(--amber)' : 'var(--accent)', borderRadius: 999 }} /></div>
              <span className="meta" style={{ fontSize: 11 }}>{u.cap}</span>
              <Spark seed={i+2} w={180} h={22} />
              {u.warn && <div className="banner amber" style={{ padding: '6px 8px', fontSize: 12 }}>94% of soft cap — upgrade to Agency for unlimited scrapes.</div>}
            </div>
          ))}
        </div>
        <div style={{ padding: 20, borderTop: '1px solid var(--border)' }}>
          <div className="meta" style={{ marginBottom: 8 }}>Daily spend by category</div>
          <Bars h={140} n={21} seed={4} />
          <div className="row gap-12 meta" style={{ marginTop: 8, fontSize: 11 }}>
            {['OpenAI','Claude','DALL-E','Meta scheduling','Scraping'].map((c,i) => <span key={c} className="row gap-4"><div style={{ width: 8, height: 8, borderRadius: 2, background: ['var(--accent)','var(--ai)','#F59E0B','#10B981','#EF4444'][i] }} />{c}</span>)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}><span className="h2">Payment methods</span><button className="btn sm"><Icon name="plus" size={12} /> Add method</button></div>
        {[
          { b: 'Visa', l: '•••• 4242', exp: '09/28', def: true },
          { b: 'Mastercard', l: '•••• 8821', exp: '03/27' },
        ].map((c,i) => (
          <div key={i} className="row between" style={{ padding: 16, borderBottom: i === 0 ? '1px solid var(--border)' : 0 }}>
            <div className="row gap-12"><div className="ph" style={{ width: 40, height: 28, borderRadius: 4 }}>{c.b.slice(0,2)}</div><div className="stack"><span style={{ fontWeight: 500 }}>{c.b} {c.l}</span><span className="meta">Expires {c.exp}</span></div>{c.def && <span className="pill teal"><span className="dot" />Default</span>}</div>
            <div className="row gap-8">{!c.def && <button className="btn ghost sm">Set default</button>}<button className="btn ghost sm danger">Remove</button></div>
          </div>
        ))}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }} className="meta">🔒 Payments processed securely · SSL encryption</div>
      </div>

      <div className="card">
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Invoices & receipts</span>
          <div className="row gap-8">{['All','Paid','Open','Past due'].map((f,i) => <span key={f} className={`pill ${i===0?'teal':''}`}>{i===0 && <span className="dot" />}{f}</span>)}</div>
        </div>
        <table className="tbl">
          <thead><tr><th>Invoice #</th><th>Date</th><th>Description</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {[
              { id: 'INV-20250412', d: 'Apr 12', desc: 'Growth plan · Apr cycle', a: '$482.00', s: 'Past due' },
              { id: 'INV-20250312', d: 'Mar 12', desc: 'Growth plan · Mar cycle', a: '$482.00', s: 'Paid' },
              { id: 'INV-20250212', d: 'Feb 12', desc: 'Growth plan · Feb cycle', a: '$482.00', s: 'Paid' },
              { id: 'INV-20250112', d: 'Jan 12', desc: 'Starter plan · Jan cycle', a: '$148.00', s: 'Paid' },
              { id: 'INV-20241212', d: 'Dec 12', desc: 'Starter plan · Dec cycle', a: '$148.00', s: 'Refunded' },
            ].map((r,i) => {
              const col = { 'Past due':'red','Paid':'green','Open':'amber','Refunded':'gray' }[r.s];
              return <tr key={i}><td className="mono">{r.id}</td><td className="meta">{r.d}</td><td>{r.desc}</td><td>{r.a}</td><td><span className={`pill ${col}`}><span className="dot" />{r.s}</span></td><td><div className="row gap-4"><button className="btn ghost sm">View</button><button className="btn ghost sm">PDF</button>{r.s==='Past due' && <button className="btn primary sm">Pay now</button>}</div></td></tr>;
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}><span className="h2">Tax & billing details</span></div>
        <div className="grid grid-2 gap-16" style={{ padding: 20, gap: 16 }}>
          {[['Billing email','billing@redwood.co'],['Company legal name','Redwood Digital Strategies LLC'],['Address','284 Ember Row, Portland OR 97204'],['VAT / Tax ID','—'],['Currency','USD']].map(([k,v]) => (
            <div key={k} className="stack gap-4"><span className="meta">{k}</span><span>{v}</span></div>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}><button className="btn sm">Edit details</button></div>
      </div>

      <div className="card bdr-amber" style={{ background: 'rgba(245,158,11,0.05)' }}>
        <div className="card-pad stack gap-8">
          <div className="row between"><span style={{ fontWeight: 500 }}>✦ Approaching your scrape limit</span><span className="pill amber"><span className="dot" />94%</span></div>
          <div className="meta">Upgrade to Agency for unlimited scraping + 25 seats. Saves $2,400/year vs. overage.</div>
          <div className="row gap-8"><button className="btn primary sm">Upgrade to Agency →</button><button className="btn ghost sm">Compare plans</button></div>
        </div>
      </div>

      <div className="card">
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}><span className="h2">Pay outstanding balance</span><span className="meta">Secure hosted checkout</span></div>
        <div style={{ padding: 20 }}>
          <div className="card card-pad stack gap-10" style={{ maxWidth: 440, margin: '0 auto', background: 'var(--bg-2)' }}>
            <div className="row between"><span style={{ fontWeight: 500 }}>Pay $482.00 USD</span><Icon name="close" size={14} /></div>
            <div className="ph" style={{ height: 36 }}>Card number</div>
            <div className="row gap-8"><div className="ph" style={{ height: 36, flex: 1 }}>MM / YY</div><div className="ph" style={{ height: 36, flex: 1 }}>CVC</div><div className="ph" style={{ height: 36, flex: 1 }}>ZIP</div></div>
            <button className="btn primary" style={{ padding: 10 }}>Pay $482.00</button>
            <span className="meta" style={{ textAlign: 'center' }}>🔒 Encrypted checkout modal</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ViewAuth = () => {
  const [mode, setMode] = React.useState('signup');
  return (
    <div style={{ position: 'relative', margin: -24, minHeight: 'calc(100vh - 56px)', display: 'grid', gridTemplateColumns: '60% 40%' }}>
      <div style={{ background: 'var(--bg)', padding: '48px 64px', display: 'flex', flexDirection: 'column' }}>
        <div className="row gap-8"><div className="logo-mark">R</div><span style={{ fontWeight: 500 }}>Redwood Digital Strategies</span></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 420 }}>
          <h1 className="h0" style={{ marginBottom: 6 }}>CanopyStudio</h1>
          <div className="meta" style={{ marginBottom: 28 }}>One canopy over all your paid and organic ads.</div>
          <div className="tabs" style={{ marginBottom: 20 }}>
            {['signup','login','reset','verify'].map(t => <div key={t} className={`tab ${mode===t?'on':''}`} onClick={() => setMode(t)} style={{ textTransform: 'capitalize' }}>{t}</div>)}
          </div>
          {mode === 'signup' && (
            <div className="stack gap-10">
              <button className="btn" style={{ justifyContent: 'center', padding: 10 }}>Continue with Google</button>
              <button className="btn" style={{ justifyContent: 'center', padding: 10 }}>Continue with Microsoft</button>
              <button className="btn" style={{ justifyContent: 'center', padding: 10 }}>Continue with Apple</button>
              <div className="row gap-8 meta" style={{ margin: '8px 0' }}><div style={{ flex: 1, height: 1, background: 'var(--border)' }} /><span>or</span><div style={{ flex: 1, height: 1, background: 'var(--border)' }} /></div>
              <div className="ph" style={{ height: 40 }}>Email</div>
              <div className="ph" style={{ height: 40 }}>Password</div>
              <label className="row gap-6 meta"><input type="checkbox" /> Email me a sign-in link instead</label>
              <button className="btn primary" style={{ justifyContent: 'center', padding: 10 }}>Create account</button>
              <div className="meta" style={{ textAlign: 'center' }}>Already have an account? <a style={{ color: 'var(--accent)' }} onClick={() => setMode('login')}>Log in</a></div>
              <div className="meta" style={{ fontSize: 11, textAlign: 'center', color: 'var(--fg-3)' }}>By continuing you agree to the Terms and Privacy Policy.</div>
            </div>
          )}
          {mode === 'login' && (
            <div className="stack gap-10">
              <button className="btn" style={{ justifyContent: 'center', padding: 10 }}>Continue with Google</button>
              <button className="btn" style={{ justifyContent: 'center', padding: 10 }}>Continue with Microsoft</button>
              <button className="btn" style={{ justifyContent: 'center', padding: 10 }}>Continue with Apple</button>
              <div className="row gap-8 meta" style={{ margin: '8px 0' }}><div style={{ flex: 1, height: 1, background: 'var(--border)' }} /><span>or</span><div style={{ flex: 1, height: 1, background: 'var(--border)' }} /></div>
              <div className="ph" style={{ height: 40 }}>Email</div>
              <div className="ph" style={{ height: 40 }}>Password</div>
              <a className="meta" style={{ textAlign: 'right', color: 'var(--accent)' }} onClick={() => setMode('reset')}>Forgot password?</a>
              <button className="btn primary" style={{ justifyContent: 'center', padding: 10 }}>Log in</button>
              <div className="meta" style={{ textAlign: 'center' }}>New here? <a style={{ color: 'var(--accent)' }} onClick={() => setMode('signup')}>Create an account</a></div>
            </div>
          )}
          {mode === 'reset' && (
            <div className="stack gap-12">
              <div className="meta">We'll email you a reset link.</div>
              <div className="ph" style={{ height: 40 }}>Email</div>
              <button className="btn primary" style={{ justifyContent: 'center', padding: 10 }}>Send reset link</button>
              <div className="banner" style={{ justifyContent: 'center' }}>✓ Check your inbox for a reset link</div>
            </div>
          )}
          {mode === 'verify' && (
            <div className="stack gap-12" style={{ textAlign: 'center' }}>
              <div className="ph" style={{ height: 120, width: 120, borderRadius: 16, margin: '0 auto' }}>📬</div>
              <div className="h2">Check your email</div>
              <div className="meta">We sent a link to <span style={{ color: 'var(--fg)' }}>jordan@redwood.co</span>. Click it to finish signing in.</div>
              <button className="btn ghost">Resend in 0:42</button>
              <div className="banner ai" style={{ justifyContent: 'center' }}>◌ Completing sign-in... (OAuth redirect loading state)</div>
            </div>
          )}
        </div>
        <div className="meta" style={{ fontSize: 11 }}>© 2025 Redwood Digital Strategies</div>
      </div>
      <div style={{ background: 'linear-gradient(180deg, var(--bg-1) 0%, rgba(6,182,164,0.12) 100%)', padding: 32, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ph" style={{ width: 280, height: 280, borderRadius: 16 }}>Redwood canopy illustration<br/>with data rings overlay</div>
        </div>
        <div className="card card-pad stack gap-8">
          <div className="meta">"CanopyStudio replaced four tools in our stack. Our agency saves 12 hours a week on reporting."</div>
          <div className="row gap-8"><div className="ph" style={{ width: 24, height: 24, borderRadius: 999 }} /><span className="meta">Maya H. · Redwood</span></div>
          <div className="row gap-4" style={{ justifyContent: 'center' }}>{[0,1,2].map(i => <div key={i} style={{ width: 18, height: 2, background: i===0?'var(--accent)':'var(--border)' }} />)}</div>
        </div>
        <div className="row gap-8" style={{ justifyContent: 'center', marginTop: 16 }}>
          <span className="tag">SOC 2 ready</span><span className="tag">Built on Supabase</span><span className="tag">Stripe-secured</span>
        </div>
      </div>
    </div>
  );
};

const ViewOnboard = () => {
  const [step, setStep] = React.useState(1);
  const steps = ['Welcome','Workspace details','Connect Meta','Add client','Invite team','Done'];
  return (
    <div className="content wide" style={{ maxWidth: 1100 }}>
      <div className="row between" style={{ marginBottom: 24 }}>
        <div className="row gap-8"><div className="logo-mark">C</div><span style={{ fontWeight: 500 }}>CanopyStudio</span></div>
        <a className="meta">Save and finish later →</a>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '220px 1fr', gap: 32 }}>
        <div className="stack gap-4">
          {steps.map((s,i) => (
            <div key={s} className="row gap-10" style={{ padding: '8px 0', cursor: 'pointer' }} onClick={() => setStep(i+1)}>
              <div style={{ width: 22, height: 22, borderRadius: 999, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: step === i+1 ? 'var(--accent)' : step > i+1 ? 'var(--bg-3)' : 'var(--bg-1)', color: step === i+1 ? '#04221F' : 'var(--fg-1)', fontWeight: 600 }}>{step > i+1 ? '✓' : i+1}</div>
              <span style={{ fontSize: 13, color: step === i+1 ? 'var(--fg)' : 'var(--fg-2)' }}>{s}</span>
            </div>
          ))}
        </div>

        <div className="card card-pad-lg" style={{ padding: 40 }}>
          {step === 1 && (
            <div className="stack gap-20">
              <h1 className="h0">How will you use CanopyStudio?</h1>
              <div className="meta">This drives how we label things (clients vs locations).</div>
              <div className="grid grid-2 gap-16" style={{ gap: 16 }}>
                <div className="card card-pad-lg stack gap-10 bdr-green" style={{ padding: 24, cursor: 'pointer', background: 'rgba(6,182,164,0.05)' }}>
                  <div className="ph" style={{ height: 80 }}>🏢🏢🏢 Agency</div>
                  <div style={{ fontWeight: 500, fontSize: 16 }}>Agency</div>
                  <div className="meta">We manage many clients. Some of our clients are multi-location.</div>
                </div>
                <div className="card card-pad-lg stack gap-10" style={{ padding: 24, cursor: 'pointer' }}>
                  <div className="ph" style={{ height: 80 }}>🏪 📍📍 Business</div>
                  <div style={{ fontWeight: 500, fontSize: 16 }}>Single business with locations</div>
                  <div className="meta">We run one business with multiple locations.</div>
                </div>
              </div>
              <div className="row between"><span /><button className="btn primary" onClick={()=>setStep(2)}>Continue →</button></div>
            </div>
          )}
          {step === 2 && (
            <div className="stack gap-16">
              <h1 className="h0">Workspace details</h1>
              <div className="grid grid-2 gap-16">
                <div className="stack gap-4"><span className="meta">Workspace name</span><div className="ph" style={{ height: 40 }}>Redwood Digital</div></div>
                <div className="stack gap-4"><span className="meta">Industry</span><div className="ph" style={{ height: 40 }}>Marketing agency</div></div>
                <div className="stack gap-4"><span className="meta">Primary timezone</span><div className="ph" style={{ height: 40 }}>America/Los_Angeles</div></div>
                <div className="stack gap-4"><span className="meta">Number of clients</span><div className="seg">{['1–5','6–20','21–50','50+'].map((b,i)=><button key={b} className={i===1?'on':''}>{b}</button>)}</div></div>
              </div>
              <div className="stack gap-4"><span className="meta">Logo</span><div className="ph" style={{ height: 120, borderRadius: 8 }}>Drag + drop or browse</div></div>
              <div className="row between"><button className="btn ghost" onClick={()=>setStep(1)}>← Back</button><button className="btn primary" onClick={()=>setStep(3)}>Continue →</button></div>
            </div>
          )}
          {step === 3 && (
            <div className="stack gap-16">
              <h1 className="h0">Connect Meta</h1>
              <div className="meta">Authorize once per ad account, then we sync performance every hour.</div>
              <div className="ph" style={{ height: 140 }}>Meta connect illustration</div>
              <div className="stack gap-8">
                {[{t:'Authenticate with Facebook',done:true},{t:'Select Pages',done:true},{t:'Confirm Instagram Business accounts',done:false,on:true}].map((s,i)=>(
                  <div key={i} className="row gap-8" style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 6, background: s.on ? 'var(--bg-2)' : 'var(--bg-1)' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 999, background: s.done ? 'var(--accent)' : 'var(--bg-3)', color: '#04221F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{s.done ? '✓' : i+1}</div>
                    <span style={{ fontSize: 13, flex: 1 }}>{s.t}</span>
                    {s.on && <button className="btn primary sm">Continue</button>}
                  </div>
                ))}
              </div>
              <div className="meta">Discovered <b>3 Pages</b> · <b>2 IG Business accounts</b>. Choose which to import.</div>
              <div className="grid grid-3 gap-8">{['Acme Dental — Downtown','Acme Dental — Midtown','Acme Dental — Westside'].map(n=><div key={n} className="card card-pad row gap-8"><input type="checkbox" defaultChecked /><span style={{ fontSize: 13 }}>{n}</span></div>)}</div>
              <div className="row between"><button className="btn ghost" onClick={()=>setStep(2)}>← Back</button><div className="row gap-8"><button className="btn ghost" onClick={()=>setStep(4)}>Skip for now</button><button className="btn primary" onClick={()=>setStep(4)}>Continue →</button></div></div>
            </div>
          )}
          {step === 4 && (
            <div className="stack gap-16">
              <h1 className="h0">Bring in a client</h1>
              <div className="grid grid-2 gap-16">
                <div className="stack gap-4"><span className="meta">Client name</span><div className="ph" style={{ height: 40 }}>Acme Dental</div></div>
                <div className="stack gap-4"><span className="meta">Industry</span><div className="ph" style={{ height: 40 }}>Dental / Healthcare</div></div>
                <div className="stack gap-4" style={{ gridColumn: '1/-1' }}><span className="meta">Website URL</span><div className="ph" style={{ height: 40 }}>https://acmedental.com</div></div>
              </div>
              <label className="row gap-8 meta"><input type="checkbox" defaultChecked /> Scrape site now (recommended)</label>
              <ProgressBanner label="Discovering pages on acmedental.com" pct={72} eta="~1m" />
              <div className="meta">Found 24 pages — select which to analyze:</div>
              <div className="card" style={{ maxHeight: 140, overflowY: 'auto' }}>
                {['/','/about','/services','/services/invisalign','/services/crowns','/locations/downtown','/blog/saturday-hours'].map(p=>(
                  <div key={p} className="row gap-8" style={{ padding: 8, borderBottom: '1px solid var(--border)' }}><input type="checkbox" defaultChecked /><span className="mono" style={{ fontSize: 12 }}>{p}</span></div>
                ))}
              </div>
              <a className="meta" style={{ color: 'var(--accent)' }}>+ Add another client</a>
              <div className="row between"><button className="btn ghost" onClick={()=>setStep(3)}>← Back</button><button className="btn primary" onClick={()=>setStep(5)}>Continue →</button></div>
            </div>
          )}
          {step === 5 && (
            <div className="stack gap-16">
              <h1 className="h0">Invite your team</h1>
              <div className="meta">Your Starter plan includes 3 seats. <a style={{ color: 'var(--accent)' }}>Upgrade for more</a></div>
              <div className="stack gap-8">
                <div className="row gap-8" style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6, flexWrap: 'wrap' }}>
                  <span className="pill">maya@redwood.co ·<button style={{ border: 0, background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer' }}>×</button></span>
                  <span className="pill">jamie@redwood.co ·<button style={{ border: 0, background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer' }}>×</button></span>
                  <span style={{ flex: 1, color: 'var(--fg-3)', fontSize: 13 }}>Add more emails…</span>
                </div>
                <div className="row gap-8"><span className="meta">Role:</span><div className="seg"><button>Owner</button><button className="on">Admin</button><button>Member</button><button>Viewer</button></div></div>
              </div>
              <div className="row between"><button className="btn ghost" onClick={()=>setStep(4)}>← Back</button><div className="row gap-8"><button className="btn ghost" onClick={()=>setStep(6)}>Skip for now</button><button className="btn primary" onClick={()=>setStep(6)}>Send invites →</button></div></div>
            </div>
          )}
          {step === 6 && (
            <div className="stack gap-16" style={{ textAlign: 'center', alignItems: 'center' }}>
              <div className="ph" style={{ width: 120, height: 120, borderRadius: 999 }}>🎉</div>
              <h1 className="h0">You're set up.</h1>
              <div className="meta" style={{ maxWidth: 400 }}>Your workspace is ready. Here's where to go next:</div>
              <div className="row gap-8"><button className="btn primary">Open overview</button><button className="btn">Create your first ad in Ad Studio</button><button className="btn ghost">Import posts from spreadsheet</button></div>
              <div className="card card-pad stack gap-6" style={{ maxWidth: 420, textAlign: 'left', marginTop: 12 }}>
                <div className="row between meta"><span>Setup checklist</span><span>2 of 4</span></div>
                {[['Workspace created',true],['Meta connected',true],['1 client added',true],['Invite teammates',false]].map(([t,d],i)=>(
                  <div key={i} className="row gap-8"><span style={{ color: d?'var(--accent)':'var(--fg-3)' }}>{d?'✓':'○'}</span><span style={{ fontSize: 13, flex: 1 }}>{t}</span>{!d && <a className="meta" style={{ color: 'var(--accent)' }}>Finish →</a>}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ViewGolden = () => (
  <div className="content wide">
    <div className="stack gap-8" style={{ marginBottom: 20 }}>
      <span className="anno">WIREFRAME · Golden-path flows</span>
      <h1 className="h0">Two end-to-end flows</h1>
    </div>

    {/* Flow 1 */}
    <div className="card card-pad-lg stack gap-16" style={{ marginBottom: 24 }}>
      <div className="stack gap-4"><span className="h2">New user flow</span><span className="meta">Signup (Supabase OAuth) → email verify → onboarding 1–6 → first overview view</span></div>
      <div className="row gap-8" style={{ overflowX: 'auto', padding: '4px 0' }}>
        {[
          { n: '1. Signup', b: 'OAuth · email · magic link', ic: 'link' },
          { n: '2. Verify', b: 'Email verification pending', ic: 'check' },
          { n: '3. Workspace', b: 'Agency vs Business', ic: 'users' },
          { n: '4. Details', b: 'Name, logo, tz', ic: 'gear' },
          { n: '5. Meta', b: 'OAuth + select Pages', ic: 'link' },
          { n: '6. Client', b: 'Add + scrape site', ic: 'users' },
          { n: '7. Team', b: 'Invite seats', ic: 'users' },
          { n: '8. Overview', b: 'First dashboard view', ic: 'home' },
        ].map((s,i) => (
          <React.Fragment key={i}>
            <div className="card card-pad stack gap-6" style={{ minWidth: 180, flex: 1 }}>
              <div className="row gap-6"><div className="ph" style={{ width: 24, height: 24 }}><Icon name={s.ic} size={12} /></div><span className="meta" style={{ fontSize: 11 }}>Step {i+1}</span></div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{s.n}</div>
              <div className="meta" style={{ fontSize: 11 }}>{s.b}</div>
            </div>
            {i < 7 && <div style={{ color: 'var(--fg-3)', alignSelf: 'center' }}>→</div>}
          </React.Fragment>
        ))}
      </div>
    </div>

    {/* Flow 2 */}
    <div className="card card-pad-lg stack gap-16">
      <div className="stack gap-4"><span className="h2">Daily operator flow</span><span className="meta">Onboard client → scrape site + competitors → connect META → generate ads → approve → bulk-schedule to FB + IG</span></div>
      <div className="row gap-8" style={{ overflowX: 'auto', padding: '4px 0' }}>
        {[
          { n: 'Add client', b: 'Right drawer · 4 steps', ic: 'plus' },
          { n: 'Scrape site', b: 'Select pages · ~3m', ic: 'refresh' },
          { n: 'Scrape competitors', b: '3 domains · AI analysis', ic: 'brain' },
          { n: 'Connect META', b: 'OAuth · select accounts', ic: 'link' },
          { n: 'Ad Studio', b: 'AI-grounded variants', ic: 'sparkles' },
          { n: 'Approve', b: 'Side-by-side review', ic: 'check' },
          { n: 'Bulk schedule', b: 'FB + IG routing', ic: 'queue' },
          { n: 'Monitor', b: 'Ad Performance + alerts', ic: 'chart' },
        ].map((s,i) => (
          <React.Fragment key={i}>
            <div className="card card-pad stack gap-6" style={{ minWidth: 180, flex: 1 }}>
              <div className="row gap-6"><div className="ph" style={{ width: 24, height: 24 }}><Icon name={s.ic} size={12} /></div><span className="meta" style={{ fontSize: 11 }}>Step {i+1}</span></div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{s.n}</div>
              <div className="meta" style={{ fontSize: 11 }}>{s.b}</div>
            </div>
            {i < 7 && <div style={{ color: 'var(--fg-3)', alignSelf: 'center' }}>→</div>}
          </React.Fragment>
        ))}
      </div>
      <div className="divider" />
      <div className="meta">All long-running jobs (META refresh, bulk scrape, AI generation) surface the Progress Banner + top-bar notification bell. Approvals are gated — the Publishing Queue header shows "🔒 Auto-publish is off".</div>
    </div>
  </div>
);

Object.assign(window, { ViewBilling, ViewAuth, ViewOnboard, ViewGolden });
