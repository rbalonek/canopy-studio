import type { CampaignStatus } from '../data/types';

const STYLES: Record<CampaignStatus, string> = {
  Draft: 'gray',
  Approved: 'teal',
  Scheduled: 'indigo',
  Published: 'green',
  Error: 'red',
  Paused: 'gray',
  Active: 'green',
};

export function Status({ s }: { s: CampaignStatus }) {
  return (
    <span className={`pill ${STYLES[s] ?? 'gray'}`}>
      <span className="dot" />
      {s}
    </span>
  );
}
