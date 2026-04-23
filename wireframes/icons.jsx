/* global React */
// Icons: minimal lucide-style line icons drawn as inline SVG. 16x16 default.
const Icon = ({ name, size = 16, stroke = 1.5, color = "currentColor", style }) => {
  const s = size;
  const p = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", style };
  const paths = {
    home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M15 14.5c3-.3 6.5 1.3 6.5 4.5" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    sparkles: <><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" /></>,
    brand: <><path d="M4 7l8-4 8 4v10l-8 4-8-4V7z" /><path d="M12 3v18M4 7l8 4 8-4" /></>,
    check: <><path d="M20 6L9 17l-5-5" /></>,
    queue: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
    report: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6" /><path d="M8 13h8M8 17h5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.4 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.4 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.4-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.4H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.4 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
    bell: <><path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" /><path d="M10 21a2 2 0 004 0" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    filter: <><path d="M3 5h18l-7 9v5l-4 2v-7L3 5z" /></>,
    chevron_r: <><path d="M9 6l6 6-6 6" /></>,
    chevron_d: <><path d="M6 9l6 6 6-6" /></>,
    chevron_l: <><path d="M15 18l-6-6 6-6" /></>,
    arrow_up: <><path d="M12 19V5M5 12l7-7 7 7" /></>,
    arrow_down: <><path d="M12 5v14M5 12l7 7 7-7" /></>,
    external: <><path d="M14 3h7v7" /><path d="M10 14L21 3" /><path d="M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5" /></>,
    refresh: <><path d="M3 12a9 9 0 0115-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 01-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
    dot: <><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></>,
    bolt: <><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></>,
    edit: <><path d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5" /><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
    x: <><path d="M18 6L6 18M6 6l12 12" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="M21 15l-5-5L5 21" /></>,
    upload: <><path d="M4 17v3a1 1 0 001 1h14a1 1 0 001-1v-3" /><path d="M12 3v14M5 10l7-7 7 7" /></>,
    link: <><path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1" /><path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
    folder: <><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
    lock: <><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
    ai: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="4" /></>,
    kanban: <><rect x="3" y="3" width="5" height="18" rx="1" /><rect x="10" y="3" width="5" height="12" rx="1" /><rect x="17" y="3" width="4" height="8" rx="1" /></>,
    layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
    star: <><path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" /></>,
    flag: <><path d="M4 21V4a1 1 0 011-1h12l-2 4 2 4H5" /></>,
    play: <><path d="M6 3l14 9-14 9V3z" /></>,
    pause: <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
  };
  return <svg {...p}>{paths[name] || <circle cx="12" cy="12" r="6" />}</svg>;
};

window.Icon = Icon;
