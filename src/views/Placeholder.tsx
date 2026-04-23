import { useAppState } from '../shell/AppState';

type Props = {
  title: string;
  note?: string;
};

export function Placeholder({ title, note }: Props) {
  const { state } = useAppState();
  return (
    <div className="content">
      <div className="stack gap-16">
        <div className="row between">
          <h1 className="h1">{title}</h1>
          <span className="pill gray"><span className="dot" /> placeholder</span>
        </div>
        <div className="card card-pad">
          <div className="stack gap-8">
            <div className="meta">Mode: <strong style={{ color: 'var(--fg)' }}>{state.mode}</strong></div>
            {note && <div style={{ color: 'var(--fg-1)' }}>{note}</div>}
            <div className="ph" style={{ height: 200 }}>Port the wireframe view here</div>
          </div>
        </div>
      </div>
    </div>
  );
}
