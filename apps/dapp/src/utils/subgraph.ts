import env from 'constants/env';
import { nullable, z } from 'zod';
import { backOff } from 'exponential-backoff';
import { SpiceAuction } from 'types/typechain';
import { timeStamp } from 'console';
import { useQuery, QueryClient } from '@tanstack/react-query';

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

export function queryProtocolData(): SubGraphQuery<ProtocolDataResp> {
  const label = 'queryProtocolData';
  const request = `
  {
    metrics {
      templePrice
    }
  }`;
  return {
    label,
    request,
    parse: ProtocolDataResp.parse,
  };
}

const ProtocolDataResp = z.object({
  metrics: z.array(
    z.object({
      templePrice: z.string(),
    })
  ),
});
export type ProtocolDataResp = z.infer<typeof ProtocolDataResp>;

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

//----------------------------------------------------------------------------------------------------

export function userTransactions(): SubGraphQuery<UserTransactionsResp> {
  const label = 'UserTransactions';
  const request = `
  {
    userTransactions(orderBy: timestamp, orderDirection: desc) {
        id
        timestamp
        hash
        name
    }
  }`;
  return {
    label,
    request,
    parse: UserTransactionsResp.parse,
  };
}

const UserTransactionsResp = z.object({
  userTransactions: z.array(
    z.object({
      id: z.string(),
      timestamp: z.string(),
      hash: z.string(),
      name: z.string(),
    })
  ),
});
export type UserTransactionsResp = z.infer<typeof UserTransactionsResp>;

//----------------------------------------------------------------------------------------------------

export function userTransactionsDAIGoldAuctions(
  id: string
): SubGraphQuery<UserTransactionsDAIGoldAuctionsResp> {
  const label = 'UserTransactionsDAIGoldAuctions';
  const request = `
  {
     user(id: "${id}") {
        id
       positions(where: {auctionType: StableGoldAuction}) {
           id
           transactions(orderDirection: desc, orderBy: timestamp) {
               id
               timestamp
               hash
               ... on BidTransaction {
                   id
                   bidAmount
                   timestamp
                   hash
               }
               ... on ClaimTransaction {
                   id
                   auctionAmount
                   timestamp
                   hash
               }
           }
       }
    }
  }`;
  return {
    label,
    request,
    parse: UserTransactionsDAIGoldAuctionsResp.parse,
  };
}

const UserTransactionsDAIGoldAuctionsResp = z.object({
  user: z.object({
    id: z.string(),
    positions: z.array(
      z.object({
        id: z.string(),
        transactions: z.array(
          z.union([
            z.object({
              id: z.string(),
              timestamp: z.string(),
              hash: z.string(),
              bidAmount: z.string(),
            }),
            z.object({
              id: z.string(),
              timestamp: z.string(),
              hash: z.string(),
              auctionAmount: z.string(),
            }),
          ])
        ),
      })
    ),
  }),
});

export type UserTransactionsDAIGoldAuctionsResp = z.infer<
  typeof UserTransactionsDAIGoldAuctionsResp
>;

//----------------------------------------------------------------------------------------------------

export function bidsHistoryGoldAuction(
  id: string
): SubGraphQuery<BidsHistoryGoldAuctionResp> {
  const label = 'BidsHistoryGoldAuction';
  const request = `
  {
    stableGoldAuctionInstance(id: "${id}") {
      id
      bidTransaction(orderBy: timestamp, orderDirection: desc) {
        bidAmount
        timestamp
        hash
        price
      }
    }
  }`;
  return {
    label,
    request,
    parse: BidsHistoryGoldAuctionResp.parse,
  };
}

const BidsHistoryGoldAuctionResp = z.object({
  stableGoldAuctionInstance: z.object({
    id: z.string(),
    bidTransaction: z.array(
      z.object({
        bidAmount: z.string(),
        timestamp: z.string(),
        hash: z.string(),
        price: z.string(),
      })
    ),
  }),
});

export type BidsHistoryGoldAuctionResp = z.infer<
  typeof BidsHistoryGoldAuctionResp
>;

//----------------------------------------------------------------------------------------------------

