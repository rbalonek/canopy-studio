import { Icon } from './Icon';

type Props = {
  title: string;
  body: string;
  cta?: string;
  icon?: string;
};

export function Empty({ title, body, cta, icon = 'sparkles' }: Props) {
  return (
    <div
      className="card card-pad-lg stack gap-12"
      style={{
        alignItems: 'center',
        textAlign: 'center',
        padding: '40px 20px',
        borderStyle: 'dashed',
      }}
    >
      <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
        <Icon name={icon} size={32} />
      </div>
      <div className="h2">{title}</div>
      <div className="meta" style={{ maxWidth: 360 }}>
        {body}
      </div>
      {cta && <button className="btn primary">{cta}</button>}
    </div>
  );
}
