import { Ring } from './Ring';

type Props = {
  name: string;
  industry: string;
  mtd: string;
  campaigns: number;
  posts: number;
  complete: number;
  onClick?: () => void;
};

export function EntityCard({ name, industry, mtd, campaigns, posts, complete, onClick }: Props) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return (
    <div
      className="card card-pad stack gap-12"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="row between">
        <div className="row gap-8">
          <div className="logo-mark" style={{ width: 28, height: 28, fontSize: 13 }}>
            {initials}
          </div>
          <div className="stack">
            <div style={{ fontWeight: 500 }}>{name}</div>
            <div className="meta">{industry}</div>
          </div>
        </div>
        <Ring p={complete} />
      </div>
      <div className="row gap-16" style={{ paddingTop: 4 }}>
        <div className="stack">
          <span className="meta">Spend MTD</span>
          <span style={{ fontWeight: 500 }}>{mtd}</span>
        </div>
        <div className="stack">
          <span className="meta">Campaigns</span>
          <span style={{ fontWeight: 500 }}>{campaigns}</span>
        </div>
        <div className="stack">
          <span className="meta">Posts / wk</span>
          <span style={{ fontWeight: 500 }}>{posts}</span>
        </div>
      </div>
    </div>
  );
}
