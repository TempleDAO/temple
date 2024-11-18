import env from 'constants/env';
import { z } from 'zod';
import { backOff } from 'exponential-backoff';

/** A typed query to subgraph  */
interface SubGraphQuery<T> {
  label: string;
  request: string;
  parse(response: unknown): T;
}

//----------------------------------------------------------------------------------------------------

export function queryTlcDailySnapshots(): SubGraphQuery<TlcDailySnapshotsResp> {
  const label = 'queryTlcDailySnapshots';
  const request = `
  {
    tlcDailySnapshots(orderBy: timestamp, orderDirection: desc) {
      timestamp
      utilRatio
      interestYield
    }
  }`;
  return {
    label,
    request,
    parse: TlcDailySnapshotsResp.parse,
  };
}

const TlcDailySnapshotsResp = z.object({
  tlcDailySnapshots: z.array(
    z.object({
      timestamp: z.string(),
      utilRatio: z.string(),
      interestYield: z.string(),
    })
  ),
});
export type TlcDailySnapshotsResp = z.infer<typeof TlcDailySnapshotsResp>;

//----------------------------------------------------------------------------------------------------

export function queryTlcMinBorrowAmount(): SubGraphQuery<TlcMinBorrowAmountResp> {
  const label = 'queryTlcMinBorrowAmount';
  const request = `
  {
    tlcDailySnapshots(orderBy: timestamp, orderDirection: desc, first: 1) {
      minBorrowAmount
    }
  }`;
  return {
    label,
    request,
    parse: TlcMinBorrowAmountResp.parse,
  };
}

const TlcMinBorrowAmountResp = z.object({
  tlcDailySnapshots: z.array(
    z.object({
      minBorrowAmount: z.string(),
    })
  ),
});
export type TlcMinBorrowAmountResp = z.infer<typeof TlcMinBorrowAmountResp>;

//----------------------------------------------------------------------------------------------------

export function queryTrvData(): SubGraphQuery<TrvDataResp> {
  const label = 'queryTrvData';
  const request = `
  {
    treasuryReservesVaults {
      principalUSD
      benchmarkedEquityUSD
      treasuryPriceIndex
      accruedInterestUSD
    }
  }`;
  return {
    label,
    request,
    parse: TrvDataResp.parse,
  };
}

const TrvDataResp = z.object({
  treasuryReservesVaults: z.array(
    z.object({
      principalUSD: z.string(),
      benchmarkedEquityUSD: z.string(),
      treasuryPriceIndex: z.string(),
      accruedInterestUSD: z.string(),
    })
  ),
});
export type TrvDataResp = z.infer<typeof TrvDataResp>;

//----------------------------------------------------------------------------------------------------

export function queryTrvBalances(): SubGraphQuery<TrvBalancesResp> {
  const label = 'queryTrvBalances';
  const request = `
  {
    treasuryReservesVaults {
      totalMarketValueUSD
      benchmarkedEquityUSD
    }
  }`;
  return {
    label,
    request,
    parse: TrvBalancesResp.parse,
  };
}

const TrvBalancesResp = z.object({
  treasuryReservesVaults: z.array(
    z.object({
      totalMarketValueUSD: z.string(),
      benchmarkedEquityUSD: z.string(),
    })
  ),
});
export type TrvBalancesResp = z.infer<typeof TrvBalancesResp>;

//----------------------------------------------------------------------------------------------------

export function queryRamosData(): SubGraphQuery<RamosDataResp> {
  const label = 'queryRamosData';
  const request = `
  {
    metrics {
      spotPrice
    }
  }`;
  return {
    label,
    request,
    parse: RamosDataResp.parse,
  };
}

const RamosDataResp = z.object({
  metrics: z.array(
    z.object({
      spotPrice: z.string(),
    })
  ),
});
export type RamosDataResp = z.infer<typeof RamosDataResp>;

//----------------------------------------------------------------------------------------------------

export function queryTlcPrices(): SubGraphQuery<TlcPricesResp> {
  const label = 'queryTlcPrices';
  const request = `
  {
    tokens {
      price
      symbol
    }
    treasuryReservesVaults {
      treasuryPriceIndex
    }
  }`;
  return {
    label,
    request,
    parse: TlcPricesResp.parse,
  };
}

const TlcPricesResp = z.object({
  tokens: z.array(
    z.object({
      price: z.string(),
      symbol: z.string(),
    })
  ),
  treasuryReservesVaults: z.array(
    z.object({
      treasuryPriceIndex: z.string(),
    })
  ),
});
export type TlcPricesResp = z.infer<typeof TlcPricesResp>;

//----------------------------------------------------------------------------------------------------

