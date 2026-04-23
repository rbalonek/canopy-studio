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

export type RouteDef = {
  id: RouteId;
  path: string;
  label: string;
  /** If set, the label is replaced when the app is in that mode. */
  labelByMode?: Partial<Record<Mode, string>>;
  section: 'main' | 'workspace' | 'admin' | 'system';
  full?: boolean;
};

export const ROUTES: RouteDef[] = [
  { id: 'overview',      path: '/',              label: 'Overview',          section: 'main' },
  { id: 'clients',       path: '/clients',       label: 'Clients',           labelByMode: { business: 'Locations' }, section: 'main' },
  { id: 'client-detail', path: '/clients/:id',   label: 'Client Detail',     section: 'main' },
  { id: 'ad-perf',       path: '/ad-performance', label: 'Ad Performance',   section: 'workspace' },
  { id: 'ad-studio',     path: '/ad-studio',     label: 'Ad Studio',         section: 'workspace' },
  { id: 'brand',         path: '/brand',         label: 'Brand Intelligence', section: 'workspace' },
  { id: 'calendar',      path: '/calendar',      label: 'Calendar',          section: 'workspace' },
  { id: 'approvals',     path: '/approvals',     label: 'Approvals',         section: 'workspace' },
  { id: 'publish',       path: '/publish',       label: 'Publish',           section: 'workspace' },
  { id: 'reports',       path: '/reports',       label: 'Reports',           section: 'workspace' },
  { id: 'billing',       path: '/billing',       label: 'Billing',           section: 'admin' },
  { id: 'settings',      path: '/settings',      label: 'Settings',          section: 'admin' },
  { id: 'components',    path: '/components',    label: 'Components',        section: 'system' },
  { id: 'golden',        path: '/golden',        label: 'Golden Path',       section: 'system' },
  { id: 'auth',          path: '/auth',          label: 'Auth',              section: 'system', full: true },
  { id: 'onboard',       path: '/onboard',       label: 'Onboard',           section: 'system', full: true },
];
