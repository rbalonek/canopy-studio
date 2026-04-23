const BRAND_TINTS: Record<string, [string, string]> = {
  'Acme Dental': ['#2a5f8d', '#0E8A80'],
  'Seaside Yoga': ['#D97757', '#F59E0B'],
  'Northside Auto Group': ['#1f2937', '#3b82f6'],
  'Northside Ford': ['#1e3a8a', '#3b82f6'],
  'Northside Kia': ['#7f1d1d', '#dc2626'],
  'Bloom & Vine Florist': ['#86198f', '#ec4899'],
  'Bloom & Vine': ['#86198f', '#ec4899'],
  'Kettle & Crumb Bakery': ['#78350f', '#d97706'],
  'Kettle & Crumb': ['#78350f', '#d97706'],
  'Harbor Legal Partners': ['#0c4a6e', '#0891b2'],
  'Harbor Legal': ['#0c4a6e', '#0891b2'],
  'Pinecrest Family Dentistry': ['#14532d', '#16a34a'],
  'Lumen Eyecare': ['#312e81', '#818cf8'],
  'Summit Roofing Co.': ['#374151', '#9ca3af'],
};

type Props = { name: string; size?: number; fs?: number };

export function LogoDot({ name, size = 28, fs }: Props) {
  const tints = BRAND_TINTS[name] ?? ['#334155', '#64748b'];
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: `linear-gradient(135deg, ${tints[0]} 0%, ${tints[1]} 100%)`,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fs ?? Math.round(size * 0.42),
        fontWeight: 700,
        letterSpacing: '-0.02em',
        flexShrink: 0,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
      }}
    >
      {initials}
    </div>
  );
}

export { BRAND_TINTS };
