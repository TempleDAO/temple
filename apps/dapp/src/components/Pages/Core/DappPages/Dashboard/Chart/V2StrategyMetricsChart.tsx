import { ChartSupportedTimeInterval } from 'utils/time-intervals';
import type { AxisDomain } from 'recharts/types/util/types';
import { useTheme } from 'styled-components';
import { format } from 'date-fns';
import { LineChart } from 'components/Charts';
import Loader from 'components/Loader/Loader';
import { formatNumberFixedDecimals } from 'utils/formatter';
import { formatTimestampedChartData } from 'utils/charts';
import useCoreV2StrategyData, { V2StrategyDailySnapshot, V2StrategyMetric } from "hooks/use-coreV2-strategy-data";
import { DashboardType } from '../DashboardContent';

type XAxisTickFormatter = (timestamp: number) => string;

const tickFormatters: Record<ChartSupportedTimeInterval, XAxisTickFormatter> = {
    '1D': (timestamp) => format(timestamp, 'h aaa'),
    '1W': (timestamp) => format(timestamp, 'eee d LLL'),
    '1M': (timestamp) => format(timestamp, 'MMM do'),
    '1Y': (timestamp) => format(timestamp, 'MMM do y'),
};

const tooltipLabelFormatters: Record<ChartSupportedTimeInterval, XAxisTickFormatter> = {
    ...tickFormatters,
    '1D': (timestamp) => format(timestamp, 'MMM do, h aaa'),
};



const yDomain: AxisDomain = ([dataMin, dataMax]) => [dataMin - dataMin * 0.01, dataMax + dataMax * 0.01];


function transpose(data: V2StrategyDailySnapshot[], metric: V2StrategyMetric, format: MetricFormatter) {
    // in sql this is roughly
    // select timeframe,
    //     max(totalValue) filter(where strategy.name = 'FooStrategy') as FooStrategy,
    //     max(totalValue) filter(where strategy.name = 'BarStrategy') as BarStrategy
    //     ...etc
    // from snapshots
    // group by timeframe;

    type Transposed = { [strategy: string]: number }
    const out = data.reduce((acc, row) => {
        // the timeframe is the UTC midnight for every snapshot
        // so we use it as the group by key
        const ix = row['timeframe'];
        const d = acc[ix] || ({} as Transposed)
        if (!d) {
            acc[ix] = d
        }
        d[row['strategy']['name']] = format(row[metric]);
        acc[ix] = d
        return acc

    }, {} as { [timestamp: string]: Transposed });
    return Object.entries(out).map(([ts, values]) => ({ timestamp: ts, ...values }))
}


type MetricFormatter = (v: string) => number;

const metricFormatters: { [k in V2StrategyMetric]: MetricFormatter } = {
    'accruedInterestUSD': parseFloat,
    'benchmarkPerformance': (value: string)=>parseFloat(value) * 100,
    'benchmarkedEquityUSD': parseFloat,
    'creditUSD': parseFloat,
    'debtUSD': parseFloat,
    'nominalEquityUSD': parseFloat,
    'nominalPerformance': (value: string)=>parseFloat(value) * 100,
    'principalUSD': parseFloat,
    'totalMarketValueUSD': parseFloat
}


const V2StrategyMetricsChart: React.FC<{
    dashboardType: DashboardType ;
    strategyNames: string[]
    selectedMetric: V2StrategyMetric;
    selectedInterval: ChartSupportedTimeInterval;
}> = ({ dashboardType, selectedMetric, selectedInterval, strategyNames }) => {

    const formatMetricName = (name: string) => `${name} (${selectedMetric.endsWith('Performance') ? '%' : 'USD'})`

    const tooltipValuesFormatter = (value: number, name: string) => [
        formatNumberFixedDecimals(value, 2).toString(),
        formatMetricName(name)
    ];

    const theme = useTheme();
    const formatMetric = metricFormatters[selectedMetric]

    const { dailyMetrics } = useCoreV2StrategyData()

    // we need all strategies for the TRV dashboard anyway we can just as well reuse
    // what we have and filter client side

    const filteredData = dailyMetrics
                        ?.filter(m=> strategyNames.includes(m.strategy.name))
                         .sort((a,b) => parseInt(a.timestamp) - parseInt(b.timestamp)) ?? []

    // if we are rendering chart for only one strategy we can use data as is
    // otherwise we have to transpose and show the selected metric for every strategy
    const transformedData = strategyNames.length === 1
        ? filteredData.map(
            m => ({
                timestamp: m.timestamp,
                accruedInterestUSD: metricFormatters.accruedInterestUSD(m.accruedInterestUSD),
                benchmarkPerformance: metricFormatters.benchmarkPerformance(m.benchmarkPerformance),
                benchmarkedEquityUSD: metricFormatters.benchmarkedEquityUSD(m.benchmarkedEquityUSD),
                creditUSD: metricFormatters.creditUSD(m.creditUSD),
                debtUSD: metricFormatters.debtUSD(m.debtUSD),
                nominalEquityUSD: metricFormatters.nominalEquityUSD(m.nominalEquityUSD),
                nominalPerformance: metricFormatters.nominalPerformance(m.nominalPerformance),
                principalUSD: metricFormatters.principalUSD(m.principalUSD),
                totalMarketValueUSD: metricFormatters.totalMarketValueUSD(m.totalMarketValueUSD)
            }))
        : transpose(filteredData, selectedMetric, formatMetric)

    const formattedData = formatTimestampedChartData(
        transformedData,
        [],
        (a) => ({
            ...a,
            timestamp: (typeof a.timestamp === 'string' ? parseInt(a.timestamp) : a.timestamp) * 1000
        }))


    const xDataKey = "timestamp";
    const colors = theme.palette.charts;

    if (formattedData[selectedInterval].length === 0) {
        return <Loader iconSize={48} />
    }

    const metrics = Object.keys(
        formattedData[selectedInterval][0]
    ).filter(k => k !== xDataKey);

    const lines = dashboardType === DashboardType.TREASURY_RESERVES_VAULT
        ? metrics.map((metric, ix) => ({ series: metric, color: colors[ix % colors.length] }))
        : [{series: selectedMetric, color: colors[0]}]
    return (
            <LineChart
                chartData={formattedData[selectedInterval]}
                xDataKey={"timestamp"}
                lines={lines}
                xTickFormatter={tickFormatters[selectedInterval]}
                tooltipLabelFormatter={tooltipLabelFormatters[selectedInterval]}
                legendFormatter={formatMetricName}
                yDomain={yDomain}
                tooltipValuesFormatter={tooltipValuesFormatter}
            />
    );
}

export default V2StrategyMetricsChart;
