type Props = { v?: number | null; neutral?: boolean };

export function Delta({ v, neutral }: Props) {
  if (neutral || v === 0 || v == null) {
    return <span className="delta flat">— 0%</span>;
  }
  const up = v > 0;
  const n = Math.abs(v).toFixed(1);
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {n}%
    </span>
  );
}
