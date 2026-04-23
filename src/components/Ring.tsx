type Props = { p?: number; size?: number };

export function Ring({ p = 60, size = 32 }: Props) {
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <div
        className="ring"
        style={{
          ['--p' as string]: p,
          width: size,
          height: size,
          position: 'absolute',
        }}
      />
      <div className="ring-inner">{p}</div>
    </div>
  );
}