const V2StrategySnapshot = z.object({
  strategy: z.object({
    name: z.string(),
  }),
  timeframe: z.string(),
  timestamp: z.string(),
  totalMarketValueUSD: z.string(),
  debtUSD: z.string(),
  netDebtUSD: z.string(),
  creditUSD: z.string(),
  principalUSD: z.string(),
  accruedInterestUSD: z.string(),
  benchmarkedEquityUSD: z.string(),
  strategyTokens: z.array(
    z.object({
      symbol: z.string(),
      debtUSD: z.string(),
      creditUSD: z.string(),
      assetBalance: z.string(),
      marketValueUSD: z.string(),
      principalUSD: z.string(),
      accruedInterestUSD: z.string(),
    })
  ),
});
export type V2StrategySnapshot = z.infer<typeof V2StrategySnapshot>;

export function queryStrategyHourlySnapshots(
  v2SnapshotMetrics: readonly string[],
  strategyTokenFields: readonly string[],
  itemsPerPage: number,
  since: string
): SubGraphQuery<StrategyHourlySnapshotsResp> {
  const label = 'queryStrategyHourlySnapshots';
  const request = `
  query {
    strategyHourlySnapshots(
      first: ${itemsPerPage},
      orderBy: timestamp,
      orderDirection: asc,
      where: {timestamp_gt: ${since}}
    ) {
      strategy {
        name
      }
      timeframe
      timestamp
      ${v2SnapshotMetrics.join('\n')}
      strategyTokens {
        ${strategyTokenFields.join('\n')}
      }
    }
  }`;
  return {
    label,
    request,
    parse: StrategyHourlySnapshotsResp.parse,
  };
}

const StrategyHourlySnapshotsResp = z.object({
  strategyHourlySnapshots: z.array(V2StrategySnapshot),
});
export type StrategyHourlySnapshotsResp = z.infer<
  typeof StrategyHourlySnapshotsResp
>;

export function queryStrategyDailySnapshots(
  v2SnapshotMetrics: readonly string[],
  strategyTokenFields: readonly string[],
  itemsPerPage: number,
  since: string,
  skip: number
): SubGraphQuery<StrategyDailySnapshotsResp> {
  const label = 'queryStrategyDailySnapshots';
  const request = `
  query {
    strategyDailySnapshots(
      first: ${itemsPerPage},
      orderBy: timestamp,
      orderDirection: asc,
      where: {timestamp_gt: ${since}}
      skip: ${skip}
    ) {
      strategy {
        name
      }
      timeframe
      timestamp
      ${v2SnapshotMetrics.join('\n')}
      strategyTokens {
        ${strategyTokenFields.join('\n')}
      }
    }
  }`;
  return {
    label,
    request,
    parse: StrategyDailySnapshotsResp.parse,
  };
}

const StrategyDailySnapshotsResp = z.object({
  strategyDailySnapshots: z.array(V2StrategySnapshot),
});
export type StrategyDailySnapshotsResp = z.infer<
  typeof StrategyDailySnapshotsResp
>;

//----------------------------------------------------------------------------------------------------

export function queryTempleCirculatingSupply(): SubGraphQuery<TempleCirculatingSupplyResp> {
  const label = 'queryTempleCirculatingSupply';
  const request = `
  {
    metrics(first: 1, orderBy: timestamp, orderDirection: desc) {
      templeCirculatingSupply
    }
  }`;
  return {
    label,
    request,
    parse: TempleCirculatingSupplyResp.parse,
  };
}

const TempleCirculatingSupplyResp = z.object({
  metrics: z.array(
    z.object({
      templeCirculatingSupply: z.string(),
    })
  ),
});
export type TempleCirculatingSupplyResp = z.infer<
  typeof TempleCirculatingSupplyResp
>;

//----------------------------------------------------------------------------------------------------

export function queryBenchmarkRate(): SubGraphQuery<BenchmarkRateResp> {
  const label = 'queryBenchmarkRate';
  const request = `
  {
    debtTokens {
      name
      symbol
      baseRate
    }
  }`;
  return {
    label,
    request,
    parse: BenchmarkRateResp.parse,
  };
}

const BenchmarkRateResp = z.object({
  debtTokens: z.array(
    z.object({
      name: z.string(),
      symbol: z.string(),
      baseRate: z.string(),
    })
  ),
});
export type BenchmarkRateResp = z.infer<typeof BenchmarkRateResp>;

//----------------------------------------------------------------------------------------------------

export function queryStrategyData(): SubGraphQuery<StrategyDataResp> {
  const label = 'queryStrategyData';
  const request = `
  {
    strategies {
      name
      isShutdown
      id
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
    }
  }`;
  return {
    label,
    request,
    parse: StrategyDataResp.parse,
  };
}

const StrategyDataResp = z.object({
  strategies: z.array(
    z.object({
      name: z.string(),
      isShutdown: z.boolean(),
      id: z.string(),
      strategyTokens: z.array(
        z.object({
          symbol: z.string(),
          rate: z.string(),
          premiumRate: z.string(),
          debtShare: z.string(),
          debtCeiling: z.string(),
          debtCeilingUtil: z.string(),
        })
      ),
      totalRepaymentUSD: z.string(),
      principalUSD: z.string(),
      accruedInterestUSD: z.string(),
    })
  ),
});
export type StrategyDataResp = z.infer<typeof StrategyDataResp>;

