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
  /**
   * Subpath relative to the mounting shell's prefix. "" is the index for
   * the shell. May contain :params (e.g. "clients/:id"). The leading
   * slash is omitted so we can compose `${prefix}/${subpath}` cleanly.
   */
  subpath: string;
  /**
   * Concrete subpath the sidebar should link to (resolves :params to a
   * real value). Falls back to `subpath` when not set.
   */
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
 *
 * These subpaths are mounted by a Shell with a prefix (currently `/dev`;
 * later `/app` will mount the same routes for the live, auth-gated flow).
 */
export const ROUTES: RouteDef[] = [
  { id: 'components',    subpath: 'components',    label: 'Component Library', icon: 'grid',     section: 'design-system' },

  { id: 'overview',      subpath: '',              label: 'Overview',          icon: 'home',     section: 'workspace' },
  { id: 'clients',       subpath: 'clients',       label: 'Clients',           labelByMode: { business: 'Locations' }, icon: 'users', section: 'workspace' },
  { id: 'client-detail', subpath: 'clients/:id',   navTo: 'clients/acme',      label: 'Client Detail', labelByMode: { business: 'Location Detail' }, icon: 'users', section: 'workspace' },
  { id: 'ad-perf',       subpath: 'ad-performance', label: 'Ad Performance',   icon: 'chart',    section: 'workspace' },
  { id: 'calendar',      subpath: 'calendar',      label: 'Content Calendar',  icon: 'calendar', section: 'workspace' },
  { id: 'ad-studio',     subpath: 'ad-studio',     label: 'Ad Studio',         icon: 'sparkles', section: 'workspace', ai: true },
  { id: 'brand',         subpath: 'brand',         label: 'Brand Intelligence', icon: 'brain',   section: 'workspace' },
  { id: 'approvals',     subpath: 'approvals',     label: 'Approvals',         icon: 'check',    section: 'workspace' },
  { id: 'publish',       subpath: 'publish',       label: 'Publishing Queue',  icon: 'queue',    section: 'workspace' },
  { id: 'reports',       subpath: 'reports',       label: 'Reports',           icon: 'report',   section: 'workspace' },
  { id: 'settings',      subpath: 'settings',      label: 'Settings',          icon: 'gear',     section: 'workspace' },
  { id: 'billing',       subpath: 'billing',       label: 'Billing Detail',    icon: 'report',   section: 'workspace' },

  { id: 'auth',          subpath: 'auth',          label: 'Auth Shell',        icon: 'link',     section: 'flows', full: true },
  { id: 'onboard',       subpath: 'onboard',       label: 'Onboarding Wizard', icon: 'bolt',     section: 'flows', full: true },
  { id: 'golden',        subpath: 'golden',        label: 'Golden-Path Flows', icon: 'sparkles', section: 'flows' },
];

/** Build an absolute URL for a route under a given shell prefix. */
export function routePath(prefix: string, subpath: string): string {
  return subpath ? `${prefix}/${subpath}` : prefix;
}
