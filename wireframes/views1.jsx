// CanopyStudio — views part 1: Components library, Overview, Clients, Client Detail

const ViewComponents = () => (
  <div className="content wide">
    <div className="stack gap-8" style={{ marginBottom: 20 }}>
      <span className="anno">WIREFRAME · Component Library</span>
      <h1 className="h0">Shared components</h1>
      <div className="meta" style={{ maxWidth: 640 }}>Every shared piece used across the 14 screens. Structured lo-fi: monochrome zinc shell, single teal accent for primary actions and performance, indigo reserved exclusively for AI-generated surfaces.</div>
    </div>

    <div className="grid grid-2 gap-16" style={{ gap: 16 }}>
      {/* KPI */}
      <div className="card card-pad-lg stack gap-12">
        <div className="h2">KPI Tiles</div>
        <div className="grid grid-2 gap-16" style={{ gap: 12 }}>
          <KPI label="Total Spend" value="$94,842" delta={12.4} seed={3} />
          <KPI label="Conversions" value="1,482" delta={-6.1} seed={5} />
        </div>
        <div className="meta">Two sizes. Label + big number + delta vs prior + sparkline.</div>
      </div>

      {/* Delta + Status + Strategy */}
      <div className="card card-pad-lg stack gap-12">
        <div className="h2">Pills & Badges</div>
        <div className="stack gap-8">
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <Delta v={12.4} /><Delta v={-6.1} /><Delta neutral />
          </div>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <Strategy s="Lead Gen" /><Strategy s="ATC" /><Strategy s="VC" /><Strategy s="Traffic" /><Strategy s="Video" /><Strategy s="Purchase" />
          </div>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <Status s="Draft" /><Status s="Approved" /><Status s="Scheduled" /><Status s="Published" /><Status s="Error" /><Status s="Paused" />
          </div>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}><AIBadge /><span className="tag">tag</span><span className="kbd">⌘K</span></div>
        </div>
      </div>

      {/* Entity card */}
      <div className="card card-pad-lg stack gap-12">
        <div className="h2">Client / Location Card</div>
        <EntityCard name="Acme Dental" industry="Dental / Healthcare" mtd="$18,420" campaigns={6} posts={4} complete={86} />
        <div className="meta">Brand-completeness ring (0–100%), three inline stats.</div>
      </div>

      {/* AI surface */}
      <div className="card card-pad-lg stack gap-12">
        <div className="h2">AI Surface</div>
        <div className="ai-surface card-pad stack gap-8">
          <div className="row between"><span style={{ fontWeight: 500 }}>Claude's take</span><AIBadge /></div>
          <div style={{ fontSize: 13 }}>Lead Gen campaigns for Acme Dental are overpacing by 31% this week. Two ad sets drove 68% of spend but 12% of conversions.</div>
          <div className="row gap-8"><button className="btn ai sm">Take action</button><button className="btn ghost sm">Why?</button></div>
        </div>
        <div className="meta">1px indigo→teal gradient border. Wrap any AI-generated content.</div>
      </div>

      {/* Progress banner */}
      <div className="card card-pad-lg stack gap-12">
        <div className="h2">Progress Banner</div>
        <ProgressBanner label="Refreshing META data for 12 ad accounts" pct={42} eta="~6m remaining" />
        <div className="meta">Used for META refresh (~10m), bulk scrape, AI generation.</div>
      </div>

      {/* Empty state */}
      <div className="card card-pad-lg stack gap-12">
        <div className="h2">Empty State</div>
        <Empty title="No competitors tracked yet" body="Paste a competitor URL and we'll discover their sitemap, extract positioning, and surface messaging gaps." cta="+ Add competitor" icon="brain" />
      </div>

      {/* Right drawer preview (static) */}
      <div className="card card-pad-lg stack gap-12">
        <div className="h2">Right Drawer (480px)</div>
        <div style={{ border: '1px dashed var(--border-2)', borderRadius: 6, padding: 12, background: 'var(--bg-2)' }}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <span style={{ fontWeight: 500 }}>Add client</span>
            <Icon name="close" size={14} />
          </div>
          <div className="stack gap-8">
            <div className="row gap-8 meta"><span>Basics</span>→<span>Brand</span>→<span>META</span>→<span>Website</span></div>
            <div className="ph" style={{ height: 32 }}>Client name</div>
            <div className="ph" style={{ height: 32 }}>Industry</div>
            <div className="ph" style={{ height: 32 }}>Website URL</div>
          </div>
        </div>
        <div className="meta">All create/edit forms use the drawer pattern — never modals.</div>
      </div>

      {/* Command palette */}
      <div className="card card-pad-lg stack gap-12">
        <div className="h2">Command Palette (⌘K)</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-2)', padding: 8 }}>
          <div className="input" style={{ margin: 4 }}><Icon name="search" size={13} /><span style={{ color: 'var(--fg-2)', fontSize: 13 }}>Type a command or search…</span></div>
          <div className="stack" style={{ fontSize: 13 }}>
            {['→ Open Acme Dental','→ Create post for Seaside Yoga','→ Refresh META data','→ Schedule all approved','→ Generate ad ideas'].map((t,i) => (
              <div key={i} className="row between" style={{ padding: '6px 8px', borderRadius: 4, background: i === 0 ? 'var(--bg-3)' : 'transparent' }}>
                <span>{t}</span><span className="kbd">↵</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ViewOverview = ({ mode }) => {
  const entity = mode === 'agency' ? 'clients' : 'locations';
  const [scope, setScope] = React.useState('all');
  // industry buckets derived from CLIENTS
  const industries = Array.from(new Set(CLIENTS.map(c => c.industry)));
  // name → industry
  const industryOf = name => (CLIENTS.find(c => c.name === name) || {}).industry;
  const filtered = React.useMemo(() => {
    if (scope === 'all') return CLIENT_PERF;
    if (scope.startsWith('ind:')) {
      const ind = scope.slice(4);
      return CLIENT_PERF.filter(p => industryOf(p.name) === ind);
    }
    if (scope.startsWith('one:')) {
      const n = scope.slice(4);
      return CLIENT_PERF.filter(p => p.name === n);
    }
    return CLIENT_PERF;
  }, [scope]);
  // recompute KPIs from filtered
  const parseNum = s => parseFloat(String(s).replace(/[^0-9.-]/g, '')) || 0;
  const totalSpend = filtered.reduce((a, c) => a + parseNum(c.spend), 0);
  const totalConv = filtered.reduce((a, c) => a + c.conv, 0);
  const avgRoas = filtered.length ? (filtered.reduce((a, c) => a + parseNum(c.roas), 0) / filtered.length) : 0;
  const avgCpl = filtered.length ? (filtered.reduce((a, c) => a + parseNum(c.cpl), 0) / filtered.length) : 0;
  const scopeLabel = scope === 'all' ? (mode === 'agency' ? 'All clients' : 'All locations')
    : scope.startsWith('ind:') ? scope.slice(4)
    : scope.slice(4);
  const [picker, setPicker] = React.useState(false);
  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="stack gap-4">
          <span className="meta">Tuesday, Apr 21 · <span style={{ color: 'var(--fg)' }}>{scopeLabel}</span> · {filtered.length} {entity}</span>
          <h1 className="h0">Good afternoon, Jordan.</h1>
        </div>
        <div className="row gap-8">
          <div className="seg">{['Today','7d','MTD','30d','90d','Custom'].map(p => <button key={p} className={p==='MTD'?'on':''}>{p}</button>)}</div>
        </div>
      </div>

      {/* Scope filter chips */}
      <div className="card card-pad stack gap-10" style={{ marginBottom: 16 }}>
        <div className="row between">
          <div className="row gap-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="meta" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scope</span>
            <button
              onClick={() => setScope('all')}
              className={`pill ${scope === 'all' ? 'teal' : ''}`}
              style={{ border: 0, cursor: 'pointer', font: 'inherit' }}
            >{scope === 'all' && <span className="dot" />}All {entity} · {CLIENT_PERF.length}</button>
            <span style={{ color: 'var(--border)' }}>│</span>
            {industries.map(ind => {
              const n = CLIENT_PERF.filter(p => industryOf(p.name) === ind).length;
              if (!n) return null;
              const active = scope === `ind:${ind}`;
              return (
                <button key={ind} onClick={() => setScope(`ind:${ind}`)}
                  className={`pill ${active ? 'teal' : ''}`}
                  style={{ border: 0, cursor: 'pointer', font: 'inherit' }}>
                  {active && <span className="dot" />}{ind} · {n}
                </button>
              );
            })}
            <span style={{ color: 'var(--border)' }}>│</span>
            <button className="btn ghost sm" onClick={() => setPicker(p => !p)}>
              <Icon name="users" size={12} /> Pick specific {entity}…
            </button>
          </div>
          {scope !== 'all' && <button className="btn ghost sm" onClick={() => setScope('all')}>Clear</button>}
        </div>
        {picker && (
          <div className="stack gap-6" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <span className="meta">Select one — multi-select in real build</span>
            <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
              {CLIENT_PERF.map(p => {
                const active = scope === `one:${p.name}`;
                return (
                  <button key={p.name} onClick={() => setScope(`one:${p.name}`)}
                    className={`pill ${active ? 'teal' : ''}`}
                    style={{ border: 0, cursor: 'pointer', font: 'inherit' }}>
                    {active && <span className="dot" />}{p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
        <KPI label="Total Spend" value={`$${Math.round(totalSpend).toLocaleString()}`} delta={12.4} seed={3} />
        <KPI label="Conversions" value={totalConv.toLocaleString()} delta={-6.1} seed={7} />
        <KPI label="Avg ROAS" value={`${avgRoas.toFixed(1)}×`} delta={4.2} seed={2} />
        <KPI label="Avg CPL" value={`$${Math.round(avgCpl)}`} delta={-2.1} seed={9} sub={`Scope: ${filtered.length} ${entity}`} />
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Active campaigns', value: '42', meta: 'Across 9 clients' },
          { label: 'Posts pending approval', value: '11', meta: '3 AI-drafted' },
          { label: 'Scheduled (next 7d)', value: '28', meta: '14 FB · 14 IG' },
          { label: 'Open AI suggestions', value: '6', meta: '2 high priority', ai: true },
        ].map(c => (
          <div key={c.label} className={`card card-pad stack gap-6 ${c.ai ? 'ai-surface' : ''}`}>
            <div className="row between">
              <span className="meta">{c.label}</span>
              {c.ai && <AIBadge />}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{c.value}</div>
            <span className="meta">{c.meta}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-16" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="stack gap-4">
              <span className="h2">Performance by {entity}</span>
              <span className="meta">Sortable · MTD</span>
            </div>
            <div className="row gap-8">
              <button className="btn sm ghost"><Icon name="filter" size={13} /> Filter</button>
              <button className="btn sm ghost">Export</button>
            </div>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>{mode === 'agency' ? 'Client' : 'Location'}</th><th>Spend</th><th>Conv.</th><th>ROAS</th><th>CPL</th><th>7d</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map((c,i) => (
                  <tr key={i}>
                    <td><div className="row gap-8"><LogoDot name={c.name} size={24} />{c.name}</div></td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.spend}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.conv}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.roas}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.cpl}</td>
                    <td><DeltaSpark seed={c.spark} up={c.delta >= 0} w={72} h={22} /></td>
                    <td><Status s={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ai-surface stack">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="row gap-8"><span className="h2">Urgent issues</span><AIBadge /></div>
            <span className="meta">3 flagged</span>
          </div>
          <div className="stack" style={{ padding: 12, gap: 10 }}>
            {URGENT.map((u, i) => (
              <div key={i} className={`card card-pad stack gap-6 ${u.sev === 'red' ? 'bdr-red' : 'bdr-amber'}`} style={{ background: 'var(--bg-2)' }}>
                <div className="row gap-8"><Icon name="warn" size={14} /> <span style={{ fontWeight: 500, fontSize: 13 }}>{u.title}</span></div>
                <div className="meta">{u.body}</div>
                <div className="row gap-8"><button className="btn ai sm">Take action →</button><button className="btn ghost sm">Dismiss</button></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="stack gap-4"><span className="h2">Spend over time</span><span className="meta">Stacked by {entity} · toggle metric</span></div>
          <div className="seg">{['Spend','Conversions','Impressions','CTR'].map((p,i) => <button key={p} className={i===0?'on':''}>{p}</button>)}</div>
        </div>
        <div style={{ padding: 16 }}>
          <AreaChart h={220} seeds={[1,3,5,7,9]} />
          <div className="row gap-16" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {filtered.slice(0, 5).map((c, i) => {
              const palette = ['var(--accent)', 'var(--ai)', '#F59E0B', '#EF4444', '#10B981'];
              return (
                <div key={i} className="row gap-6" style={{ fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: palette[i % palette.length], display: 'inline-block' }} />
                  <span style={{ color: 'var(--fg-2)' }}>{c.name}</span>
                  <span className="meta" style={{ fontVariantNumeric: 'tabular-nums' }}>{c.spend}</span>
                </div>
              );
            })}
            {filtered.length > 5 && <span className="meta">+{filtered.length - 5} more</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

const ViewClients = ({ mode }) => {
  const label = mode === 'agency' ? 'Clients' : 'Locations';
  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4"><h1 className="h0">{label}</h1><span className="meta">{CLIENTS.length} {label.toLowerCase()} · 3 multi-location</span></div>
        <div className="row gap-8">
          <div className="seg"><button className="on"><Icon name="grid" size={12} /></button><button><Icon name="list" size={12} /></button></div>
          <button className="btn primary"><Icon name="plus" size={13} /> Add {mode === 'agency' ? 'client' : 'location'}</button>
        </div>
      </div>
      <div className="row gap-8" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="input" style={{ width: 280 }}><Icon name="search" size={13} /><span style={{ color: 'var(--fg-2)' }}>Search…</span></div>
        {['Active campaigns','Has META','Multi-location','Brand 100%','Industry: Dental'].map(c => <span key={c} className="pill">{c}</span>)}
      </div>
      <div className="grid grid-3 gap-16" style={{ gap: 16 }}>
        {CLIENTS.map((c,i) => (
          <EntityCard key={c.id} name={c.name} industry={c.industry} mtd={['$18,420','$6,210','$42,880','$3,940','$1,210','$9,620','$4,180','$7,340','$2,910'][i] || '$—'} campaigns={[6,3,9,2,1,4,2,3,2][i]||2} posts={[4,3,2,5,1,2,2,3,2][i]||2} complete={c.complete} />
        ))}
      </div>
    </div>
  );
};

const ViewClientDetail = ({ mode }) => {
  const [tab, setTab] = React.useState('overview');
  const tabs = ['overview','brand','assets','scraped pages','competitors','ad accounts', ...(mode === 'agency' ? ['locations'] : [])];
  return (
    <div className="content wide">
      <div className="row gap-8 meta" style={{ marginBottom: 8 }}>
        <span>{mode === 'agency' ? 'Clients' : 'Locations'}</span><span>/</span><span style={{ color: 'var(--fg)' }}>Acme Dental</span>
      </div>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="row gap-12">
          <div className="logo-mark" style={{ width: 44, height: 44, fontSize: 18, borderRadius: 10 }}>AD</div>
          <div className="stack gap-4">
            <h1 className="h0">Acme Dental</h1>
            <div className="row gap-8 meta"><span>Dental / Healthcare</span>·<span>3 locations</span>·<span className="mono">act_139204882</span></div>
          </div>
        </div>
        <div className="row gap-8">
          <button className="btn ghost"><Icon name="refresh" size={14} /> Refresh META</button>
          <button className="btn ai"><Icon name="sparkles" size={14} /> AI analyze</button>
          <button className="btn ghost"><Icon name="dots" size={14} /></button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {tabs.map(t => <div key={t} className={`tab ${tab===t?'on':''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</div>)}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
            <KPI label="Spend MTD" value="$18,420" delta={12.4} seed={3} />
            <KPI label="Conversions" value="142" delta={8.1} seed={5} />
            <KPI label="ROAS" value="3.8×" delta={4.0} seed={2} />
            <KPI label="CPL" value="$48" delta={-2.2} seed={9} />
          </div>
          <div className="card"><div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}><span className="h2">Spend over time</span></div><div style={{ padding: 16 }}><AreaChart h={180} seeds={[1,3,5]} /></div></div>
        </>
      )}

      {tab === 'brand' && (
        <div className="grid grid-2 gap-16" style={{ gap: 16 }}>
          <div className="card card-pad stack gap-12">
            <span className="h2">Company description</span>
            <div className="ph" style={{ minHeight: 80, padding: 12, textAlign: 'left', alignItems: 'flex-start', justifyContent: 'flex-start' }}>Full-service family dental practice serving 3 neighborhoods. Specializes in Invisalign, same-day crowns, and pediatric dentistry. Founded 2008.</div>
          </div>
          <div className="card card-pad stack gap-12">
            <span className="h2">Brand voice</span>
            <div className="ph" style={{ minHeight: 80, padding: 12, alignItems: 'flex-start', justifyContent: 'flex-start', textAlign: 'left' }}>Warm, reassuring, professionally confident. Avoid clinical jargon. Use first names.</div>
          </div>
          <div className="card card-pad stack gap-12">
            <span className="h2">Do's</span>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--fg-1)' }}><li>Lead with patient outcomes</li><li>Mention same-day availability</li><li>Photos of real staff, real patients (with consent)</li></ul>
          </div>
          <div className="card card-pad stack gap-12">
            <span className="h2">Don'ts</span>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--fg-1)' }}><li>No before/after without disclaimer</li><li>No pricing in ads</li><li>No stock photos of teeth close-ups</li></ul>
          </div>
          <div className="card card-pad stack gap-12" style={{ gridColumn: '1/-1' }}>
            <div className="row between"><span className="h2">Logo</span><button className="btn sm"><Icon name="upload" size={12} /> Upload new</button></div>
            <div className="ph" style={{ height: 120, borderRadius: 8 }}>Drag + drop logo (SVG, PNG)</div>
          </div>
        </div>
      )}

      {tab === 'competitors' && (
        <div className="grid grid-3 gap-16" style={{ gap: 16 }}>
          {COMPETITORS.map((c,i) => (
            <div key={i} className="ai-surface card-pad stack gap-8">
              <div className="row between">
                <div className="row gap-8"><div className="ph" style={{ width: 22, height: 22, borderRadius: 4 }} /><span style={{ fontWeight: 500 }}>{c.domain}</span></div>
                <AIBadge />
              </div>
              <div className="meta">{c.industry} · tracked since {c.since}</div>
              <div className="row between">
                <div className="stack gap-4"><span className="meta">Content velocity</span><Spark seed={c.velocity} w={100} h={24} /></div>
                <div className="stack gap-4" style={{ alignItems: 'flex-end' }}><span className="meta">SoV vs you</span><span style={{ fontWeight: 500 }}>{c.sov}%</span></div>
              </div>
              <div className="row gap-4" style={{ flexWrap: 'wrap' }}>{c.pillars.map(p => <span key={p} className="tag">{p}</span>)}</div>
              <div className="row gap-8"><button className="btn sm">View analysis</button><button className="btn ghost sm">Compare</button></div>
            </div>
          ))}
        </div>
      )}

      {tab === 'assets' && (
        <div className="stack gap-12">
          <div className="row gap-8" style={{ flexWrap:'wrap' }}>
            <div className="input" style={{ width:260 }}><Icon name="search" size={13}/><span style={{color:'var(--fg-2)'}}>Search assets…</span></div>
            {['All','Logos','Photos','Videos','Docs','AI-analyzed'].map((c,i)=><span key={c} className={`pill ${i===0?'teal':''}`}>{i===0&&<span className="dot"/>}{c}</span>)}
            <div style={{flex:1}}/>
            <button className="btn ghost"><Icon name="upload" size={13}/> Upload</button>
            <button className="btn ai"><Icon name="sparkles" size={13}/> Analyze selected</button>
          </div>
          <div className="grid grid-4 gap-16" style={{ gap:16 }}>
            {[
              {n:'acme-primary-logo.svg',k:'Logo',s:'Analyzed',d:'4 KB · Mar 12'},
              {n:'family-saturdays-hero.jpg',k:'Photo',s:'Analyzed',d:'1.4 MB · Apr 02'},
              {n:'dr-patel-headshot.jpg',k:'Photo',s:'Analyzed',d:'2.1 MB · Feb 28'},
              {n:'invisalign-before-after.jpg',k:'Photo',s:'Pending',d:'3.8 MB · Apr 18'},
              {n:'reception-360.mp4',k:'Video',s:'Pending',d:'14.2 MB · Apr 14'},
              {n:'brand-guidelines-2025.pdf',k:'Doc',s:'Analyzed',d:'840 KB · Jan 08'},
              {n:'crown-procedure-demo.mp4',k:'Video',s:'Failed',d:'22.1 MB · Apr 11'},
              {n:'staff-photo-group.jpg',k:'Photo',s:'Analyzed',d:'2.8 MB · Mar 22'},
            ].map((a,i)=>(
              <div key={i} className="card stack" style={{overflow:'hidden'}}>
                <div className="ph" style={{height:120,borderRadius:0,borderLeft:0,borderRight:0,borderTop:0}}>{a.k}</div>
                <div className="card-pad stack gap-4" style={{padding:12}}>
                  <div className="row between"><span style={{fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.n}</span><input type="checkbox"/></div>
                  <div className="row between"><span className="meta" style={{fontSize:11}}>{a.d}</span><span className={`pill ${a.s==='Analyzed'?'green':a.s==='Pending'?'amber':a.s==='Failed'?'red':'gray'}`} style={{padding:'0 6px',fontSize:10}}><span className="dot"/>{a.s}</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="ai-surface card-pad stack gap-6">
            <div className="row gap-8"><AIBadge/><span style={{fontWeight:500,fontSize:13}}>Analysis of family-saturdays-hero.jpg</span></div>
            <div className="meta">Subjects: 2 adults, 2 children, outdoor setting, warm daylight. Detected elements: picnic blanket, laughter. Matches brand voice (warm, family-first). Suggested tags: #family #weekend #lifestyle.</div>
            <div className="row gap-8"><button className="btn sm">Edit analysis</button><button className="btn ghost sm">Use in Ad Studio →</button></div>
          </div>
        </div>
      )}
      {tab === 'scraped pages' && (
        <div className="stack gap-12">
          <div className="row between">
            <div className="row gap-8"><div className="input" style={{width:260}}><Icon name="search" size={13}/><span style={{color:'var(--fg-2)'}}>Filter pages…</span></div><span className="pill">acmedental.com</span></div>
            <div className="row gap-8"><button className="btn ghost"><Icon name="refresh" size={13}/> Re-scrape all</button><button className="btn primary"><Icon name="plus" size={13}/> Add domain</button></div>
          </div>
          <div className="card">
            <div className="card-pad row between" style={{borderBottom:'1px solid var(--border)'}}>
              <div className="row gap-8"><span style={{fontWeight:500}}>acmedental.com</span><span className="pill green"><span className="dot"/>Healthy</span><span className="meta">24 pages · last scraped 2d ago</span></div>
              <div className="row gap-8"><button className="btn sm">Select pages</button><button className="btn sm"><Icon name="refresh" size={12}/> Re-scrape</button></div>
            </div>
            <table className="tbl">
              <thead><tr><th style={{width:30}}><input type="checkbox"/></th><th>Path</th><th>Title</th><th>Words</th><th>Last scraped</th><th>AI analysis</th><th></th></tr></thead>
              <tbody>
                {[
                  {p:'/',t:'Acme Dental — Family dentistry in 3 neighborhoods',w:742,d:'2d ago',s:'Done'},
                  {p:'/about',t:'Our story',w:612,d:'2d ago',s:'Done'},
                  {p:'/services',t:'Services overview',w:920,d:'2d ago',s:'Done'},
                  {p:'/services/invisalign',t:'Invisalign — clear aligners',w:1280,d:'2d ago',s:'Done'},
                  {p:'/services/crowns',t:'Same-day crowns',w:840,d:'2d ago',s:'Done'},
                  {p:'/locations/downtown',t:'Downtown location',w:410,d:'2d ago',s:'Done'},
                  {p:'/blog/saturday-hours',t:'Why we added Saturday hours',w:680,d:'9d ago',s:'Stale'},
                  {p:'/contact',t:'Contact + directions',w:240,d:'2d ago',s:'Done'},
                ].map((r,i)=>(
                  <tr key={i}><td><input type="checkbox" defaultChecked={i<3}/></td><td className="mono" style={{fontSize:12}}>{r.p}</td><td>{r.t}</td><td>{r.w}</td><td className="meta">{r.d}</td><td><span className={`pill ${r.s==='Done'?'green':'amber'}`} style={{padding:'0 6px',fontSize:10}}><span className="dot"/>{r.s}</span></td><td><button className="btn ghost sm">View</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'ad accounts' && (
        <div className="stack gap-12">
          <div className="row between">
            <span className="meta">3 connected · 1 excluded</span>
            <div className="row gap-8"><button className="btn ghost"><Icon name="refresh" size={13}/> Refresh all from Meta</button><button className="btn primary"><Icon name="plus" size={13}/> Connect account</button></div>
          </div>
          <ProgressBanner label="Refreshing META data for act_139204882" pct={68} eta="~3m" />
          <div className="card">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Account ID</th><th>Currency</th><th>Status</th><th>Campaigns</th><th>Spend MTD</th><th>Last refresh</th><th></th></tr></thead>
              <tbody>
                {[
                  {n:'Acme Dental — Downtown',id:'act_139204882',c:'USD',s:'Active',cmp:6,sp:'$8,210',lr:'8m ago'},
                  {n:'Acme Dental — Midtown',id:'act_139204883',c:'USD',s:'Active',cmp:4,sp:'$6,420',lr:'12m ago'},
                  {n:'Acme Dental — Westside',id:'act_139204884',c:'USD',s:'Refreshing',cmp:3,sp:'$3,790',lr:'in progress'},
                  {n:'Acme Dental — Legacy (archived)',id:'act_118220310',c:'USD',s:'Excluded',cmp:0,sp:'—',lr:'—'},
                ].map((r,i)=>(
                  <tr key={i}><td style={{fontWeight:500}}>{r.n}</td><td className="mono" style={{color:'var(--fg-2)',fontSize:12}}>{r.id}</td><td>{r.c}</td><td><span className={`pill ${r.s==='Active'?'green':r.s==='Refreshing'?'indigo':'gray'}`}><span className="dot"/>{r.s}</span></td><td>{r.cmp}</td><td>{r.sp}</td><td className="meta">{r.lr}</td><td><div className="row gap-4"><button className="btn ghost sm"><Icon name="refresh" size={12}/></button><button className="btn ghost sm"><Icon name="dots" size={12}/></button></div></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card card-pad stack gap-8" style={{background:'var(--bg-2)'}}>
            <div className="row gap-8"><Icon name="warn" size={14}/><span style={{fontWeight:500,fontSize:13}}>1 account excluded from rollups</span></div>
            <div className="meta">"Acme Dental — Legacy" was hard-excluded on Jan 03 by jordan@redwood.co. Reason: archived account with historical test spend that skewed totals.</div>
            <a className="meta" style={{color:'var(--accent)'}}>Manage excluded accounts →</a>
          </div>
        </div>
      )}
      {tab === 'locations' && (
        <div className="grid grid-3 gap-16" style={{gap:16}}>
          {[
            {n:'Acme Dental — Downtown',a:'284 Ember Row',sp:'$8,210',cmp:6,posts:3,cmp2:92},
            {n:'Acme Dental — Midtown',a:'1420 Oak Blvd',sp:'$6,420',cmp:4,posts:2,cmp2:81},
            {n:'Acme Dental — Westside',a:'55 Cedar Lane',sp:'$3,790',cmp:3,posts:2,cmp2:74},
          ].map((l,i)=>(
            <div key={i} className="card card-pad stack gap-10">
              <div className="row between">
                <div className="row gap-8"><div className="logo-mark" style={{width:28,height:28,fontSize:12}}>{l.n.split('—')[1].trim().slice(0,2)}</div><div className="stack"><span style={{fontWeight:500,fontSize:13}}>{l.n}</span><span className="meta">{l.a}</span></div></div>
                <Ring p={l.cmp2}/>
              </div>
              <div className="row gap-16" style={{paddingTop:4}}>
                <div className="stack"><span className="meta">Spend MTD</span><span style={{fontWeight:500}}>{l.sp}</span></div>
                <div className="stack"><span className="meta">Campaigns</span><span style={{fontWeight:500}}>{l.cmp}</span></div>
                <div className="stack"><span className="meta">Posts/wk</span><span style={{fontWeight:500}}>{l.posts}</span></div>
              </div>
              <div className="meta" style={{fontSize:11,padding:'6px 8px',background:'var(--bg-2)',borderRadius:4}}>↳ Inherits brand rules from Acme Dental (parent)</div>
              <div className="row gap-6"><button className="btn sm">Open</button><button className="btn ghost sm">Edit brand overrides</button></div>
            </div>
          ))}
          <div className="card card-pad stack gap-8" style={{borderStyle:'dashed',alignItems:'center',justifyContent:'center',minHeight:180,cursor:'pointer'}}>
            <Icon name="plus" size={24}/><span style={{fontWeight:500}}>Add location</span><span className="meta">Inherits brand rules from parent</span>
          </div>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { ViewComponents, ViewOverview, ViewClients, ViewClientDetail });
