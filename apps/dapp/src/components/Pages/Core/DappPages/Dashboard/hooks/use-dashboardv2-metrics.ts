import { useQuery } from '@tanstack/react-query';
import millify from 'millify';
import env from 'constants/env';
import { getQueryKey } from 'utils/react-query-helpers';
import {
  DashboardData,
  StrategyKey,
  TrvKey,
  isTRVDashboard,
} from '../DashboardConfig';
import {
  queryBenchmarkRate,
  queryProtocolData,
  queryStrategyBalances,
  queryStrategyData,
  queryTempleCirculatingSupply,
  queryTrvBalances,
  queryTrvData,
  StrategyBalancesResp,
  StrategyDataResp,
  subgraphQuery,
  TrvBalancesResp,
  TrvDataResp,
} from 'utils/subgraph';
import { aprToApy } from 'utils/helpers';

export enum TokenSymbols {
  DAI = 'DAI',
  TEMPLE_DEBT = 'dUSD',
}
export interface TreasuryReservesVaultMetrics {
  totalMarketValue: number;
  spotPrice: number;
  treasuryPriceIndex: number;
  circulatingSupply: number;
  benchmarkRate: number;
  principal: number;
  accruedInterest: number;
  benchmarkedEquity: number;
}

type DashboardMetric = {
  title: string;
  value: string;
};

export interface ArrangedDashboardMetrics {
  metrics: DashboardMetric[][];
  smallMetrics: DashboardMetric[][];
}

export interface StrategyMetrics {
  valueOfHoldings: number;
  benchmarkedEquity: number;
  interestRate: number;
  debtShare: number;
  debtCeiling: number;
  debtCeilingUtilization: number;
  totalRepayment: number;
  principal: number;
  accruedInterest: number;
}

const CACHE_TTL = 1000 * 60;

