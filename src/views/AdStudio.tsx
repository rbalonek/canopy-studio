import { useEffect, useState } from 'react';
import { AIBadge } from '../components/AIBadge';
import { AdThumb } from '../components/AdThumb';
import { ChannelPreview } from '../components/ChannelPreview';
import { Icon } from '../components/Icon';
import { ProgressBanner } from '../components/ProgressBanner';
import { useQuery } from '../data/context';
import type { AdBrief } from '../data/types';

type Tone = 'warm' | 'bold' | 'playful' | 'clinical' | 'premium';
type ImgMode = 'reference' | 'banners' | 'variations';
type Generator = 'dalle' | 'banana' | 'imagen';

const TONES: Tone[] = ['warm', 'bold', 'playful', 'clinical', 'premium'];

const USAGE_OPTIONS: { id: ImgMode; title: string; body: string }[] = [
  { id: 'reference',  title: 'Just consider for ad copy', body: 'Use the image as context when writing — no generated images.' },
  { id: 'banners',    title: 'Add banners & text',        body: 'Overlay headline, CTA, and brand elements on this image.' },
  { id: 'variations', title: 'Make variations',           body: 'Generate fresh images in the style of this one.' },
];

const GENERATORS: { id: Generator; title: string; body: string; label: string }[] = [
  { id: 'dalle',  title: 'DALL·E 3',    body: 'Great for illustrative', label: 'DALL·E 3' },
  { id: 'banana', title: 'Nano Banana', body: 'Photoreal · editing',    label: 'Nano Banana' },
  { id: 'imagen', title: 'Imagen 4',    body: 'Sharp typography',       label: 'Imagen 4' },
];

const STEPPER = [
  { n: 1, t: 'Your brief' },
  { n: 2, t: 'Pick a direction' },
  { n: 3, t: 'Generated variants' },
  { n: 4, t: 'Preview & approve' },
] as const;

// Default to acme — the only populated brief for now. A real app would
// resolve this from the user's current workspace + selected campaign.
const DEFAULT_BRIEF_CLIENT = 'acme';