export function stableGoldAuctionInstances(): SubGraphQuery<StableGoldAuctionInstancesResp> {
  const label = 'StableGoldAuctionInstances';
  const request = `
  {
    stableGoldAuctionInstances {
        epoch
        startTime
        endTime
        totalAuctionTokenAmount
        priceRatio
    }
  }`;
  return {
    label,
    request,
    parse: StableGoldAuctionInstancesResp.parse,
  };
}

const StableGoldAuctionInstancesResp = z.object({
  stableGoldAuctionInstances: z.array(
    z.object({
      epoch: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      totalAuctionTokenAmount: z.string(),
      priceRatio: z.string(),
    })
  ),
});
export type StableGoldAuctionInstancesResp = z.infer<
  typeof StableGoldAuctionInstancesResp
>;

//----------------------------------------------------------------------------------------------------

export function user(id: string, auction: string): SubGraphQuery<UserResp> {
  const label = 'User';
  const request = `
  {
    user(id: "${id}") {
        id
        redeemAmount
        rewardAmount
        positions(where: {auctionType: "${auction}"}) {
            auctionInstance {
                id
                epoch
                startTime
                endTime
                priceRatio
                ... on SpiceAuctionInstance {
                    spiceAuction {
                        name
                    }
                }
            }
            totalBidAmount
            hasClaimed
        }
    }
  }`;
  return {
    label,
    request,
    parse: UserResp.parse,
  };
}

const UserResp = z.object({
  user: z
    .object({
      id: z.string(),
      redeemAmount: z.string().nullable(),
      rewardAmount: z.string().nullable(),
      positions: z
        .array(
          z.object({
            auctionInstance: z.object({
              id: z.string(),
              epoch: z.string(),
              startTime: z.string(),
              endTime: z.string(),
              priceRatio: z.string(),
              spiceAuction: z
                .object({
                  name: z.string(),
                })
                .optional(),
            }),
            totalBidAmount: z.string(),
            hasClaimed: z.boolean(),
          })
        )
        .optional(),
    })
    .nullable(),
});
export type UserResp = z.infer<typeof UserResp>;

//----------------------------------------------------------------------------------------------------

export function priceHistory(epoch: string): SubGraphQuery<PriceHistoryResp> {
  const label = 'PriceHistory';
  const request = `
  query PriceHistoryQuery {
    stableGoldAuctionInstances(where: { epoch: "${epoch}" }) {
        epoch
        auctionInstanceDailySnapshots {
            id
            timeframe
            timestamp
            priceRatio
            price
            totalBidTokenAmount
        }
        auctionInstanceHourlySnapshots {
            id
            timeframe
            timestamp
            priceRatio
            price
        }
    }
  }`;

  return {
    label,
    request,
    parse: PriceHistoryResp.parse,
  };
}

const PriceHistoryResp = z.object({
  stableGoldAuctionInstances: z.array(
    z.object({
      epoch: z.string(),
      auctionInstanceDailySnapshots: z.array(
        z.object({
          id: z.string(),
          timeframe: z.string(),
          timestamp: z.string(),
          priceRatio: z.string(),
          price: z.string(),
          totalBidTokenAmount: z.string(),
        })
      ),
      auctionInstanceHourlySnapshots: z.array(
        z.object({
          id: z.string(),
          timeframe: z.string(),
          timestamp: z.string(),
          priceRatio: z.string(),
          price: z.string(),
        })
      ),
    })
  ),
});

export type PriceHistoryResp = z.infer<typeof PriceHistoryResp>;

//----------------------------------------------------------------------------------------------------

export function spiceAuctionFactories(
  id: string
): SubGraphQuery<SpiceAuctionFactoriesResp> {
  const label = 'SpiceAuctionFactories';
  const request = `
  query SpiceAuctionFactoriesQuery {
    spiceAuctionFactories(where: { id: "${id}" }) {
      spiceAuctions {
        auctionInstanceCount
        id
        name
        spiceToken {
          id
          name
          symbol
        }
        templeGold {
          id
          name
          symbol
        }
        isTempleGoldAuctionToken
        auctionInstances {
          epoch
          duration
          startCooldown
          startTime
          totalAuctionTokenAmount
        }
      }
    }
  }`;

  return {
    label,
    request,
    parse: SpiceAuctionFactoriesResp.parse,
  };
}

