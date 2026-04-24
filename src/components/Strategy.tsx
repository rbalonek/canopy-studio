import type { Campaign } from '../data/types';

const STYLES: Record<Campaign['strategy'], string> = {
  'Lead Gen': 'teal',
  'Warm-up': 'indigo',
  ATC: 'indigo',
  VC: 'indigo',
  Traffic: 'indigo',
  Video: 'indigo',
  Purchase: 'amber',
};

export function Strategy({ s }: { s: Campaign['strategy'] }) {
  return (
    <span className={`pill ${STYLES[s] ?? 'gray'}`}>
      <span className="dot" />
      {s}
    </span>
  );
}