export function AdStudio() {
  const { data: brief, loading } = useQuery<AdBrief | null>(
    (p) => p.getAdBrief(DEFAULT_BRIEF_CLIENT),
    [],
  );

  const [tone, setTone] = useState<Tone>('warm');
  const [prompt, setPrompt] = useState('');
  const [imgMode, setImgMode] = useState<ImgMode>('reference');
  const [gen, setGen] = useState<Generator>('dalle');
  const [uploaded, setUploaded] = useState(true);
  const [activeStep] = useState<number>(1);

  // Seed the prompt textarea from the brief once it loads.
  useEffect(() => {
    if (brief && prompt === '') setPrompt(brief.promptDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief]);

  if (loading) {
    return (
      <div className="content wide">
        <span className="meta">Loading…</span>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="content wide">
        <div className="card card-pad stack gap-8">
          <span className="h2">No brief yet</span>
          <span className="meta">
            Ad Studio is seeded with acme for the initial port. Briefs for other clients will be
            generated once the AI-generation pipeline is wired.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4">
          <h1 className="h0">Ad Studio</h1>
          <span className="meta">{brief.subtitle}</span>
        </div>
        <div className="row gap-8">
          <button className="btn ghost">Save draft</button>
          <button className="btn">Send for approval</button>
          <button className="btn primary">Approve & publish →</button>
        </div>
      </div>

      <div className="row gap-8" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {STEPPER.map((s) => {
          const on = s.n === activeStep;
          return (
            <div key={s.n} className="row gap-8" style={{ alignItems: 'center' }}>
              <div
                className="row gap-6"
                style={{
                  padding: '6px 12px',
                  background: on ? 'var(--accent)' : 'var(--bg-2)',
                  color: on ? '#04221F' : 'var(--fg-2)',
                  borderRadius: 999,
                  border: on ? 0 : '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: on ? '#04221F' : 'var(--border)',
                    color: on ? 'var(--accent)' : 'var(--fg-2)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {s.n}
                </span>
                {s.t}
              </div>
              {s.n < 4 && <span style={{ color: 'var(--border)' }}>→</span>}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="stack gap-4">
            <div className="row gap-8">
              <span className="pill teal" style={{ fontSize: 11 }}>
                <span className="dot" />
                Step 1
              </span>
              <span className="h2">Your brief</span>
            </div>
            <span className="meta">
              Start with an idea of your own, pick one of ours, or upload a reference image. Everything downstream is grounded in this.
            </span>
          </div>
          <div className="row gap-8">
            <AIBadge />
          </div>
        </div>

        <div className="grid gap-16" style={{ gridTemplateColumns: '1.3fr 1fr', padding: 16, gap: 16 }}>
          <div className="stack gap-12">
            <div className="stack gap-6">
              <div className="row between">
                <span
                  className="meta"
                  style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  Your prompt
                </span>
                <span className="meta" style={{ fontSize: 11 }}>
                  {prompt.length}/500
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the angle, tone, offer, audience… or pick one of our ideas →"
                style={{
                  minHeight: 100,
                  padding: 12,
                  fontFamily: 'inherit',
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: 'var(--bg-2)',
                  color: 'var(--fg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
              <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
                <span className="meta" style={{ fontSize: 11 }}>
                  Tone:
                </span>
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`pill ${tone === t ? 'teal' : ''}`}
                    style={{ border: 0, cursor: 'pointer', font: 'inherit', textTransform: 'capitalize' }}
                  >
                    {tone === t && <span className="dot" />}
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="ai-surface card-pad stack gap-8">
              <div className="row between">
                <div className="row gap-8">
                  <Icon name="sparkles" size={13} />
                  <span style={{ fontWeight: 500, fontSize: 13 }}>Here are some ideas</span>
                </div>
                <button className="btn ai sm">Regenerate</button>
              </div>
              <div className="meta">
                Grounded in this client's top 90-day performers, brand voice, and Lead Gen benchmarks.
              </div>
              <div className="grid grid-2 gap-8" style={{ gap: 8 }}>
                {brief.ideas.map((d) => (
                  <button
                    key={d.title}
                    onClick={() => setPrompt(`${d.title} — ${d.body}`)}
                    className="card card-pad stack gap-4"
                    style={{
                      background: 'var(--bg-1)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      border: '1px solid var(--border)',
                      font: 'inherit',
                      color: 'var(--fg)',
                    }}
                  >
                    <div className="row between">
                      <span style={{ fontWeight: 500, fontSize: 12 }}>{d.title}</span>
                      <Icon name="plus" size={11} />
                    </div>
                    <div className="meta" style={{ fontSize: 11 }}>
                      {d.body}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="stack gap-12">
            <div className="stack gap-6">
              <div className="row between">
                <span
                  className="meta"
                  style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  Reference image{' '}
                  <span style={{ color: 'var(--fg-2)', textTransform: 'none', letterSpacing: 0 }}>
                    · optional
                  </span>
                </span>
                {uploaded && (
                  <button className="btn ghost sm" onClick={() => setUploaded(false)}>
                    Remove
                  </button>
                )}
              </div>
              {!uploaded ? (
                <button
                  onClick={() => setUploaded(true)}
                  className="stack gap-6"
                  style={{
                    minHeight: 150,
                    border: '2px dashed var(--border)',
                    borderRadius: 8,
                    background: 'var(--bg-2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--fg-2)',
                  }}
                >
                  <Icon name="upload" size={18} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>
                    Drop an image or click to upload
                  </span>
                  <span className="meta" style={{ fontSize: 11 }}>
                    PNG, JPG, HEIC · up to 10MB
                  </span>
                </button>
              ) : (
                <div
                  className="row gap-10"
                  style={{
                    padding: 10,
                    background: 'var(--bg-2)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ width: 88, height: 88, flexShrink: 0, borderRadius: 6, overflow: 'hidden' }}>
                    <AdThumb seed={77} brand="Acme Dental" kind="photo" headline="" h={88} />
                  </div>
                  <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
                    <div className="row between">
                      <span style={{ fontSize: 12, fontWeight: 500 }}>
                        {brief.reference?.fileName ?? 'reference.jpg'}
                      </span>
                      <span className="meta" style={{ fontSize: 11 }}>
                        {brief.reference?.sizeLabel} · {brief.reference?.dims}
                      </span>
                    </div>
                    <span className="meta" style={{ fontSize: 11 }}>
                      Uploaded just now
                    </span>
                    <div className="row gap-6" style={{ marginTop: 2 }}>
                      <span className="pill indigo" style={{ fontSize: 10 }}>
                        <span className="dot" />
                        Analyzed by Claude
                      </span>
                      <span className="meta" style={{ fontSize: 10 }}>
                        {brief.reference?.analysis}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {uploaded && (
              <div className="stack gap-6">
                <span
                  className="meta"
                  style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  How should we use it?
                </span>
                {USAGE_OPTIONS.map((opt) => {
                  const on = imgMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setImgMode(opt.id)}
                      className="card card-pad row gap-10"
                      style={{
                        background: on ? 'rgba(6,182,164,0.06)' : 'var(--bg-2)',
                        border: on ? '1px solid var(--accent)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'var(--fg)',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                          background: on ? 'var(--accent)' : 'transparent',
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      />
                      <div className="stack gap-2" style={{ flex: 1 }}>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{opt.title}</span>
                        <span className="meta" style={{ fontSize: 11 }}>
                          {opt.body}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {imgMode === 'variations' && (
                  <div
                    className="stack gap-6"
                    style={{ paddingLeft: 12, borderLeft: '2px solid var(--accent)' }}
                  >
                    <span className="meta" style={{ fontSize: 11 }}>
                      Describe the variations
                    </span>
                    <input
                      defaultValue="Same staff, different angles — 1 wide, 1 close-up, 1 golden-hour exterior"
                      style={{
                        padding: 10,
                        fontFamily: 'inherit',
                        fontSize: 12,
                        background: 'var(--bg-1)',
                        color: 'var(--fg)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        outline: 'none',
                      }}
                    />
                    <div className="row gap-6">
                      <span className="meta" style={{ fontSize: 11 }}>
                        Count:
                      </span>
                      {[2, 4, 6, 8].map((n) => (
                        <span
                          key={n}
                          className={`pill ${n === 4 ? 'teal' : ''}`}
                          style={{ cursor: 'pointer' }}
                        >
                          {n === 4 && <span className="dot" />}
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {imgMode !== 'reference' && (
                  <div className="stack gap-6">
                    <span
                      className="meta"
                      style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    >
                      Image generator
                    </span>
                    <div className="grid grid-3 gap-6" style={{ gap: 6 }}>
                      {GENERATORS.map((g) => {
                        const on = gen === g.id;
                        return (
                          <button
                            key={g.id}
                            onClick={() => setGen(g.id)}
                            className="card card-pad stack gap-2"
                            style={{
                              background: on ? 'rgba(6,182,164,0.06)' : 'var(--bg-2)',
                              border: on ? '1px solid var(--accent)' : '1px solid var(--border)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              font: 'inherit',
                              color: 'var(--fg)',
                              padding: 10,
                            }}
                          >
                            <span style={{ fontWeight: 500, fontSize: 12 }}>{g.title}</span>
                            <span className="meta" style={{ fontSize: 10 }}>
                              {g.body}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className="card-pad row between"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}
        >
          <span className="meta">
            Claude will use your brief + brand rules + top performers to draft directions, headlines, primary text, and images.
          </span>
          <button className="btn primary">
            <Icon name="sparkles" size={13} /> Generate with AI →
          </button>
        </div>
      </div>

      <ProgressBanner label="Generating 12 headlines + 6 primary text variants (Claude)" pct={68} eta="~40s" />

      <div
        className="grid gap-16"
        style={{ gridTemplateColumns: '1fr 340px', gap: 16, marginTop: 16 }}
      >
        <div className="stack gap-16">
          <div className="card">
            <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="stack gap-4">
                <div className="row gap-8">
                  <span className="pill gray" style={{ fontSize: 11 }}>
                    Step 2
                  </span>
                  <span className="h2">Pick a direction</span>
                </div>
                <span className="meta">
                  {brief.directions.length} drafted from your brief. Pick one or regenerate.
                </span>
              </div>
              <button className="btn ai sm">
                <Icon name="sparkles" size={12} /> Regenerate all
              </button>
            </div>
            <div className="grid grid-3 gap-12" style={{ padding: 16, gap: 12 }}>
              {brief.directions.map((d) => (
                <div
                  key={d.title}
                  className={`card card-pad stack gap-6 ${d.selected ? 'bdr-green' : ''}`}
                  style={{
                    background: d.selected ? 'rgba(6,182,164,0.05)' : 'var(--bg-2)',
                    cursor: 'pointer',
                  }}
                >
                  <div className="row between">
                    <span style={{ fontWeight: 500 }}>{d.title}</span>
                    {d.selected && (
                      <span className="pill teal">
                        <span className="dot" />
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="meta">{d.body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="stack gap-4">
                <div className="row gap-8">
                  <span className="pill gray" style={{ fontSize: 11 }}>
                    Step 3
                  </span>
                  <span className="h2">Generated variants</span>
                </div>
                <span className="meta">
                  {brief.headlines.length} headlines · 6 primary · {brief.images.length} images
                </span>
              </div>
              <button className="btn sm">+ Add more with AI</button>
            </div>
            <div style={{ padding: 16 }}>
              <div
                className="meta"
                style={{
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: 11,
                }}
              >
                Headlines
              </div>
              <div className="grid grid-2 gap-8" style={{ gap: 8, marginBottom: 16 }}>
                {brief.headlines.map((h, i) => (
                  <div key={h} className="ai-surface card-pad row between" style={{ gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{h}</span>
                    <div className="row gap-4">
                      <span className="meta" style={{ fontSize: 11 }}>
                        {38 + i * 3}/40
                      </span>
                      <Icon name="refresh" size={12} />
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="meta"
                style={{
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: 11,
                }}
              >
                Images ({GENERATORS.find((g) => g.id === gen)?.label}
                {imgMode === 'banners'
                  ? ' · banners mode'
                  : imgMode === 'variations'
                  ? ' · variations of reference'
                  : ''}
                )
              </div>
              <div className="grid grid-4 gap-8" style={{ gap: 8 }}>
                {brief.images.map((v) => (
                  <div key={v.seed} style={{ position: 'relative' }}>
                    <AdThumb seed={v.seed} brand="Acme Dental" kind={v.kind} headline={v.headline} h={110} />
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'rgba(5,150,105,0.9)',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '2px 5px',
                        borderRadius: 3,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      AI ✦
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="stack gap-12">
          <ChannelPreview />
          <div className="card card-pad stack gap-8">
            <div className="row gap-8">
              <span className="pill gray" style={{ fontSize: 11 }}>
                Step 4
              </span>
              <span className="h2">Approval</span>
            </div>
            <div className="stack gap-6 meta">
              <div className="row between">
                <span>Selected variants</span>
                <span style={{ color: 'var(--fg)' }}>3 of 12</span>
              </div>
              <div className="row between">
                <span>Channels</span>
                <span style={{ color: 'var(--fg)' }}>FB + IG</span>
              </div>
              <div className="row between">
                <span>Schedule</span>
                <span style={{ color: 'var(--fg)' }}>Apr 23, 9:00 AM</span>
              </div>
            </div>
            <div className="row gap-8" style={{ marginTop: 4 }}>
              <button className="btn" style={{ flex: 1 }}>
                Send for approval
              </button>
              <button className="btn primary" style={{ flex: 1 }}>
                Publish →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
