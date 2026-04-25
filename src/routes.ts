export type Mode = 'agency' | 'business';

export type RouteId =
  | 'overview'
  | 'clients'
  | 'client-detail'
  | 'ad-perf'
  | 'calendar'
  | 'ad-studio'
  | 'brand'
  | 'approvals'
  | 'publish'
  | 'reports'
  | 'billing'
  | 'settings'
  | 'auth'
  | 'onboard'
  | 'golden'
  | 'components';

export type SidebarSection = 'design-system' | 'workspace' | 'flows';

export type RouteDef = {
  id: RouteId;
  /** Routable URL (with `:id`-style params for dynamic routes). */
  path: string;
  /** URL the sidebar links to (resolves params to a sensible default). */
  navTo?: string;
  label: string;
  /** If set, the label is replaced when the app is in that mode. */
  labelByMode?: Partial<Record<Mode, string>>;
  icon: string;
  section: SidebarSection;
  /** Show the indigo AI ✦ marker next to the label. */
  ai?: boolean;
  /** Hide the topbar when this route is active (sidebar still shows). */
  full?: boolean;
};

export const SECTION_LABELS: Record<SidebarSection, string> = {
  'design-system': 'Design System',
  workspace: 'Workspace',
  flows: 'Flows',
};

/**
 * Order matters — the sidebar walks this list and emits a section header
 * each time the section changes, exactly like the original wireframe.
 */
export const ROUTES: RouteDef[] = [
  { id: 'components',    path: '/components',    label: 'Component Library', icon: 'grid',     section: 'design-system' },

  { id: 'overview',      path: '/',              label: 'Overview',          icon: 'home',     section: 'workspace' },
  { id: 'clients',       path: '/clients',       label: 'Clients',           labelByMode: { business: 'Locations' }, icon: 'users', section: 'workspace' },
  { id: 'client-detail', path: '/clients/:id',   navTo: '/clients/acme',     label: 'Client Detail', labelByMode: { business: 'Location Detail' }, icon: 'users', section: 'workspace' },
  { id: 'ad-perf',       path: '/ad-performance', label: 'Ad Performance',   icon: 'chart',    section: 'workspace' },
  { id: 'calendar',      path: '/calendar',      label: 'Content Calendar',  icon: 'calendar', section: 'workspace' },
  { id: 'ad-studio',     path: '/ad-studio',     label: 'Ad Studio',         icon: 'sparkles', section: 'workspace', ai: true },
  { id: 'brand',         path: '/brand',         label: 'Brand Intelligence', icon: 'brain',   section: 'workspace' },
  { id: 'approvals',     path: '/approvals',     label: 'Approvals',         icon: 'check',    section: 'workspace' },
  { id: 'publish',       path: '/publish',       label: 'Publishing Queue',  icon: 'queue',    section: 'workspace' },
  { id: 'reports',       path: '/reports',       label: 'Reports',           icon: 'report',   section: 'workspace' },
  { id: 'settings',      path: '/settings',      label: 'Settings',          icon: 'gear',     section: 'workspace' },
  { id: 'billing',       path: '/billing',       label: 'Billing Detail',    icon: 'report',   section: 'workspace' },

  { id: 'auth',          path: '/auth',          label: 'Auth Shell',        icon: 'link',     section: 'flows', full: true },
  { id: 'onboard',       path: '/onboard',       label: 'Onboarding Wizard', icon: 'bolt',     section: 'flows', full: true },
  { id: 'golden',        path: '/golden',        label: 'Golden-Path Flows', icon: 'sparkles', section: 'flows' },
];
