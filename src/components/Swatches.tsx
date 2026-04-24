export function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="row gap-4">
      {colors.map((c, i) => (
        <div
          key={i}
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            background: c,
            border: '1px solid var(--border)',
          }}
        />
      ))}
    </div>
  );
}
