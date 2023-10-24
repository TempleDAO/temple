import { useQuery } from '@tanstack/react-query';
import millify from 'millify';
import { fetchGenericSubgraph, fetchSubgraph } from 'utils/subgraph';
import { DashboardType } from '../DashboardContent';
import env from 'constants/env';
import { useMemo } from 'react';

export enum StrategyKey {
  RAMOS = 'RamosStrategy',
  TLC = 'TlcStrategy',
  TEMPLEBASE = 'TempleBaseStrategy',
  DSRBASE = 'DsrBaseStrategy',
}

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
  nominalEquity: number;
  nominalPerformance: number;
  benchmarkedEquity: number;
  benchmarkPerformance: number;
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
  nominalEquity: number;
  benchmarkedEquity: number;
  interestRate: number;
  debtShare: number;
  debtCeiling: number;
  debtCeilingUtilization: number;
  totalRepayment: number;
  principal: number;
  accruidInterest: number;
  nominalPerformance: number;
  benchmarkPerformance: number;
}



const CACHE_TTL = 1000 * 60;

export default function useDashboardV2Metrics() {
  // TODO: In the future we can refactor this.
  // Ideally should not enumerate every strategy but instead do it dynamically
  // by e.g. iterating over the StrategyKey enum
  // type MetricsMap = {
  //   [strategy in StrategyKey]: UseQueryResult<StrategyMetrics>;
  // };

  const ramosMetrics = useQuery({
    queryKey: ['getMetrics', StrategyKey.RAMOS],
    queryFn: async () => {
      const metrics = await fetchStrategyMetrics(StrategyKey.RAMOS);
      return metrics;
    },
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });

  const tlcMetrics = useQuery({
    queryKey: ['getMetrics', StrategyKey.TLC],
    queryFn: async () => {
      const metrics = await fetchStrategyMetrics(StrategyKey.TLC);
      return metrics;
    },
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });

  const templeBaseMetrics = useQuery({
    queryKey: ['getMetrics', StrategyKey.TEMPLEBASE],
    queryFn: async () => {
      const metrics = await fetchStrategyMetrics(StrategyKey.TEMPLEBASE);
      return metrics;
    },
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });

  const dsrBaseMetrics = useQuery({
    queryKey: ['getMetrics', StrategyKey.DSRBASE],
    queryFn: async () => {
      const metrics = await fetchStrategyMetrics(StrategyKey.DSRBASE);
      return metrics;
    },
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });

  const treasuryReservesVaultMetrics = useQuery({
    queryKey: ['getMetrics', DashboardType.TREASURY_RESERVES_VAULT],
    queryFn: async () => {
      const metrics = await fetchTreasuryReservesVaultMetrics();
      return metrics;
    },
    refetchInterval: CACHE_TTL,
    staleTime: CACHE_TTL,
  });

  const isLoading = useMemo(() => {
    return (
      ramosMetrics.isLoading ||
      tlcMetrics.isLoading ||
      templeBaseMetrics.isLoading ||
      dsrBaseMetrics.isLoading ||
      treasuryReservesVaultMetrics.isLoading
    );
  }, [
    ramosMetrics.isLoading,
    tlcMetrics.isLoading,
    templeBaseMetrics.isLoading,
    dsrBaseMetrics.isLoading,
    treasuryReservesVaultMetrics.isLoading,
  ]);

  const fetchStrategyMetrics = async (strategy: StrategyKey): Promise<StrategyMetrics> => {
    let metrics = {
      valueOfHoldings: 0,
      nominalEquity: 0,
      benchmarkedEquity: 0,
      interestRate: 0,
      debtShare: 0,
      debtCeiling: 0,
      debtCeilingUtilization: 0,
      totalRepayment: 0,
      principal: 0,
      accruidInterest: 0,
      nominalPerformance: 0,
      benchmarkPerformance: 0,
    };

    try {
      const allMetricsPromises = [
        fetchGenericSubgraph<any>(
          env.subgraph.templeV2,
          `{
            strategies {
              name
              id
              totalMarketValueUSD
              nominalEquityUSD
              benchmarkedEquityUSD
              strategyTokens {
                symbol
                rate
                premiumRate
                debtShare
                debtCeiling
                debtCeilingUtil
              }
              totalRepaymentUSD
              principalUSD
              accruedInterestUSD
              nominalPerformance
              benchmarkPerformance
            }
      }`
        ),
      ];

      const [ramosSubgraphResponse] = await Promise.all(allMetricsPromises);

      const ramosSubgraphData = ramosSubgraphResponse?.data?.strategies.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_strategy: any) => _strategy.name === strategy
      );

      const daiStrategyTokenData = ramosSubgraphData?.strategyTokens.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_strategyToken: any) => _strategyToken.symbol === TokenSymbols.DAI
      );

      metrics = {
        valueOfHoldings: parseFloat(ramosSubgraphData.totalMarketValueUSD),
        nominalEquity: parseFloat(ramosSubgraphData.nominalEquityUSD),
        benchmarkedEquity: parseFloat(ramosSubgraphData.benchmarkedEquityUSD),
        interestRate: parseFloat(daiStrategyTokenData.rate) + parseFloat(daiStrategyTokenData.premiumRate),
        debtShare: parseFloat(daiStrategyTokenData.debtShare),
        debtCeiling: parseFloat(daiStrategyTokenData.debtCeiling),
        debtCeilingUtilization: parseFloat(daiStrategyTokenData.debtCeilingUtil),
        totalRepayment: parseFloat(ramosSubgraphData.totalRepaymentUSD),
        principal: parseFloat(ramosSubgraphData.principalUSD),
        accruidInterest: parseFloat(ramosSubgraphData.accruedInterestUSD),
        nominalPerformance: parseFloat(ramosSubgraphData.nominalPerformance),
        benchmarkPerformance: parseFloat(ramosSubgraphData.benchmarkPerformance),
      };
    } catch (error) {
      console.info(error);
    }

    return metrics;
  };

  const fetchTreasuryReservesVaultMetrics = async (): Promise<TreasuryReservesVaultMetrics> => {
    let metrics: TreasuryReservesVaultMetrics = {
      totalMarketValue: 0,
      spotPrice: 0,
      treasuryPriceIndex: 0,
      circulatingSupply: 0,
      benchmarkRate: 0,
      principal: 0,
      accruedInterest: 0,
      nominalEquity: 0,
      nominalPerformance: 0,
      benchmarkedEquity: 0,
      benchmarkPerformance: 0,
    };

    try {
      const allMetricsPromises = [
        fetchGenericSubgraph(
          env.subgraph.templeV2,
          `{
          treasuryReservesVaults {
            totalMarketValueUSD
            treasuryPriceIndex
            principalUSD
            accruedInterestUSD
            nominalEquityUSD
            nominalPerformance
            benchmarkedEquityUSD
            benchmarkPerformance
          }
      }`
        ),
        getBenchmarkRate(),
        getTempleCirculatingSupply(),
        getTempleSpotPrice(),
      ];

      const [trvSubgraphResponse, benchmarkRate, templeCirculatingSupply, templeSpotPrice] = await Promise.all(
        allMetricsPromises
      );

      const trvSubgraphData = trvSubgraphResponse?.data?.treasuryReservesVaults[0];

      metrics = {
        totalMarketValue: parseFloat(trvSubgraphData.totalMarketValueUSD),
        spotPrice: parseFloat(templeSpotPrice),
        treasuryPriceIndex: parseFloat(trvSubgraphData.treasuryPriceIndex),
        circulatingSupply: parseFloat(templeCirculatingSupply),
        benchmarkRate: parseFloat(benchmarkRate),
        principal: parseFloat(trvSubgraphData.principalUSD),
        accruedInterest: parseFloat(trvSubgraphData.accruedInterestUSD),
        nominalEquity: parseFloat(trvSubgraphData.nominalEquityUSD),
        nominalPerformance: parseFloat(trvSubgraphData.nominalPerformance),
        benchmarkedEquity: parseFloat(trvSubgraphData.benchmarkedEquityUSD),
        benchmarkPerformance: parseFloat(trvSubgraphData.benchmarkPerformance),
      };
    } catch (error) {
      console.info(error);
    }

    return metrics;
  };

  const getBenchmarkRate = async () => {
    const debtTokensResponse = await fetchGenericSubgraph<any>(
      env.subgraph.templeV2,
      `{
        debtTokens {
          name
          symbol
          baseRate
        }
      }`
    );

    const debtTokensData = debtTokensResponse?.data?.debtTokens;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return debtTokensData.find((debtToken: any) => debtToken.symbol === TokenSymbols.TEMPLE_DEBT)?.baseRate;
  };

  const getTempleCirculatingSupply = async (): Promise<string> => {
    const response = await fetchSubgraph<any>(
      `{
        protocolMetrics(first: 1, orderBy: timestamp, orderDirection: desc) {
          templeCirculatingSupply
        }
      }`
    );

    const data = response?.data?.protocolMetrics?.[0] || {};

    return data.templeCirculatingSupply;
  };

  const getTempleSpotPrice = async () => {
    const response = await fetchGenericSubgraph<any>(
      env.subgraph.templeV2,
      `{
          tokens {
             name
             price
           }
      }`
    );

    const tokenData = response?.data?.tokens;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return tokenData.find((token: any) => token.name === 'Temple')?.price;
  };

  const formatPercent = (input: number) => {
    return Math.round(input * 100).toFixed(2);
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
  const getArrangedTreasuryReservesVaultMetrics = (metrics: TreasuryReservesVaultMetrics) => {
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
        ],
        [
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
            title: 'Accrued dUSD Interest',
            value: `$${formatBigMoney(metrics.accruedInterest)}`,
          },
          {
            title: 'Nominal Equity',
            value: `$${formatBigMoney(metrics.nominalEquity)}`,
          },
          {
            title: 'Nominal Performance',
            value: `${formatPercent(metrics.nominalPerformance)}%`,
          },
        ],
        [
          {
            title: 'Benchmarked Equity',
            value: `$${formatBigMoney(metrics.benchmarkedEquity)}`,
          },
          {
            title: 'Benchmark Performance',
            value: `${formatPercent(metrics.benchmarkPerformance)}%`,
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
            title: 'Nominal Equity',
            value: `$${formatBigMoney(metrics.nominalEquity)}`,
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
            title: 'Debt Share',
            value: `${formatPercent(metrics.debtShare)}%`,
          },
          {
            title: 'Debt Ceiling',
            value: `$${formatBigMoney(metrics.debtCeiling)}`,
          },
          {
            title: 'Debt Ceiling Utilization',
            value: `${formatPercent(metrics.debtCeilingUtilization)}%`,
          },
          {
            title: 'Total Repayment',
            value: `${formatBigMoney(metrics.totalRepayment)} DAI`,
          },
        ],
        [
          {
            title: 'Principal',
            value: `$${formatBigMoney(metrics.principal)}`,
          },
          {
            title: 'Accrued dUSD Interest',
            value: `$${formatBigMoney(metrics.benchmarkedEquity)}`,
          },
          {
            title: 'Nominal Performance',
            value: `${formatPercent(metrics.nominalPerformance)}%`,
          },
          {
            title: 'Benchmark Performance',
            value: `${formatPercent(metrics.benchmarkPerformance)}%`,
          },
        ],
      ],
    };
  };

  return {
    isLoading,
    tlcMetrics,
    ramosMetrics,
    templeBaseMetrics,
    dsrBaseMetrics,
    treasuryReservesVaultMetrics,
    getArrangedTreasuryReservesVaultMetrics,
    getArrangedStrategyMetrics,
  };
}