const SpiceAuctionFactoriesResp = z.object({
  spiceAuctionFactories: z.array(
    z.object({
      spiceAuctions: z.array(
        z.object({
          auctionInstanceCount: z.number(),
          id: z.string(),
          name: z.string(),
          spiceToken: z.object({
            id: z.string(),
            name: z.string(),
            symbol: z.string(),
          }),
          templeGold: z.object({
            id: z.string(),
            name: z.string(),
            symbol: z.string(),
          }),
          isTempleGoldAuctionToken: z.boolean(),
          auctionInstances: z.array(
            z.object({
              epoch: z.string(),
              duration: z.string(),
              startCooldown: z.string(),
              startTime: z.string(),
              totalAuctionTokenAmount: z.string(),
            })
          ),
        })
      ),
    })
  ),
});

export type SpiceAuctionFactoriesResp = z.infer<
  typeof SpiceAuctionFactoriesResp
>;

//----------------------------------------------------------------------------------------------------

export function userTransactionsSpiceAuctions(
  id: string
): SubGraphQuery<UserTransactionsSpiceAuctionsResp> {
  const label = 'UserTransactionsSpiceAuctionsResp';
  const request = `
  {
     user(id: "${id}") {
        id
        positions(where: {auctionType: SpiceAuction}) {
           id
           auctionInstance{
              ... on SpiceAuctionInstance {
                      spiceAuction {
                        name
                    }
                }
           }
           transactions(orderDirection: desc, orderBy: timestamp) {
               id
               timestamp
               hash
               ... on BidTransaction {
                   id
                   bidAmount
                   timestamp
                   hash
               }
               ... on ClaimTransaction {
                   id
                   auctionAmount
                   timestamp
                   hash
               }
           }
       }
    }
  }`;
  return {
    label,
    request,
    parse: UserTransactionsSpiceAuctionsResp.parse,
  };
}

const UserTransactionsSpiceAuctionsResp = z.object({
  user: z
    .object({
      id: z.string(),
      positions: z
        .array(
          z.object({
            id: z.string(),
            auctionInstance: z.object({
              spiceAuction: z
                .object({
                  name: z.string(),
                })
                .optional(),
            }),
            transactions: z.array(
              z.union([
                z.object({
                  id: z.string(),
                  timestamp: z.string(),
                  hash: z.string(),
                  bidAmount: z.string(),
                }),
                z.object({
                  id: z.string(),
                  timestamp: z.string(),
                  hash: z.string(),
                  auctionAmount: z.string(),
                }),
              ])
            ),
          })
        )
        .optional(),
    })
    .nullable(),
});

export type UserTransactionsSpiceAuctionsResp = z.infer<
  typeof UserTransactionsSpiceAuctionsResp
>;

//----------------------------------------------------------------------------------------------------

export function stableGoldAuction(
  id: string
): SubGraphQuery<StableGoldAuctionResp> {
  const label = 'StableGoldAuction';
  const request = `
    {
      stableGoldAuction(id: "${id}") {
        id
        timestamp
        auctionInstanceCount
        auctionInstances {
          id
          timestamp
          auctionType
          epoch
          startTime
          endTime
          totalAuctionTokenAmount
          totalBidTokenAmount
          claimedTokenAmount
          priceRatio
          price
        }
      }
    }
  `;

  return {
    label,
    request,
    parse: StableGoldAuctionResp.parse,
  };
}

const StableGoldAuctionResp = z.object({
  stableGoldAuction: z.object({
    id: z.string(),
    timestamp: z.string(),
    auctionInstanceCount: z.number(),
    auctionInstances: z.array(
      z.object({
        id: z.string(),
        timestamp: z.string(),
        auctionType: z.string(),
        epoch: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        totalAuctionTokenAmount: z.string(),
        totalBidTokenAmount: z.string(),
        claimedTokenAmount: z.string(),
        priceRatio: z.string(),
        price: z.string(),
      })
    ),
  }),
});

export type StableGoldAuctionResp = z.infer<typeof StableGoldAuctionResp>;

//----------------------------------------------------------------------------------------------------

