import millify from 'millify';
import { fetchGenericSubgraph, fetchSubgraph } from 'utils/subgraph';
import { DashboardType } from '../DashboardContent';
import env from 'constants/env';

enum Strategy {
  RAMOS = 'RamosStrategy',
  TLC = 'TlcStrategy',
}

enum Token {
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

export class DashboardMetricsService {
  constructor() {
    console.debug('DashboardMetrics constructor');
  }

  async getMetrics(dashboardType: DashboardType): Promise<ArrangedDashboardMetrics> {
    switch (dashboardType) {
      case DashboardType.TREASURY_RESERVES_VAULT:
        const rawMetrics = await this.fetchTreasuryReservesVaultMetrics();
        return this.getArrangedTreasuryReservesVaultMetrics(rawMetrics);
      case DashboardType.RAMOS:
        const ramosMetrics = await this.fetchStrategyMetrics(Strategy.RAMOS);
        return this.getArrangedStrategyMetrics(ramosMetrics);
      case DashboardType.TLC:
        const tlcMetrics = await this.fetchStrategyMetrics(Strategy.TLC);
        return this.getArrangedStrategyMetrics(tlcMetrics);
      default:
        return {
          metrics: [],
          smallMetrics: [],
        };
    }
  }

  async fetchStrategyMetrics(strategy: Strategy): Promise<StrategyMetrics> {
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
        fetchGenericSubgraph(
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
        (_strategyToken: any) => _strategyToken.symbol === Token.DAI
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
  }

  async fetchTreasuryReservesVaultMetrics(): Promise<TreasuryReservesVaultMetrics> {
    let metrics = {
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
      // TODO: move the subgraph url to an env variable
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
        this.getBenchmarkRate(),
        this.getTempleCirculatingSupply(),
        this.getTempleSpotPrice(),
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
  }

  private async getBenchmarkRate() {
    const debtTokensResponse = await fetchGenericSubgraph(
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
    return debtTokensData.find((debtToken: any) => debtToken.symbol === Token.TEMPLE_DEBT)?.baseRate;
  }

  private async getTempleCirculatingSupply(): Promise<string> {
    const response = await fetchSubgraph(
      `{
        protocolMetrics(first: 1, orderBy: timestamp, orderDirection: desc) {
          templeCirculatingSupply
        }
      }`
    );

    const data = response?.data?.protocolMetrics?.[0] || {};

    return data.templeCirculatingSupply;
  }

  private async getTempleSpotPrice() {
    const response = await fetchGenericSubgraph(
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
  }

  formatPercent(input: number) {
    return Math.round(input * 100).toFixed(2);
  }

  /**
   * This function will format a number into a string with commas and a decimal point
   * It uses the millify library to add K, M, or B (thousand, million, million)
   * to the end of the number if it is large enough
   */
  formatBigMoney(input: number) {
    return millify(input, { precision: 2 });
  }

  /**
   * This function will return the metrics in the format that the DashboardMetrics component expects
   * Metrics and small metrics, each containing an array of arrays
   * Small metrics appear below the "main" metrics and are formatted smaller, without a border, etc.
   * Each array represents a row of metrics
   */
  getArrangedTreasuryReservesVaultMetrics(metrics: TreasuryReservesVaultMetrics) {
    return {
      metrics: [
        [
          {
            title: 'Total Market Value',
            value: `$${this.formatBigMoney(metrics.totalMarketValue)}`,
          },
          {
            title: 'Spot Price',
            value: `${metrics.spotPrice} DAI`,
          },
          {
            title: 'Treasury Price Index',
            value: `${metrics.treasuryPriceIndex} DAI`,
          },
        ],
        [
          {
            title: 'Circulating Supply',
            value: `$${this.formatBigMoney(metrics.circulatingSupply)}`,
          },
          {
            title: 'Benchmark Rate',
            value: `${this.formatPercent(metrics.benchmarkRate)}% p.a.`,
          },
        ],
      ],
      smallMetrics: [
        [
          {
            title: 'Principal',
            value: `$${this.formatBigMoney(metrics.principal)}`,
          },
          {
            title: 'Accrued dUSD Interest',
            value: `$${this.formatBigMoney(metrics.accruedInterest)}`,
          },
          {
            title: 'Nominal Equity',
            value: `$${this.formatBigMoney(metrics.nominalEquity)}`,
          },
          {
            title: 'Nominal Performance',
            value: `${this.formatPercent(metrics.nominalPerformance)}%`,
          },
        ],
        [
          {
            title: 'Benchmarked Equity',
            value: `$${this.formatBigMoney(metrics.benchmarkedEquity)}`,
          },
          {
            title: 'Benchmark Performance',
            value: `${this.formatPercent(metrics.benchmarkPerformance)}%`,
          },
        ],
      ],
    };
  }

  /**
   * This function will return the metrics in the format that the DashboardMetrics component expects
   * Metrics and small metrics, each containing an array of arrays
   * Small metrics appear below the "main" metrics and are formatted smaller, without a border, etc.
   * Each array represents a row of metrics
   */
  getArrangedStrategyMetrics(metrics: StrategyMetrics) {
    return {
      metrics: [
        [
          {
            title: 'Value of Holdings',
            value: `$${this.formatBigMoney(metrics.valueOfHoldings)}`,
          },
          {
            title: 'Nominal Equity',
            value: `$${this.formatBigMoney(metrics.nominalEquity)}`,
          },
          {
            title: 'Benchmarked Equity',
            value: `$${this.formatBigMoney(metrics.benchmarkedEquity)}`,
          },
          {
            title: 'Interest Rate',
            value: `${this.formatPercent(metrics.interestRate)}%`,
          },
        ],
      ],
      smallMetrics: [
        [
          {
            title: 'Debt Share',
            value: `${this.formatPercent(metrics.debtShare)}%`,
          },
          {
            title: 'Debt Ceiling',
            value: `$${this.formatBigMoney(metrics.debtCeiling)}`,
          },
          {
            title: 'Debt Ceiling Utilization',
            value: `${this.formatPercent(metrics.debtCeilingUtilization)}%`,
          },
          {
            title: 'Total Repayment',
            value: `${metrics.totalRepayment} DAI`,
          },
        ],
        [
          {
            title: 'Principal',
            value: `$${this.formatBigMoney(metrics.principal)}`,
          },
          {
            title: 'Accrued dUSD Interest',
            value: `$${this.formatBigMoney(metrics.benchmarkedEquity)}`,
          },
          {
            title: 'Nominal Performance',
            value: `${this.formatPercent(metrics.nominalPerformance)}%`,
          },
          {
            title: 'Benchmark Performance',
            value: `${this.formatPercent(metrics.benchmarkPerformance)}%`,
          },
        ],
      ],
    };
  }
}
