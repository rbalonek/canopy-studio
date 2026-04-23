// CanopyStudio — views part 2: Ad Performance, Content Calendar, Ad Studio

const ViewAdPerf = () => {
  const [sel, setSel] = React.useState('cmp');
  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <h1 className="h0">Ad Performance</h1>
        <div className="row gap-8">
          <button className="btn ghost"><Icon name="refresh" size={13} /> Refresh from META</button>
          <button className="btn ai"><Icon name="sparkles" size={13} /> AI analyze</button>
        </div>
      </div>

      <div className="row gap-8" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="meta">Filters:</span>
        {['Strategy: All','Status: Active','Spend > $500','Has conversions'].map(c => <span key={c} className="pill">{c}</span>)}
        <div style={{ flex: 1 }} />
        <a className="meta" style={{ color: 'var(--accent)', fontSize: 12 }}>Excluded accounts (7) →</a>
      </div>

      <div className="grid gap-16" style={{ gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* Tree */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 500 }}>Hierarchy</span>
            <Icon name="search" size={13} />
          </div>
          <div className="stack" style={{ padding: 8, fontSize: 13 }}>
            {[
              { lvl: 0, n: 'All clients', sp: '$94,842', ic: 'home' },
              { lvl: 1, n: 'Acme Dental', sp: '$18,420', ic: 'users' },
              { lvl: 2, n: 'act_139204882', sp: '$18,420', ic: 'chart', mono: true },
              { lvl: 3, n: 'Leads | ASO | Group Events | April 2025', sp: '$4,820', on: true, ic: 'bolt' },
              { lvl: 4, n: 'ASO — Broad', sp: '$2,410' },
              { lvl: 4, n: 'ASO — Lookalike 1%', sp: '$1,680' },
              { lvl: 4, n: 'ASO — Retargeting', sp: '$730' },
              { lvl: 3, n: 'Add to Cart | Birthdays | 2025', sp: '$2,104' },
              { lvl: 3, n: 'Purchase | Spring Sale | 2025', sp: '$8,612' },
              { lvl: 1, n: 'Seaside Yoga', sp: '$6,210', ic: 'users' },
              { lvl: 1, n: 'Northside Auto Group', sp: '$42,880', ic: 'users' },
            ].map((r, i) => (
              <div key={i} className={`tree-node ${r.on ? 'on' : ''}`} style={{ paddingLeft: 6 + r.lvl * 14 }} onClick={() => setSel('cmp')}>
                <span className="caret">{r.lvl < 4 ? '▸' : '·'}</span>
                {r.ic && <Icon name={r.ic} size={12} />}
                <span className={r.mono ? 'mono' : ''} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: r.mono ? 11 : 13 }}>{r.n}</span>
                <span className="sp">{r.sp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="stack gap-16">
          <div className="card">
            <div className="card-pad stack gap-8" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="row between">
                <div className="stack gap-4">
                  <div className="row gap-8">
                    <span className="h2">Leads | ASO | Group Events | April 2025</span>
                    <Strategy s="Lead Gen" /><Status s="Active" />
                  </div>
                  <div className="row gap-8 meta"><span className="mono">cmp_82910</span>·<span>Acme Dental</span>·<span>Last refresh 8m ago</span></div>
                </div>
                <div className="row gap-8">
                  <button className="btn ghost sm"><Icon name="refresh" size={12} /> Refresh</button>
                  <button className="btn ai sm"><Icon name="sparkles" size={12} /> AI analyze</button>
                </div>
              </div>
              <div className="seg">{['Yesterday','7d','30d','MTD','QTD','Custom'].map(p => <button key={p} className={p === 'MTD' ? 'on' : ''}>{p}</button>)}</div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(6,1fr)', gap: 1, background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
              {[
                { l: 'Spend', v: '$4,820', d: 12.4, sk: 1 },
                { l: 'Impressions', v: '284K', d: 6.2, sk: 2 },
                { l: 'Reach', v: '192K', d: 4.8, sk: 3 },
                { l: 'Clicks', v: '3,210', d: -3.1, sk: 4 },
                { l: 'CTR', v: '1.13%', d: -8.7, sk: 5 },
                { l: 'CPC', v: '$1.50', d: 2.1, sk: 6 },
                { l: 'CPM', v: '$16.97', d: 5.4, sk: 7 },
                { l: 'Conversions', v: '42', d: 18.3, sk: 8 },
                { l: 'Cost/Conv', v: '$115', d: -4.8, sk: 9 },
                { l: 'ROAS', v: '4.2×', d: 11.2, sk: 10 },
                { l: 'Quality', v: 'Avg', d: 0, sk: 11 },
                { l: 'Engagement', v: 'Above avg', d: 0, sk: 12 },
              ].map((k,i) => (
                <div key={i} className="stack gap-4" style={{ background: 'var(--bg-1)', padding: 12 }}>
                  <div className="row between">
                    <span className="meta" style={{ fontSize: 11 }}>{k.l}</span>
                    <Delta v={k.d} neutral={k.d===0} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
                  {k.d !== 0 && <DeltaSpark seed={k.sk} up={k.d >= 0} w={120} h={22} />}
                  {k.d === 0 && <div className="row gap-2" style={{ marginTop: 2 }}>{Array.from({ length: 5 }).map((_, j) => <div key={j} style={{ flex: 1, height: 4, background: j < 3 ? 'var(--accent)' : 'var(--bg-2)', borderRadius: 1 }} />)}</div>}
                </div>
              ))}
            </div>

            <div style={{ padding: 16 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>Spend + Conversions</span>
                <div className="row gap-8">
                  <label className="row gap-4 meta"><input type="checkbox" defaultChecked /> Prior period</label>
                  <label className="row gap-4 meta"><input type="checkbox" /> Siblings</label>
                </div>
              </div>
              <AreaChart h={200} seeds={[1, 4]} colors={['var(--accent)', 'var(--ai)']} />
              <div className="row gap-16" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div className="row gap-6" style={{ fontSize: 12 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} /><span>Spend</span><span className="meta" style={{ fontVariantNumeric: 'tabular-nums' }}>$4,820 MTD</span></div>
                <div className="row gap-6" style={{ fontSize: 12 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ai)', display: 'inline-block' }} /><span>Conversions</span><span className="meta" style={{ fontVariantNumeric: 'tabular-nums' }}>42 MTD</span></div>
              </div>
            </div>
          </div>

          <div className="ai-surface">
            <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="row gap-8"><span className="h2">AI Analysis</span><AIBadge /></div>
              <Icon name="chevd" size={14} />
            </div>
            <div className="stack" style={{ padding: 12, gap: 10 }}>
              <div className="card card-pad stack gap-6 bdr-red" style={{ background: 'var(--bg-2)' }}>
                <div className="row gap-8"><span className="pill red"><span className="dot" />High priority</span><span style={{ fontWeight: 500 }}>ASO — Broad is burning budget with no conversions</span></div>
                <div className="meta">$2,410 spent over 6 days. 0 conversions vs. 18 for ASO — Lookalike 1%. Recommend pausing Broad, reallocating to Lookalike.</div>
                <div className="row gap-8"><button className="btn ai sm">Pause ad set →</button><button className="btn sm">Create variant in Ad Studio →</button></div>
              </div>
              <div className="card card-pad stack gap-6 bdr-amber" style={{ background: 'var(--bg-2)' }}>
                <div className="row gap-8"><span className="pill amber"><span className="dot" />Medium</span><span style={{ fontWeight: 500 }}>Creative fatigue likely on 2 of 4 ads</span></div>
                <div className="meta">CTR declined 28% over 14 days. Top performer from March ("Family Saturdays") had 4.1% CTR — generate 3 new variants grounded in that angle.</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="h2">Ad sets</span>
              <span className="meta">3 · ranked by spend</span>
            </div>
            <table className="tbl">
              <thead><tr><th>Name</th><th>ID</th><th>Spend</th><th>Conv.</th><th>CPL</th><th>CTR</th><th>Trend</th><th>Status</th></tr></thead>
              <tbody>
                {[
                  { n: 'ASO — Broad', id: 'adset_443021', spend: '$2,410', conv: 0, cpl: '—', ctr: '0.82%', status: 'Active', sk: 44, up: false, cplPct: 0 },
                  { n: 'ASO — Lookalike 1%', id: 'adset_443022', spend: '$1,680', conv: 18, cpl: '$93', ctr: '1.42%', status: 'Active', sk: 45, up: true, cplPct: 78 },
                  { n: 'ASO — Retargeting', id: 'adset_443023', spend: '$730', conv: 24, cpl: '$30', ctr: '2.11%', status: 'Active', sk: 46, up: true, cplPct: 28 },
                ].map((r,i) => (
                  <tr key={i}>
                    <td>{r.n}</td>
                    <td className="mono" style={{ color: 'var(--fg-2)' }}>{r.id}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.spend}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.conv}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <div className="row gap-8" style={{ alignItems: 'center' }}>
                        <span style={{ minWidth: 36 }}>{r.cpl}</span>
                        {r.cplPct > 0 && <div style={{ width: 60, height: 6, background: 'var(--bg-2)', borderRadius: 99 }}><div style={{ width: `${r.cplPct}%`, height: '100%', background: r.cplPct > 70 ? 'var(--amber)' : 'var(--accent)', borderRadius: 99 }} /></div>}
                      </div>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.ctr}</td>
                    <td><DeltaSpark seed={r.sk} up={r.up} w={70} h={20} /></td>
                    <td><Status s={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const ViewCalendar = () => {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4"><h1 className="h0">Content Calendar</h1><span className="meta">April 2025 · 28 scheduled, 11 pending approval</span></div>
        <div className="row gap-8">
          <div className="seg"><button className="on">Month</button><button>Week</button><button>List</button></div>
          <button className="btn ghost"><Icon name="upload" size={13} /> Bulk import</button>
          <button className="btn ai"><Icon name="sparkles" size={13} /> AI generate week</button>
          <button className="btn primary">Schedule all approved</button>
        </div>
      </div>

      <div className="card">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--border)', gap: 1 }}>
          {days.map(d => <div key={d} style={{ padding: '8px 12px', background: 'var(--bg-1)', fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>)}
          {Array.from({ length: 35 }, (_, i) => {
            const date = i - 2;
            const inMonth = date > 0 && date <= 30;
            const dayData = POSTS_WEEK[i % 7];
            const showPosts = inMonth && [3, 5, 8, 10, 12, 15, 17, 19, 21, 23, 26, 28].includes(date);
            return (
              <div key={i} style={{ background: 'var(--bg-1)', minHeight: 100, padding: 8, opacity: inMonth ? 1 : 0.35 }}>
                <div className="meta" style={{ fontSize: 11, marginBottom: 6 }}>{inMonth ? date : ''}</div>
                {showPosts && dayData && (
                  <div className="stack gap-4">
                    {dayData.list.slice(0, 2).map((p, j) => (
                      <div key={j} className="row gap-4" style={{ padding: '3px 6px', background: 'var(--bg-2)', borderRadius: 4, border: `1px solid ${p.status === 'Published' ? 'var(--green)' : p.status === 'Scheduled' ? 'var(--ai)' : p.status === 'Approved' ? 'var(--accent)' : p.status === 'Error' ? 'var(--red)' : 'var(--border)'}`, fontSize: 11 }}>
                        <Icon name={p.fmt === 'Reel' ? 'bolt' : p.fmt === 'Carousel' ? 'grid' : 'image'} size={10} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.client}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="row gap-16" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <span className="meta">Legend:</span>
        <Status s="Draft" /><Status s="Approved" /><Status s="Scheduled" /><Status s="Published" /><Status s="Error" />
      </div>
    </div>
  );
};

const ViewAdStudio = () => {
  const [tone, setTone] = React.useState('warm');
  const [prompt, setPrompt] = React.useState('Warm, family-first. Emphasize same-day crowns and Saturday availability. Photos of real staff.');
  const [imgMode, setImgMode] = React.useState('reference'); // reference · banners · variations
  const [gen, setGen] = React.useState('dalle');
  const [uploaded, setUploaded] = React.useState(true);
  const ideas = [
    { t: 'Family Saturdays', b: 'Lean into weekend convenience for working parents.' },
    { t: 'Same-day, same-chair', b: 'Emphasize same-day crown tech as a time-saver.' },
    { t: 'First-visit comfort', b: 'Warm pediatric angle for new patients and nervous adults.' },
    { t: 'Insurance made easy', b: 'Lead with "we accept most plans — no surprises".' },
    { t: 'Meet Dr. Patel', b: 'Staff-led trust angle, real photos, human voice.' },
    { t: 'Neighborhood office', b: 'Local-first — Portland parents, 10 min from anywhere.' },
  ];
  return (
  <div className="content wide">
    <div className="row between" style={{ marginBottom: 16 }}>
      <div className="stack gap-4"><h1 className="h0">Ad Studio</h1><span className="meta">AI-grounded ad creation for Acme Dental · Lead Gen · FB + IG</span></div>
      <div className="row gap-8"><button className="btn ghost">Save draft</button><button className="btn">Send for approval</button><button className="btn primary">Approve & publish →</button></div>
    </div>

    {/* Stepper */}
    <div className="row gap-8" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
      {[
        { n: 1, t: 'Your brief', on: true },
        { n: 2, t: 'Pick a direction' },
        { n: 3, t: 'Generated variants' },
        { n: 4, t: 'Preview & approve' },
      ].map(s => (
        <div key={s.n} className="row gap-8" style={{ alignItems: 'center' }}>
          <div className="row gap-6" style={{ padding: '6px 12px', background: s.on ? 'var(--accent)' : 'var(--bg-2)', color: s.on ? '#04221F' : 'var(--fg-2)', borderRadius: 999, border: s.on ? 0 : '1px solid var(--border)', fontSize: 12, fontWeight: 500 }}>
            <span style={{ width: 18, height: 18, borderRadius: 999, background: s.on ? '#04221F' : 'var(--border)', color: s.on ? 'var(--accent)' : 'var(--fg-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{s.n}</span>
            {s.t}
          </div>
          {s.n < 4 && <span style={{ color: 'var(--border)' }}>→</span>}
        </div>
      ))}
    </div>

    {/* STEP 1 — Your brief (full width, the hero) */}
    <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
      <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="stack gap-4">
          <div className="row gap-8"><span className="pill teal" style={{ fontSize: 11 }}><span className="dot" />Step 1</span><span className="h2">Your brief</span></div>
          <span className="meta">Start with an idea of your own, pick one of ours, or upload a reference image. Everything downstream is grounded in this.</span>
        </div>
        <div className="row gap-8"><AIBadge /></div>
      </div>
      <div className="grid gap-16" style={{ gridTemplateColumns: '1.3fr 1fr', padding: 16, gap: 16 }}>
        {/* LEFT — prompt */}
        <div className="stack gap-12">
          <div className="stack gap-6">
            <div className="row between">
              <span className="meta" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your prompt</span>
              <span className="meta" style={{ fontSize: 11 }}>{prompt.length}/500</span>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the angle, tone, offer, audience… or pick one of our ideas →"
              style={{ minHeight: 100, padding: 12, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, background: 'var(--bg-2)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, resize: 'vertical', outline: 'none' }}
            />
            <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
              <span className="meta" style={{ fontSize: 11 }}>Tone:</span>
              {['warm','bold','playful','clinical','premium'].map(t => (
                <button key={t} onClick={() => setTone(t)}
                  className={`pill ${tone === t ? 'teal' : ''}`}
                  style={{ border: 0, cursor: 'pointer', font: 'inherit', textTransform: 'capitalize' }}>
                  {tone === t && <span className="dot" />}{t}
                </button>
              ))}
            </div>
          </div>

          <div className="ai-surface card-pad stack gap-8">
            <div className="row between">
              <div className="row gap-8"><Icon name="sparkles" size={13} /><span style={{ fontWeight: 500, fontSize: 13 }}>Here are some ideas</span></div>
              <button className="btn ai sm">Regenerate</button>
            </div>
            <div className="meta">Grounded in this client's top 90-day performers, brand voice, and Lead Gen benchmarks.</div>
            <div className="grid grid-2 gap-8" style={{ gap: 8 }}>
              {ideas.map((d, i) => (
                <button key={i} onClick={() => setPrompt(`${d.t} — ${d.b}`)}
                  className="card card-pad stack gap-4"
                  style={{ background: 'var(--bg-1)', cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border)', font: 'inherit', color: 'var(--fg)' }}>
                  <div className="row between"><span style={{ fontWeight: 500, fontSize: 12 }}>{d.t}</span><Icon name="plus" size={11} /></div>
                  <div className="meta" style={{ fontSize: 11 }}>{d.b}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — reference image + generator */}
        <div className="stack gap-12">
          <div className="stack gap-6">
            <div className="row between">
              <span className="meta" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reference image <span style={{ color: 'var(--fg-2)', textTransform: 'none', letterSpacing: 0 }}>· optional</span></span>
              {uploaded && <button className="btn ghost sm" onClick={() => setUploaded(false)}>Remove</button>}
            </div>
            {!uploaded ? (
              <button onClick={() => setUploaded(true)}
                className="stack gap-6"
                style={{ minHeight: 150, border: '2px dashed var(--border)', borderRadius: 8, background: 'var(--bg-2)', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', font: 'inherit', color: 'var(--fg-2)' }}>
                <Icon name="upload" size={18} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>Drop an image or click to upload</span>
                <span className="meta" style={{ fontSize: 11 }}>PNG, JPG, HEIC · up to 10MB</span>
              </button>
            ) : (
              <div className="row gap-10" style={{ padding: 10, background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ width: 88, height: 88, flexShrink: 0, borderRadius: 6, overflow: 'hidden' }}>
                  <AdThumb seed={77} brand="Acme Dental" kind="photo" headline="" h={88} />
                </div>
                <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between"><span style={{ fontSize: 12, fontWeight: 500 }}>staff-saturday.jpg</span><span className="meta" style={{ fontSize: 11 }}>1.8 MB · 2400×2400</span></div>
                  <span className="meta" style={{ fontSize: 11 }}>Uploaded just now</span>
                  <div className="row gap-6" style={{ marginTop: 2 }}>
                    <span className="pill indigo" style={{ fontSize: 10 }}><span className="dot" />Analyzed by Claude</span>
                    <span className="meta" style={{ fontSize: 10 }}>"3 people in clinic setting, warm lighting"</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {uploaded && (
            <div className="stack gap-6">
              <span className="meta" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>How should we use it?</span>
              {[
                { id: 'reference', t: 'Just consider for ad copy', b: 'Use the image as context when writing — no generated images.' },
                { id: 'banners', t: 'Add banners & text', b: 'Overlay headline, CTA, and brand elements on this image.' },
                { id: 'variations', t: 'Make variations', b: 'Generate fresh images in the style of this one.' },
              ].map(opt => (
                <button key={opt.id} onClick={() => setImgMode(opt.id)}
                  className="card card-pad row gap-10"
                  style={{ background: imgMode === opt.id ? 'rgba(6,182,164,0.06)' : 'var(--bg-2)', border: imgMode === opt.id ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--fg)', alignItems: 'flex-start' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 999, border: '2px solid ' + (imgMode === opt.id ? 'var(--accent)' : 'var(--border)'), background: imgMode === opt.id ? 'var(--accent)' : 'transparent', flexShrink: 0, marginTop: 2 }} />
                  <div className="stack gap-2" style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{opt.t}</span>
                    <span className="meta" style={{ fontSize: 11 }}>{opt.b}</span>
                  </div>
                </button>
              ))}

              {imgMode === 'variations' && (
                <div className="stack gap-6" style={{ paddingLeft: 12, borderLeft: '2px solid var(--accent)' }}>
                  <span className="meta" style={{ fontSize: 11 }}>Describe the variations</span>
                  <input
                    defaultValue="Same staff, different angles — 1 wide, 1 close-up, 1 golden-hour exterior"
                    style={{ padding: 10, fontFamily: 'inherit', fontSize: 12, background: 'var(--bg-1)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }}
                  />
                  <div className="row gap-6">
                    <span className="meta" style={{ fontSize: 11 }}>Count:</span>
                    {[2, 4, 6, 8].map(n => <span key={n} className={`pill ${n === 4 ? 'teal' : ''}`} style={{ cursor: 'pointer' }}>{n === 4 && <span className="dot" />}{n}</span>)}
                  </div>
                </div>
              )}

              {imgMode !== 'reference' && (
                <div className="stack gap-6">
                  <span className="meta" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Image generator</span>
                  <div className="grid grid-3 gap-6" style={{ gap: 6 }}>
                    {[
                      { id: 'dalle', t: 'DALL·E 3', b: 'Great for illustrative' },
                      { id: 'banana', t: 'Nano Banana', b: 'Photoreal · editing' },
                      { id: 'imagen', t: 'Imagen 4', b: 'Sharp typography' },
                    ].map(g => (
                      <button key={g.id} onClick={() => setGen(g.id)}
                        className="card card-pad stack gap-2"
                        style={{ background: gen === g.id ? 'rgba(6,182,164,0.06)' : 'var(--bg-2)', border: gen === g.id ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--fg)', padding: 10 }}>
                        <span style={{ fontWeight: 500, fontSize: 12 }}>{g.t}</span>
                        <span className="meta" style={{ fontSize: 10 }}>{g.b}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="card-pad row between" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <span className="meta">Claude will use your brief + brand rules + top performers to draft directions, headlines, primary text, and images.</span>
        <button className="btn primary"><Icon name="sparkles" size={13} /> Generate with AI →</button>
      </div>
    </div>

    <ProgressBanner label="Generating 12 headlines + 6 primary text variants (Claude)" pct={68} eta="~40s" />

    <div className="grid gap-16" style={{ gridTemplateColumns: '1fr 340px', gap: 16, marginTop: 16 }}>
      {/* Workspace */}
      <div className="stack gap-16">
        <div className="card">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="stack gap-4">
              <div className="row gap-8"><span className="pill gray" style={{ fontSize: 11 }}>Step 2</span><span className="h2">Pick a direction</span></div>
              <span className="meta">3 drafted from your brief. Pick one or regenerate.</span>
            </div>
            <button className="btn ai sm"><Icon name="sparkles" size={12} /> Regenerate all</button>
          </div>
          <div className="grid grid-3 gap-12" style={{ padding: 16, gap: 12 }}>
            {[
              { t: 'Family Saturdays', b: 'Lean into weekend convenience for working parents.' },
              { t: 'Same-day, same-chair', b: 'Emphasize same-day crown technology as a time-saver.' },
              { t: 'First-visit comfort', b: 'Warm pediatric angle for new patients and nervous adults.' },
            ].map((d, i) => (
              <div key={i} className={`card card-pad stack gap-6 ${i === 0 ? 'bdr-green' : ''}`} style={{ background: i === 0 ? 'rgba(6,182,164,0.05)' : 'var(--bg-2)', cursor: 'pointer' }}>
                <div className="row between"><span style={{ fontWeight: 500 }}>{d.t}</span>{i === 0 && <span className="pill teal"><span className="dot" />Selected</span>}</div>
                <div className="meta">{d.b}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="stack gap-4">
              <div className="row gap-8"><span className="pill gray" style={{ fontSize: 11 }}>Step 3</span><span className="h2">Generated variants</span></div>
              <span className="meta">12 headlines · 6 primary · 8 images</span>
            </div>
            <button className="btn sm">+ Add more with AI</button>
          </div>
          <div style={{ padding: 16 }}>
            <div className="meta" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>Headlines</div>
            <div className="grid grid-2 gap-8" style={{ gap: 8, marginBottom: 16 }}>
              {[
                'Saturday dental care for busy families',
                'Same-day crowns. No second visit.',
                'Your weekend dentist, open 9–3 Saturdays',
                'Book a Saturday slot — insurance welcome',
              ].map((h, i) => (
                <div key={i} className="ai-surface card-pad row between" style={{ gap: 8 }}>
                  <span style={{ fontSize: 13 }}>{h}</span>
                  <div className="row gap-4"><span className="meta" style={{ fontSize: 11 }}>{38 + i * 3}/40</span><Icon name="refresh" size={12} /></div>
                </div>
              ))}
            </div>
            <div className="meta" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>Images ({gen === 'dalle' ? 'DALL·E 3' : gen === 'banana' ? 'Nano Banana' : 'Imagen 4'}{imgMode === 'banners' ? ' · banners mode' : imgMode === 'variations' ? ' · variations of reference' : ''})</div>
            <div className="grid grid-4 gap-8" style={{ gap: 8 }}>
              {[
                { k: 'photo', h: 'Saturdays at Acme' },
                { k: 'offer', h: 'Same-day crowns' },
                { k: 'photo', h: 'Meet Dr. Patel' },
                { k: 'bg', h: 'Book this Saturday' },
              ].map((v, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <AdThumb seed={91 + i * 7} brand="Acme Dental" kind={v.k} headline={v.h} h={110} />
                  <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(5,150,105,0.9)', color: '#fff', fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI ✦</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="stack gap-12">
        <ChannelPreview />
        <div className="card card-pad stack gap-8">
          <div className="row gap-8"><span className="pill gray" style={{ fontSize: 11 }}>Step 4</span><span className="h2">Approval</span></div>
          <div className="stack gap-6 meta">
            <div className="row between"><span>Selected variants</span><span style={{ color: 'var(--fg)' }}>3 of 12</span></div>
            <div className="row between"><span>Channels</span><span style={{ color: 'var(--fg)' }}>FB + IG</span></div>
            <div className="row between"><span>Schedule</span><span style={{ color: 'var(--fg)' }}>Apr 23, 9:00 AM</span></div>
          </div>
          <div className="row gap-8" style={{ marginTop: 4 }}>
            <button className="btn" style={{ flex: 1 }}>Send for approval</button>
            <button className="btn primary" style={{ flex: 1 }}>Publish →</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

Object.assign(window, { ViewAdPerf, ViewCalendar, ViewAdStudio });
