const PATHS: Record<string, string> = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V11z',
  users: 'M16 11a3 3 0 1 0-6 0 3 3 0 0 0 6 0zM6 20a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4M20 8a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM18 14a3 3 0 0 1 3 3',
  chart: 'M4 20V8M10 20V4M16 20v-7M22 20H2',
  calendar: 'M3 6h18v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6zM3 6V4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2M8 2v4M16 2v4M3 10h18',
  sparkles: 'M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5L12 3zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z',
  brain: 'M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3v1a3 3 0 0 0 3 3h1V3H9zM14 3a3 3 0 0 1 3 3v1a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3v1a3 3 0 0 1-3 3h-1V3h1z',
  check: 'M4 12l5 5L20 6',
  queue: 'M3 5h18M3 12h18M3 19h12',
  report: 'M5 3h10l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8 13h8M8 17h5',
  search: 'M21 21l-4.3-4.3M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  grid: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  list: 'M3 6h18M3 12h18M3 18h18',
  refresh: 'M20 11A8 8 0 1 0 17 18M20 4v6h-6',
  filter: 'M4 4h16l-6 8v6l-4 2v-8L4 4z',
  upload: 'M12 3v14M7 8l5-5 5 5M4 21h16',
  link: 'M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-2 2M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l2-2',
  warn: 'M12 3L2 21h20L12 3zM12 10v5M12 18v.01',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  bolt: 'M13 3L4 14h7l-1 7 9-11h-7l1-7z',
  chev: 'M9 6l6 6-6 6',
  chevd: 'M6 9l6 6 6-6',
  image: 'M3 5h18v14H3zM3 16l5-5 5 5 3-3 5 5M16 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  panel: 'M3 4h18v16H3zM9 4v16',
  bell: 'M6 8a6 6 0 1 1 12 0c0 6 3 8 3 8H3s3-2 3-8zM10 21a2 2 0 0 0 4 0',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
};

type Props = {
  name: keyof typeof PATHS | string;
  size?: number;
  stroke?: number;
};

export function Icon({ name, size = 16, stroke = 1.5 }: Props) {
  const d = PATHS[name] ?? '';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
