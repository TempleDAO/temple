import { DashboardType } from 'components/Pages/Core/DappPages/Dashboard/DashboardContent';
import { StrategyKey } from 'components/Pages/Core/DappPages/Dashboard/hooks/use-dashboardv2-metrics';
import { TxHistoryAvailableRowsProps, TxHistoryProps } from 'components/Pages/Core/DappPages/Dashboard/hooks/use-dashboardv2-txHistory';

// Centralize all the dApp react query keys in case we need to cancel or invalidate them
// through the app, this makes it easier to track them, please add new ones as required
export const getQueryKey = {
  txHistory: (props: TxHistoryProps) => ['TxHistory', props.dashboardType, props.txFilter, props.rowFilter, props.offset, props.limit, props.blockNumber, props.tableHeaders],
  txHistoryAvailableRows: (props: TxHistoryAvailableRowsProps) => ['TxHistoryAvailableRows', props.dashboardType, props.txFilter, props.rowFilter],
  metrics: (s?: StrategyKey) => (s ? ['getMetrics', s] : ['getMetrics']),
  metricsDashboard: (d: DashboardType) => (['metricsDashboard', d]),
  trvMetrics: (d?: DashboardType) => (d ? ['getTreasureReserveMetrics', d] : ['getTreasureReserveMetrics']),
  allStrategiesDailySnapshots: () => ['strategyDailySnapshots'],
  allStrategiesHourlySnapshots: () => ['strategyHourlySnapshots'],
};