//----------------------------------------------------------------------------------------------------

export function queryStrategyTransactions(
  orderBy: string,
  orderType: string,
  offset: number,
  limit: number,
  whereQuery: string
): SubGraphQuery<StrategyTransactionsResp> {
  const label = 'queryStrategyTransactions';
  const request = `
  {
    strategyTransactions(
      orderBy: ${orderBy}
      orderDirection: ${orderType}
      skip: ${offset}
      first: ${limit}
      ${whereQuery}
    ) {
      hash
      strategy {
        id
        name
      }
      token {
        id
        name
        symbol
      }
      amount
      amountUSD
      id
      from
      name
      timestamp
    }
  }`;
  return {
    label,
    request,
    parse: StrategyTransactionsResp.parse,
  };
}

const StrategyTransactions = z.array(
  z.object({
    hash: z.string(),
    strategy: z.object({
      id: z.string(),
      name: z.string(),
    }),
    token: z.object({
      id: z.string(),
      name: z.string(),
      symbol: z.string(),
    }),
    amount: z.string(),
    amountUSD: z.string(),
    id: z.string(),
    from: z.string(),
    name: z.string(),
    timestamp: z.string(),
  })
);
export type StrategyTransactions = z.infer<typeof StrategyTransactions>;

const StrategyTransactionsResp = z.object({
  strategyTransactions: StrategyTransactions,
});
export type StrategyTransactionsResp = z.infer<typeof StrategyTransactionsResp>;

//----------------------------------------------------------------------------------------------------

export function queryStrategyTransactionsMeta(
  whereQuery: string
): SubGraphQuery<StrategyTransactionsMetaResp> {
  const label = 'queryStrategyTransactionsMeta';
  const request = `
  {
    metrics {
      strategyTransactionCount
    }
    strategyTransactions(
      ${whereQuery}
    ) {
      hash
    }
    _meta {
      block {
        number
      }
    }
  }`;
  return {
    label,
    request,
    parse: StrategyTransactionsMetaResp.parse,
  };
}

const StrategyTransactionsMetaResp = z.object({
  metrics: z.array(
    z.object({
      strategyTransactionCount: z.number(),
    })
  ),
  strategyTransactions: z.array(
    z.object({
      hash: z.string(),
    })
  ),
  _meta: z.object({
    block: z.object({
      number: z.number(),
    }),
  }),
});
export type StrategyTransactionsMetaResp = z.infer<
  typeof StrategyTransactionsMetaResp
>;

//----------------------------------------------------------------------------------------------------

export function queryStrategyBalances(): SubGraphQuery<StrategyBalancesResp> {
  const label = 'queryStrategyBalances';
  const request = `
  {
    strategies {
      name
      isShutdown
      id
      benchmarkedEquityUSD
      totalMarketValueUSD
    }
  }`;
  return {
    label,
    request,
    parse: StrategyBalancesResp.parse,
  };
}

const StrategyBalancesResp = z.object({
  strategies: z.array(
    z.object({
      name: z.string(),
      isShutdown: z.boolean(),
      id: z.string(),
      benchmarkedEquityUSD: z.string(),
      totalMarketValueUSD: z.string(),
    })
  ),
});
export type StrategyBalancesResp = z.infer<typeof StrategyBalancesResp>;

//----------------------------------------------------------------------------------------------------

export async function subgraphQuery<T>(
  url: string,
  query: SubGraphQuery<T>
): Promise<T> {
  const response = await rawSubgraphQuery(url, query.label, query.request);
  return query.parse(response);
}

export async function rawSubgraphQuery(
  url: string,
  label: string,
  query: string
): Promise<unknown> {
  return backOff(() => _rawSubgraphQuery(url, label, query), {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    retry: (e: any, attemptNumber: number) => {
      if ((e as FetchError).httpStatus === 429) {
        console.info(
          `received 429 from subgraph api, retry ${attemptNumber} ...`
        );
        return true;
      }
      return false;
    },
  });
}

async function _rawSubgraphQuery(
  url: string,
  label: string,
  query: string
): Promise<unknown> {
  if (env.enableSubgraphLogs) {
    console.log('subgraph-request', label, query);
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new FetchError(
      response.status,
      `rawSubgraphQuery failed with status: ${
        response.status
      }, body: ${await response.text()}`
    );
  }

  const rawResults = await response.json();

  if (env.enableSubgraphLogs) {
    console.log('subgraph-response', label, rawResults);
  }
  if (rawResults.errors !== undefined) {
    throw new Error(
      `Unable to fetch ${label} from subgraph: ${rawResults.errors}`
    );
  }

  return rawResults.data as unknown;
}

class FetchError extends Error {
  constructor(readonly httpStatus: number, message: string) {
    super(message);
  }
}