export function spiceAuctionInfoQuery(
  id: string
): SubGraphQuery<SpiceAuctionInfoResp> {
  const label = 'SpiceAuctionInfo';
  const request = `query SpiceAuction {
                spiceAuction(id: "${id}") {
                    id
                    timestamp
                    version
                    auctionInstanceCount
                    name
                    duration
                    waitPeriod
                    minDistAuctionToken
                    isTempleGoldAuctionToken
                    recipient
                    auctionInstances {
                        id
                        timestamp
                        auctionType
                        epoch
                        startTime
                        endTime
                        totalAuctionTokenAmount
                        totalBidTokenAmount
                        claimedTokenAmount
                        priceRatio
                        price
                        redeemedTokenAmount
                        duration
                        waitPeriod
                        minDistAuctionToken
                        isTempleGoldAuctionToken
                        recipient
                    }
                }
            }
  `;

  return {
    label,
    request,
    parse: SpiceAuctionInfoResp.parse,
  };
}

const SpiceAuctionInfoResp = z.object({
  spiceAuction: z.object({
    id: z.string(),
    timestamp: z.string(),
    version: z.string(),
    auctionInstanceCount: z.number(),
    name: z.string(),
    duration: z.string(),
    waitPeriod: z.string(),
    minDistAuctionToken: z.string(),
    isTempleGoldAuctionToken: z.boolean(),
    recipient: z.string(),
    auctionInstances: z.array(
      z.object({
        id: z.string(),
        timestamp: z.string(),
        auctionType: z.string(),
        epoch: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        totalAuctionTokenAmount: z.string(),
        totalBidTokenAmount: z.string(),
        claimedTokenAmount: z.string(),
        priceRatio: z.string(),
        price: z.string(),
        redeemedTokenAmount: z.string(),
        duration: z.string(),
        waitPeriod: z.string(),
        minDistAuctionToken: z.string(),
        isTempleGoldAuctionToken: z.boolean(),
        recipient: z.string(),
      })
    ),
  }),
});

export type SpiceAuctionInfoResp = z.infer<typeof SpiceAuctionInfoResp>;

//----------------------------------------------------------------------------------------------------

export function spiceAuction(id: string): SubGraphQuery<SpiceAuctionResp> {
  const label = 'SpiceAuction';
  const request = `
    {
      spiceAuction(id: "${id}") {
        id
        timestamp
        auctionInstanceCount
        auctionInstances {
          id
          timestamp
          auctionType
          epoch
          startTime
          endTime
          totalAuctionTokenAmount
          totalBidTokenAmount
          claimedTokenAmount
          priceRatio
          price
        }
      }
    }
  `;

  return {
    label,
    request,
    parse: SpiceAuctionResp.parse,
  };
}

const SpiceAuctionResp = z.object({
  spiceAuction: z
    .object({
      id: z.string(),
      timestamp: z.string(),
      auctionInstanceCount: z.number(),
      auctionInstances: z.array(
        z.object({
          id: z.string(),
          timestamp: z.string(),
          auctionType: z.string(),
          epoch: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          totalAuctionTokenAmount: z.string(),
          totalBidTokenAmount: z.string(),
          claimedTokenAmount: z.string(),
          priceRatio: z.string(),
          price: z.string(),
        })
      ),
    })
    .nullable(),
});

export type SpiceAuctionResp = z.infer<typeof SpiceAuctionResp>;

//----------------------------------------------------------------------------------------------------

export const TTL_IN_SECONDS = 30;

export const cachedSubgraphQuery = async <T>(
  subgraphUrl: string,
  query: SubGraphQuery<T>
): Promise<T> => {
  const queryClient = new QueryClient();

  const result = await queryClient.fetchQuery<T>({
    queryKey: [subgraphUrl, query.label] as const,
    queryFn: () => subgraphQuery(subgraphUrl, query),
    staleTime: TTL_IN_SECONDS * 1000,
    cacheTime: TTL_IN_SECONDS * 1000,
  });

  return result;
};

// Hook version for use in React components
export const useCachedSubgraphQuery = <T>(
  subgraphUrl: string,
  query: SubGraphQuery<T>
) => {
  return useQuery<T>({
    queryKey: [subgraphUrl, query.label] as const,
    queryFn: () => subgraphQuery(subgraphUrl, query),
    staleTime: TTL_IN_SECONDS * 1000,
    cacheTime: TTL_IN_SECONDS * 1000,
  });
};
