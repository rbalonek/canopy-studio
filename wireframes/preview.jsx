// CanopyStudio — channel previews (IG Feed, FB Feed, Reels)

const ChannelPreview = () => {
  const [ch, setCh] = React.useState('ig');
  const headline = 'Saturday dental care for busy families';
  const body = 'Same-day crowns. Insurance welcome. Book a weekend slot with Dr. Patel — our calendar opens this Friday.';
  const brand = 'acmedental';
  const avatar = (
    <div style={{ width: 32, height: 32, borderRadius: 999, background: 'linear-gradient(135deg,var(--accent),#0E8A80)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#04221F', fontWeight: 700, fontSize: 12 }}>AD</div>
  );
  const creative = (
    <div style={{ width: '100%', aspectRatio: '1 / 1' }}>
      <AdThumb seed={12} brand="Acme Dental" kind="photo" headline={headline} h="100%" w="100%" />
    </div>
  );
  const reelCreative = (
    <div style={{ width: '100%', aspectRatio: '9 / 16', background: 'linear-gradient(160deg,#1b1b24 0%,#2a5f8d 100%)', position: 'relative', color: '#fff', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg,transparent 0 20px,rgba(255,255,255,0.05) 20px 21px)' }} />
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>Reels</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </div>
      <div style={{ position: 'absolute', bottom: 60, left: 12, right: 56 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>@{brand}</div>
        <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.3 }}>{headline} — link in bio ↗</div>
        <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>♪ Original audio · acmedental</div>
      </div>
      <div style={{ position: 'absolute', bottom: 60, right: 10, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', fontSize: 10 }}>
        {['♥ 2.4k','💬 128','↗ 34','⋯'].map((x,i) => <span key={i} style={{ opacity: 0.9 }}>{x}</span>)}
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>▶</div>
      </div>
    </div>
  );

  return (
    <div className="card card-pad stack gap-10">
      <div className="row between">
        <span className="h2">Preview</span>
        <div className="seg">
          <button className={ch === 'ig' ? 'on' : ''} onClick={() => setCh('ig')}>IG Feed</button>
          <button className={ch === 'fb' ? 'on' : ''} onClick={() => setCh('fb')}>FB</button>
          <button className={ch === 'reels' ? 'on' : ''} onClick={() => setCh('reels')}>Reels</button>
        </div>
      </div>

      {ch === 'ig' && (
        <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden', color: '#fafafa', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #262626' }}>
            {avatar}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{brand}</span>
              <span style={{ fontSize: 11, color: '#a8a8a8' }}>Sponsored · Portland, OR</span>
            </div>
            <span style={{ fontSize: 16 }}>⋯</span>
          </div>
          {creative}
          <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
            <div style={{ display: 'flex', gap: 12 }}>{['♡','💬','↗'].map(x => <span key={x}>{x}</span>)}</div>
            <span>🔖</span>
          </div>
          <div style={{ padding: '0 12px 10px', fontSize: 12, lineHeight: 1.4 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>2,412 likes</div>
            <div><b>{brand}</b> {body} <span style={{ color: '#a8a8a8' }}>#family #weekend #dentist</span></div>
            <div style={{ color: '#a8a8a8', marginTop: 4 }}>View all 128 comments</div>
          </div>
          <div style={{ padding: '8px 12px', borderTop: '1px solid #262626', fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#101010' }}>
            <span>Book appointment</span>
            <span style={{ background: '#0095F6', color: '#fff', padding: '4px 12px', borderRadius: 6 }}>Learn more →</span>
          </div>
        </div>
      )}

      {ch === 'fb' && (
        <div style={{ background: '#18191A', borderRadius: 8, overflow: 'hidden', color: '#E4E6EB', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
          <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            {avatar}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Acme Dental</div>
              <div style={{ fontSize: 11, color: '#B0B3B8' }}>Sponsored · <span style={{ color: '#B0B3B8' }}>🌐</span></div>
            </div>
            <span style={{ fontSize: 16 }}>⋯</span>
          </div>
          <div style={{ padding: '0 12px 10px', fontSize: 13, lineHeight: 1.45 }}>{body}</div>
          {creative}
          <div style={{ background: '#242526', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, color: '#B0B3B8', textTransform: 'uppercase' }}>acmedental.com</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Book a Saturday slot</span>
              <span style={{ fontSize: 12, color: '#B0B3B8' }}>New patients welcome · insurance accepted</span>
            </div>
            <span style={{ background: '#3A3B3C', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Book now</span>
          </div>
          <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'space-around', fontSize: 13, color: '#B0B3B8', borderTop: '1px solid #3A3B3C' }}>
            {['👍 Like','💬 Comment','↗ Share'].map(x => <span key={x} style={{ padding: '6px 0' }}>{x}</span>)}
          </div>
        </div>
      )}

      {ch === 'reels' && (
        <div style={{ maxWidth: 260, margin: '0 auto', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {reelCreative}
        </div>
      )}

      <div className="meta" style={{ textAlign: 'center', fontSize: 11 }}>Channel-accurate preview · reflects selected variant</div>
    </div>
  );
};

Object.assign(window, { ChannelPreview });
