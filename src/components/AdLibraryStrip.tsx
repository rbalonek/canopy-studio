import { AdThumb, type AdThumbKind } from './AdThumb';

const KINDS: AdThumbKind[] = ['photo', 'offer', 'product', 'bg'];

type Props = {
  seed?: number;
  brand?: string;
  n?: number;
};

export function AdLibraryStrip({ seed = 1, brand, n = 4 }: Props) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${n},1fr)`, gap: 4 }}
    >
      {Array.from({ length: n }).map((_, i) => (
        <AdThumb
          key={i}
          seed={seed * 10 + i}
          brand={brand}
          kind={KINDS[i % 4]}
          headline=""
          h={56}
        />
      ))}
    </div>
  );
}