export default function useDashboardV2Metrics(dashboardData: DashboardData) {
  const dashboardMetrics = useQuery({
    queryKey: getQueryKey.metricsDashboard(dashboardData.key),
    queryFn: async () => {
      if (isTRVDashboard(dashboardData.key)) {
        return getArrangedTreasuryReservesVaultMetrics(
          await fetchTreasuryReservesVaultMetrics()
        );
      }

      return getArrangedStrategyMetrics(
        await fetchStrategyMetrics(dashboardData.key)
      );
    },
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });

  const fetchStrategyMetrics = async (
    strategy: StrategyKey | TrvKey
  ): Promise<StrategyMetrics> => {
    let metrics = {
      valueOfHoldings: 0,
      benchmarkedEquity: 0,
      interestRate: 0,
      debtShare: 0,
      debtCeiling: 0,
      debtCeilingUtilization: 0,
      totalRepayment: 0,
      principal: 0,
      accruedInterest: 0,
    };

    try {
      const allMetricsPromises = [
        subgraphQuery(env.subgraph.templeV2, queryStrategyData()),

        // includes the external balances so has to come from the second subgraph
        subgraphQuery(env.subgraph.templeV2Balances, queryStrategyBalances()),
      ];

      const [responses, responseExternalBalances] = await Promise.all(
        allMetricsPromises
      );

      const subgraphData = (responses as StrategyDataResp).strategies.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_strategy: any) =>
          _strategy.name === strategy && _strategy.isShutdown === false
      );

      const externalBalancesData = (
        responseExternalBalances as StrategyBalancesResp
      ).strategies.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_strategy: any) =>
          _strategy.name === strategy && _strategy.isShutdown === false
      );

      const daiStrategyTokenData = subgraphData!.strategyTokens.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_strategyToken: any) => _strategyToken.symbol === TokenSymbols.DAI
      );

      metrics = {
        valueOfHoldings: parseFloat(externalBalancesData!.totalMarketValueUSD),
        benchmarkedEquity: parseFloat(
          externalBalancesData!.benchmarkedEquityUSD
        ),
        interestRate: aprToApy(
          parseFloat(daiStrategyTokenData!.rate) +
            parseFloat(daiStrategyTokenData!.premiumRate)
        ),
        debtShare: parseFloat(daiStrategyTokenData!.debtShare),
        debtCeiling: parseFloat(daiStrategyTokenData!.debtCeiling),
        debtCeilingUtilization: parseFloat(
          daiStrategyTokenData!.debtCeilingUtil
        ),
        totalRepayment: parseFloat(subgraphData!.totalRepaymentUSD),
        principal: parseFloat(subgraphData!.principalUSD),
        accruedInterest: parseFloat(subgraphData!.accruedInterestUSD),
      };
    } catch (error) {
      console.info(error);
    }

    return metrics;
  };

  const fetchTreasuryReservesVaultMetrics =
    async (): Promise<TreasuryReservesVaultMetrics> => {
      let metrics: TreasuryReservesVaultMetrics = {
        totalMarketValue: 0,
        spotPrice: 0,
        treasuryPriceIndex: 0,
        circulatingSupply: 0,
        benchmarkRate: 0,
        principal: 0,
        accruedInterest: 0,
        benchmarkedEquity: 0,
      };

      try {
        const allMetricsPromises = [
          subgraphQuery(env.subgraph.templeV2, queryTrvData()),

          // includes the external balances so has to come from the second subgraph
          subgraphQuery(env.subgraph.templeV2Balances, queryTrvBalances()),

          getBenchmarkRate(),
          getTempleCirculatingSupply(),
          getTempleSpotPrice(),
        ];

        const [
          trvSubgraphResponse,
          responseExternalBalances,
          benchmarkRate,
          templeCirculatingSupply,
          templeSpotPrice,
        ] = await Promise.all(allMetricsPromises);

        const trvSubgraphData = (trvSubgraphResponse as TrvDataResp)
          .treasuryReservesVaults[0];

        const externalBalancesData = (
          responseExternalBalances as TrvBalancesResp
        ).treasuryReservesVaults[0];

        metrics = {
          totalMarketValue: parseFloat(
            externalBalancesData.totalMarketValueUSD
          ),
          spotPrice: parseFloat(templeSpotPrice as string),
          treasuryPriceIndex: parseFloat(trvSubgraphData.treasuryPriceIndex),
          circulatingSupply: parseFloat(templeCirculatingSupply as string),
          benchmarkRate: aprToApy(parseFloat(benchmarkRate as string)),
          principal: parseFloat(trvSubgraphData.principalUSD),
          accruedInterest: parseFloat(trvSubgraphData.accruedInterestUSD),
          benchmarkedEquity: parseFloat(
            externalBalancesData.benchmarkedEquityUSD
          ),
        };
      } catch (error) {
        console.info(error);
      }

      return metrics;
    };

  const getBenchmarkRate = async () => {
    const debtTokensResponse = await subgraphQuery(
      env.subgraph.templeV2,
      queryBenchmarkRate()
    );

    const debtTokensData = debtTokensResponse.debtTokens;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return debtTokensData.find(
      (debtToken: any) => debtToken.symbol === TokenSymbols.TEMPLE_DEBT
    )?.baseRate;
  };

  const getTempleCirculatingSupply = async (): Promise<string> => {
    const response = await subgraphQuery(
      env.subgraph.protocolMetrics,
      queryTempleCirculatingSupply()
    );
    return response.metrics[0].templeCirculatingSupply;
  };

  const getTempleSpotPrice = async () => {
    const response = await subgraphQuery(env.subgraph.protocolMetrics, queryProtocolData());
    return response.metrics[0].templePrice;
  };

  const formatPercent = (input: number) => {
    return (Math.round(input * 10_000) / 100).toFixed(2);
  };

  /**
   * This function will format a number into a string with commas and a decimal point
   * It uses the millify library to add K, M, or B (thousand, million, million)
   * to the end of the number if it is large enough
   */
  const formatBigMoney = (input: number) => {
    return millify(input, { precision: 2 });
  };

  const formatPrice = (input: number) => {
    return input.toFixed(2);
  };

  /**
   * This function will return the metrics in the format that the DashboardMetrics component expects
   * Metrics and small metrics, each containing an array of arrays
   * Small metrics appear below the "main" metrics and are formatted smaller, without a border, etc.
   * Each array represents a row of metrics
   */
  const getArrangedTreasuryReservesVaultMetrics = (
    metrics: TreasuryReservesVaultMetrics
  ) => {
    return {
      metrics: [
        [
          {
            title: 'Total Market Value',
            value: `$${formatBigMoney(metrics.totalMarketValue)}`,
          },
          {
            title: 'Spot Price',
            value: `${formatPrice(metrics.spotPrice)} DAI`,
          },
          {
            title: 'Treasury Price Index',
            value: `${formatPrice(metrics.treasuryPriceIndex)} DAI`,
          },
          {
            title: 'Circulating Supply',
            value: `$${formatBigMoney(metrics.circulatingSupply)}`,
          },
          {
            title: 'Benchmark Rate',
            value: `${formatPercent(metrics.benchmarkRate)}% p.a.`,
          },
        ],
      ],
      smallMetrics: [
        [
          {
            title: 'Principal',
            value: `$${formatBigMoney(metrics.principal)}`,
          },
          {
            title: 'Accrued Interest',
            value: `$${formatBigMoney(metrics.accruedInterest)}`,
          },
          {
            title: 'Benchmarked Equity',
            value: `$${formatBigMoney(metrics.benchmarkedEquity)}`,
          },
        ],
      ],
    };
  };

  /**
   * This function will return the metrics in the format that the DashboardMetrics component expects
   * Metrics and small metrics, each containing an array of arrays
   * Small metrics appear below the "main" metrics and are formatted smaller, without a border, etc.
   * Each array represents a row of metrics
   */
  const getArrangedStrategyMetrics = (metrics: StrategyMetrics) => {
    return {
      metrics: [
        [
          {
            title: 'Value of Holdings',
            value: `$${formatBigMoney(metrics.valueOfHoldings)}`,
          },
          {
            title: 'Benchmarked Equity',
            value: `$${formatBigMoney(metrics.benchmarkedEquity)}`,
          },
          {
            title: 'Interest Rate',
            value: `${formatPercent(metrics.interestRate)}%`,
          },
        ],
      ],
      smallMetrics: [
        [
          {
            title: 'Debt Share (DAI)',
            value: `${formatPercent(metrics.debtShare)}%`,
          },
          {
            title: 'Debt Ceiling (DAI)',
            value: `${formatBigMoney(metrics.debtCeiling)}`,
          },
          {
            title: 'Debt Ceiling Utilization',
            value: `${formatPercent(metrics.debtCeilingUtilization)}%`,
          },
        ],
        [
          {
            title: 'Total Repayment',
            value: `$${formatBigMoney(metrics.totalRepayment)}`,
          },
          {
            title: 'Principal',
            value: `$${formatBigMoney(metrics.principal)}`,
          },
          {
            title: 'Accrued Interest',
            value: `$${formatBigMoney(metrics.accruedInterest)}`,
          },
        ],
      ],
    };
  };

  return {
    dashboardMetrics,
    getArrangedTreasuryReservesVaultMetrics,
    getArrangedStrategyMetrics,
  };
}
