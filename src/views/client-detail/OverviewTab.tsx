import { AreaChart } from '../../components/AreaChart';
import { KPI } from '../../components/KPI';
import { useQuery } from '../../data/context';
import type { ClientKpis } from '../../data/types';

export function OverviewTab({ clientId }: { clientId: string }) {
  const { data: kpis, loading } = useQuery<ClientKpis | null>(
    (p) => p.getClientKpis(clientId),
    [clientId],
  );

  if (loading) {
    return <div className="meta">Loading…</div>;
  }
  if (!kpis) {
    return (
      <div className="card card-pad">
        <span className="meta">No KPI data for this client yet.</span>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
        <KPI label="Spend MTD" value={kpis.spend.value} delta={kpis.spend.delta} seed={kpis.spend.seed} />
        <KPI label="Conversions" value={kpis.conversions.value} delta={kpis.conversions.delta} seed={kpis.conversions.seed} />
        <KPI label="ROAS" value={kpis.roas.value} delta={kpis.roas.delta} seed={kpis.roas.seed} />
        <KPI label="CPL" value={kpis.cpl.value} delta={kpis.cpl.delta} seed={kpis.cpl.seed} />
      </div>
      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Spend over time</span>
        </div>
        <div style={{ padding: 16 }}>
          <AreaChart h={180} seeds={[1, 3, 5]} />
        </div>
      </div>
    </>
  );
}
