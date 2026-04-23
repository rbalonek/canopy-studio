// CanopyStudio — views part 3: Brand Intelligence, Approvals, Publishing Queue, Reports, Settings

const ViewBrand = () => {
  const [tab, setTab] = React.useState('competitors');
  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4"><h1 className="h0">Brand Intelligence</h1><span className="meta">Your sites, competitor sites, rules, and assets — one brain.</span></div>
        <button className="btn primary"><Icon name="plus" size={13} /> Add competitor</button>
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 20 }}>
        {[
          { t: 'Website Intelligence', v: '12 domains', m: '284 pages indexed', ic: 'link' },
          { t: 'Competitor Intelligence', v: '8 tracked', m: '3 new pages this week', ic: 'brain', ai: true },
          { t: 'Brand Rules', v: '47 rules', m: '12 cross-client', ic: 'check' },
          { t: 'Asset Library', v: '184 files', m: '32 analyzed by AI', ic: 'image' },
        ].map(c => (
          <div key={c.t} className={`card card-pad stack gap-6 ${c.ai ? 'ai-surface' : ''}`}>
            <div className="row between"><span className="meta">{c.t}</span><Icon name={c.ic} size={14} /></div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{c.v}</div>
            <span className="meta">{c.m}</span>
          </div>
        ))}
      </div>

      <div className="ai-surface card-pad row gap-12" style={{ marginBottom: 20 }}>
        <AIBadge />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>Claude's take</div>
          <div className="meta">Across your 8 competitors, 3 themes dominate: "same-day service" (7 of 8), "insurance transparency" (5 of 8), and "family pricing" (4 of 8). Only 1 competitor talks about sustainability — potential positioning gap for Acme Dental.</div>
        </div>
        <button className="btn ai sm">See all insights →</button>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {['competitors','compare','gaps & angles','websites','rules','assets'].map(t => <div key={t} className={`tab ${tab===t?'on':''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</div>)}
      </div>

      {tab === 'competitors' && (
        <div className="grid grid-3 gap-16" style={{ gap: 16 }}>
          {COMPETITORS.concat(COMPETITORS.slice(0,3).map(c=>({...c,domain:'new-'+c.domain}))).map((c,i) => (
            <div key={i} className="ai-surface card-pad stack gap-10">
              <div className="row between">
                <div className="row gap-8">
                  <LogoDot name={c.domain} size={28} />
                  <div className="stack gap-4"><span style={{ fontWeight: 500 }}>{c.domain}</span><span className="meta">{c.industry} · since {c.since}</span></div>
                </div>
                <Donut value={c.sov} size={40} stroke={5} color="var(--ai)" label={`${c.sov}%`} />
              </div>
              <AdLibraryStrip seed={i + 3} brand={c.domain} n={4} />
              <div className="row between" style={{ alignItems: 'flex-end' }}>
                <div className="stack gap-4">
                  <span className="meta" style={{ fontSize: 11 }}>Creative cadence · 12w</span>
                  <CreativeCadence seed={c.velocity + i} weeks={12} h={24} />
                </div>
                <div className="stack gap-2" style={{ alignItems: 'flex-end' }}>
                  <span className="meta" style={{ fontSize: 11 }}>This wk</span>
                  <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{c.velocity}<span className="meta" style={{ fontSize: 10, marginLeft: 2 }}>/wk</span></span>
                </div>
              </div>
              <div className="row gap-4" style={{ flexWrap: 'wrap' }}>{c.pillars.map(p => <span key={p} className="tag">{p}</span>)}</div>
              <div className="row gap-8" style={{ padding: '6px 8px', borderRadius: 4, background: 'var(--bg-2)', fontSize: 12 }}>
                <Icon name="sparkles" size={12} />
                <span>New landing page spotted {i+1}d ago</span>
              </div>
              <div className="row gap-8"><button className="btn sm">View analysis</button><button className="btn ghost sm">Compare</button><button className="btn ghost sm">Re-scrape</button></div>
            </div>
          ))}
        </div>
      )}

      {tab === 'compare' && (
        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="row gap-12">
              <div className="row gap-6"><span className="meta">You:</span><span className="pill teal"><span className="dot" />Acme Dental</span></div>
              <div className="row gap-6"><span className="meta">vs:</span><span className="pill">brightsmile.co</span><span className="pill">smileworks.com</span><span className="pill">+ Add</span></div>
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th>Dimension</th><th>Acme Dental</th><th>brightsmile.co</th><th>smileworks.com</th></tr></thead>
            <tbody>
              {[
                { d: 'Brand voice', a: 'Warm, family-first', b: 'Clinical, reassuring', c: 'Premium, tech-forward' },
                { d: 'Positioning', a: 'Neighborhood dentist', b: 'Family value', c: 'Luxury concierge' },
                { d: 'Primary CTA', a: 'Book online', b: 'Get a free quote', c: 'Schedule consultation' },
                { d: 'Visual palette', a: '●●●', b: '●●●', c: '●●●', palette: true },
                { d: 'Content cadence', a: 'spark4', b: 'spark3', c: 'spark8', chart: true },
                { d: 'Channel mix', a: 'FB 60% · IG 40%', b: 'FB 80% · IG 20%', c: 'IG 70% · FB 20% · TikTok 10%' },
              ].map((r,i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--fg-2)' }}>{r.d}</td>
                  {r.chart ? <><td><CreativeCadence seed={4} weeks={12} h={24} /></td><td><CreativeCadence seed={3} weeks={12} h={24} /></td><td style={{ position: 'relative' }}><div className="row gap-8"><CreativeCadence seed={8} weeks={12} h={24} /><span className="pill amber" style={{ fontSize: 10, padding: '0 6px' }}>gap</span></div></td></> :
                   r.palette ? <><td><Swatches c={['#2a5f8d','#f4e3b2','#0e8a80']} /></td><td><Swatches c={['#b83f3f','#f9f5ee','#2b2b2b']} /></td><td><Swatches c={['#1a1a1a','#c9a961','#ffffff']} /></td></> :
                   <><td>{r.a}</td><td>{r.b}</td><td style={i===1?{border:'1px solid rgba(245,158,11,0.6)'}:undefined}>{r.c}{i===1 && <div style={{ marginTop: 4 }}><button className="btn ai sm">Draft ad to close gap →</button></div>}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'gaps & angles' && (
        <div className="stack gap-12">
          {[
            { t: 'Sustainability / eco-friendly practice', c: 82, ev: 'Only 1 of 8 competitors mentions eco-materials. Acme uses BPA-free composites.' },
            { t: 'Weekend-only specialty clinic', c: 71, ev: '3 of 8 competitors mention Saturday hours, but none position weekends as the core offering.' },
            { t: 'Transparent upfront pricing for common procedures', c: 64, ev: '2 competitors list "starting at" prices; none show full menu. Acme could break category norms here.' },
            { t: 'Bilingual care emphasis', c: 58, ev: 'No competitor markets in Spanish despite 34% of local demo. Acme has a bilingual hygienist.' },
          ].map((g,i) => (
            <div key={i} className="ai-surface card-pad row gap-16">
              <div className="stack gap-6" style={{ flex: 1 }}>
                <div className="row gap-8"><AIBadge /><span style={{ fontWeight: 500 }}>{g.t}</span><span className="pill">{g.c}% confidence</span></div>
                <div className="meta">{g.ev}</div>
              </div>
              <button className="btn ai">Draft ad from this angle →</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'websites' && (
        <div className="stack gap-12">
          <div className="row between">
            <div className="input" style={{width:260}}><Icon name="search" size={13}/><span style={{color:'var(--fg-2)'}}>Filter domains…</span></div>
            <button className="btn primary"><Icon name="plus" size={13}/> Add domain</button>
          </div>
          <div className="card">
            <table className="tbl">
              <thead><tr><th>Domain</th><th>Client</th><th>Pages</th><th>Sitemap</th><th>Last scraped</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {[
                  {d:'acmedental.com',c:'Acme Dental',p:24,sm:'Discovered',lr:'2d ago',s:'Healthy'},
                  {d:'seasideyoga.co',c:'Seaside Yoga',p:12,sm:'Discovered',lr:'4d ago',s:'Healthy'},
                  {d:'northsideautogroup.com',c:'Northside Auto',p:142,sm:'Partial',lr:'9d ago',s:'Stale'},
                  {d:'bloomandvine.shop',c:'Bloom & Vine',p:86,sm:'Discovered',lr:'1d ago',s:'Healthy'},
                  {d:'kettleandcrumb.cafe',c:'Kettle & Crumb',p:8,sm:'Failed',lr:'—',s:'Error'},
                ].map((r,i)=>(
                  <tr key={i}><td style={{fontWeight:500}}>{r.d}</td><td>{r.c}</td><td>{r.p}</td><td className="meta">{r.sm}</td><td className="meta">{r.lr}</td><td><span className={`pill ${r.s==='Healthy'?'green':r.s==='Stale'?'amber':'red'}`}><span className="dot"/>{r.s}</span></td><td><div className="row gap-4"><button className="btn ghost sm">View pages</button><button className="btn ghost sm"><Icon name="refresh" size={12}/></button></div></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'rules' && (
        <div className="grid grid-2 gap-16" style={{gap:16}}>
          {[
            {t:"Do's — across all clients",c:'teal',items:['Lead with patient / customer outcome','Use real staff photos when available','Include location-specific CTAs','Mention insurance / financing where relevant']},
            {t:"Don'ts — across all clients",c:'red',items:['No pricing in paid ads without disclaimer','No stock medical imagery','No before/after without consent','No comparative superlatives ("best in town")']},
            {t:'Tone',c:'indigo',items:['Warm over clinical','First names over titles','Active voice','Reading level: 7th grade or below']},
            {t:'Visual',c:'gray',items:['Primary logo on light bg; monochrome mark on dark','Accent colors limited to brand palette','Min logo clearspace: 1x height','No drop shadows on logos']},
          ].map((b,i)=>(
            <div key={i} className="card card-pad stack gap-10">
              <div className="row between"><span className="h2">{b.t}</span><button className="btn ghost sm"><Icon name="plus" size={12}/> Add</button></div>
              <div className="stack gap-6">
                {b.items.map((x,j)=>(
                  <div key={j} className="row between" style={{padding:'6px 8px',background:'var(--bg-2)',borderRadius:4,border:'1px solid var(--border)'}}>
                    <div className="row gap-8"><span className={`pill ${b.c}`}><span className="dot"/></span><span style={{fontSize:13}}>{x}</span></div>
                    <Icon name="dots" size={12}/>
                  </div>
                ))}
              </div>
              <div className="meta">Used by Claude to validate generated content before it hits the approval queue.</div>
            </div>
          ))}
        </div>
      )}
      {tab === 'assets' && (
        <div className="stack gap-12">
          <div className="row between">
            <div className="row gap-8">
              <div className="input" style={{width:260}}><Icon name="search" size={13}/><span style={{color:'var(--fg-2)'}}>Search…</span></div>
              {['All clients','Photos','Videos','Logos','AI-analyzed'].map((c,i)=><span key={c} className={`pill ${i===0?'teal':''}`}>{i===0&&<span className="dot"/>}{c}</span>)}
            </div>
            <button className="btn primary"><Icon name="upload" size={13}/> Upload</button>
          </div>
          <div className="grid grid-6 gap-8" style={{gap:8}}>
            {Array.from({length:18}).map((_,i)=>{
              const brands = ['Acme Dental','Seaside Yoga','Bloom & Vine Florist','Lumen Eyecare','Harbor Legal Partners','Pinecrest Family Dentistry'];
              const kinds = ['photo','offer','product','bg'];
              const names = ['hero.jpg','logo.svg','staff.jpg','demo.mp4','offer.png','family.jpg'];
              const short = ['Acme','Seaside','Bloom','Lumen','Harbor','Pinecrest'];
              return (
                <div key={i} className="card" style={{overflow:'hidden'}}>
                  <AdThumb seed={i + 20} brand={brands[i%6]} kind={kinds[i%4]} headline="" h={96} />
                  <div className="card-pad stack gap-2" style={{padding:8}}>
                    <span style={{fontSize:11,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{names[i%6]}</span>
                    <span className="meta" style={{fontSize:10}}>{short[i%6]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const Swatches = ({ c }) => <div className="row gap-4">{c.map((x,i) => <div key={i} style={{ width: 16, height: 16, borderRadius: 3, background: x, border: '1px solid var(--border)' }} />)}</div>;

const ViewApprovals = () => {
  const [tab, setTab] = React.useState('all');
  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4"><h1 className="h0">Approvals</h1><span className="meta">11 pending · 3 AI-drafted, 8 user-drafted</span></div>
        <div className="row gap-8"><button className="btn">Approve selected</button><button className="btn ghost">Reject selected</button></div>
      </div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[{k:'all',n:'All · 11'},{k:'posts',n:'Posts · 8'},{k:'ads',n:'Ads · 2'},{k:'comments',n:'Comments · 1'}].map(t => <div key={t.k} className={`tab ${tab===t.k?'on':''}`} onClick={()=>setTab(t.k)}>{t.n}</div>)}
      </div>
      <div className="card">
        <table className="tbl">
          <thead><tr><th style={{ width: 30 }}><input type="checkbox" /></th><th style={{ width: 64 }}>Thumb</th><th>Channel</th><th>Client</th><th>Created by</th><th>Created</th><th>Scheduled</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {[
              { ch: 'IG Reel', client: 'Acme Dental', by: 'AI', when: '2h ago', sched: 'Apr 23, 9:00', s: 'Draft', ai: true },
              { ch: 'FB Post', client: 'Seaside Yoga', by: 'Maya H.', when: '5h ago', sched: 'Apr 22, 14:00', s: 'Draft' },
              { ch: 'IG Carousel', client: 'Bloom & Vine', by: 'AI', when: 'Yesterday', sched: 'Apr 24, 10:00', s: 'Draft', ai: true },
              { ch: 'FB Ad', client: 'Northside Ford', by: 'AI', when: 'Yesterday', sched: '—', s: 'Draft', ai: true },
              { ch: 'IG Post', client: 'Lumen Eyecare', by: 'Jordan R.', when: '2d ago', sched: 'Apr 25, 16:00', s: 'Draft' },
              { ch: 'FB Post', client: 'Harbor Legal', by: 'Jordan R.', when: '2d ago', sched: 'Apr 22, 11:00', s: 'Draft' },
            ].map((r,i) => (
              <tr key={i}>
                <td><input type="checkbox" /></td>
                <td><div className="ph" style={{ width: 40, height: 40 }} /></td>
                <td>{r.ch}</td>
                <td>{r.client}</td>
                <td>{r.ai ? <span className="row gap-4"><AIBadge /></span> : r.by}</td>
                <td className="meta">{r.when}</td>
                <td className="meta">{r.sched}</td>
                <td><Status s={r.s} /></td>
                <td><div className="row gap-4"><button className="btn primary sm">Approve</button><button className="btn ghost sm">Reject</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ViewPublish = () => {
  const cols = [
    { t: 'Queued', n: 12, items: POSTS_QUEUE.filter(p => p.status === 'Queued') },
    { t: 'Publishing', n: 2, items: POSTS_QUEUE.filter(p => p.status === 'Publishing') },
    { t: 'Published', n: 48, items: POSTS_QUEUE.filter(p => p.status === 'Published') },
    { t: 'Failed', n: 1, items: POSTS_QUEUE.filter(p => p.status === 'Failed') },
  ];
  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="stack gap-4"><h1 className="h0">Publishing Queue</h1><span className="meta">Channel routing · FB Pages, Instagram Business</span></div>
        <div className="row gap-8">
          <div className="row gap-6 meta" style={{ padding: '4px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6 }}>🔒 Auto-publish is off — everything requires approval</div>
          <button className="btn ghost"><Icon name="upload" size={13} /> Bulk CSV upload</button>
        </div>
      </div>

      <div className="banner" style={{ marginBottom: 16 }}>
        <Icon name="check" size={14} />
        <span>3 posts will go to Facebook Pages · 3 to Instagram · 1 skipped (no IG connection for Kettle & Crumb)</span>
        <div style={{ flex: 1 }} />
        <button className="btn sm">Review routing</button>
        <button className="btn primary sm">Confirm schedule</button>
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, alignItems: 'flex-start' }}>
        {cols.map(col => (
          <div key={col.t} className="stack gap-8">
            <div className="row between" style={{ padding: '0 4px' }}>
              <span style={{ fontWeight: 500 }}>{col.t}</span>
              <span className="pill">{col.n}</span>
            </div>
            {col.items.map((p,i) => (
              <div key={i} className={`card card-pad stack gap-6 ${p.status === 'Failed' ? 'bdr-red' : ''}`}>
                <div className="ph" style={{ height: 80 }}>Creative {p.thumb}</div>
                <div className="row between">
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{p.client}</span>
                  <Icon name={p.fmt === 'Reel' ? 'bolt' : p.fmt === 'Carousel' ? 'grid' : 'image'} size={12} />
                </div>
                <div className="row between meta" style={{ fontSize: 11 }}>
                  <span>{p.when}</span>
                  <div className="row gap-4">{p.chan.map(c => <span key={c} className="tag" style={{ fontSize: 10 }}>{c.toUpperCase()}</span>)}</div>
                </div>
                {p.status === 'Failed' && <button className="btn danger sm">Retry →</button>}
              </div>
            ))}
            {col.items.length === 0 && <div className="ph" style={{ height: 60 }}>—</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

const ViewReports = () => (
  <div className="content wide">
    <div className="row between" style={{ marginBottom: 16 }}>
      <div className="stack gap-4"><h1 className="h0">Reports</h1><span className="meta">Saved views · schedule + export</span></div>
      <button className="btn primary"><Icon name="plus" size={13} /> New report</button>
    </div>
    <div className="grid grid-3 gap-16" style={{ gap: 16, marginBottom: 20 }}>
      {[
        { t: 'Weekly spend by client', d: 'Monday 8:00 AM · jordan@redwood.co', ic: 'chart' },
        { t: 'Lead Gen performance MTD', d: 'Ad-hoc · CSV export', ic: 'bolt' },
        { t: 'Content posting cadence', d: 'First of month · CSV', ic: 'calendar' },
        { t: 'Competitor share of voice', d: 'Weekly · PDF', ic: 'brain' },
      ].map((r,i) => (
        <div key={i} className="card card-pad stack gap-8">
          <div className="row between"><span style={{ fontWeight: 500 }}>{r.t}</span><Icon name={r.ic} size={14} /></div>
          <div className="meta">{r.d}</div>
          <div className="ph" style={{ height: 80, marginTop: 4 }}>Thumbnail preview</div>
          <div className="row gap-6"><button className="btn sm">Open</button><button className="btn ghost sm">Run now</button><button className="btn ghost sm">Edit</button></div>
        </div>
      ))}
    </div>

    <div className="card">
      <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}><span className="h2">Report builder</span><span className="meta">Lo-fi preview</span></div>
      <div className="grid" style={{ gridTemplateColumns: '260px 1fr', gap: 1, background: 'var(--border)' }}>
        <div className="stack" style={{ background: 'var(--bg-1)', padding: 16, gap: 12 }}>
          <div className="stack gap-4"><span className="meta">Metric</span><div className="input"><span>Spend</span><Icon name="chevd" size={12} /></div></div>
          <div className="stack gap-4"><span className="meta">Dimension</span><div className="input"><span>Client</span><Icon name="chevd" size={12} /></div></div>
          <div className="stack gap-4"><span className="meta">Filters</span><div className="stack gap-4"><span className="pill">Strategy = Lead Gen</span><span className="pill">Spend &gt; $500</span></div></div>
          <div className="stack gap-4"><span className="meta">Viz</span><div className="seg"><button>Line</button><button className="on">Bar</button><button>Table</button><button>Funnel</button></div></div>
          <div className="stack gap-4"><span className="meta">Schedule</span><div className="seg"><button className="on">None</button><button>Daily</button><button>Weekly</button></div></div>
          <button className="btn primary">Save report</button>
        </div>
        <div style={{ background: 'var(--bg-1)', padding: 20 }}><Bars h={260} /></div>
      </div>
    </div>
  </div>
);

const ViewSettings = () => {
  const [tab, setTab] = React.useState('connections');
  const tabs = ['account','workspace','team','connections','billing','api','notifications','excluded accounts'];
  return (
    <div className="content wide">
      <h1 className="h0" style={{ marginBottom: 16 }}>Settings</h1>
      <div className="grid" style={{ gridTemplateColumns: '200px 1fr', gap: 20 }}>
        <div className="stack gap-4">
          {tabs.map(t => <div key={t} className={`nav-item ${tab===t?'active':''}`} onClick={()=>setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</div>)}
        </div>
        <div>
          {tab === 'connections' && (
            <div className="stack gap-16">
              <div className="card">
                <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}><span className="h2">Connections</span><button className="btn sm">+ Connect new</button></div>
                {[
                  { n: 'Meta (Facebook + Instagram)', s: 'Connected', clients: 9, last: 'Refreshed 8m ago', on: true },
                  { n: 'Google Ads', s: 'Coming soon', clients: 0, last: '—', on: false },
                  { n: 'TikTok Ads', s: 'Coming soon', clients: 0, last: '—', on: false },
                  { n: 'LinkedIn Ads', s: 'Coming soon', clients: 0, last: '—', on: false },
                ].map((c,i) => (
                  <div key={i} className="row between" style={{ padding: 16, borderBottom: i < 3 ? '1px solid var(--border)' : 0 }}>
                    <div className="row gap-12"><div className="ph" style={{ width: 36, height: 36 }} /><div className="stack"><span style={{ fontWeight: 500 }}>{c.n}</span><span className="meta">{c.s} · {c.clients} clients · {c.last}</span></div></div>
                    {c.on ? <div className="row gap-8"><button className="btn sm"><Icon name="refresh" size={12} /> Refresh</button><button className="btn ghost sm">Manage</button></div> : <button className="btn sm" disabled style={{ opacity: 0.5 }}>Notify me</button>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab !== 'connections' && <Empty title={`${tab} — wireframe`} body="Form-based settings panel following shell conventions." />}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ViewBrand, ViewApprovals, ViewPublish, ViewReports, ViewSettings, Swatches });
