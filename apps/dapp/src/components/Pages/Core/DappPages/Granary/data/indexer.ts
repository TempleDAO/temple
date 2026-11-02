// The Granary indexer: the Spice Bazaar subgraph's FixedPriceAuction, Pair,
// Wish and Position entities. Queries follow docs/granary-queries.graphql on
// TempleDAO/spice-bazaar-subgraph (branch feat/granary-indexer); docs/granary.md
// there has the model and render rules.
//
// Every read is pinned to one block N from _meta, so a screen's data is
// consistent. Raw amounts are base-unit strings; Position amounts are already
// whole-token decimals.

const PAGE = 1000;

export type RawToken = { id: string; symbol: string; decimals: number };

export type RawMeta = {
  block: { number: number; timestamp: number };
  hasIndexingErrors: boolean;
};

export type RawAuction = {
  id: string;
  fixedPriceAuction: { id: string };
  number: number;
  pair: { id: string };
  bidToken: RawToken;
  auctionToken: RawToken;
  fixedPrice: string;
  minDeposit: string;
  createdAt: string;
  depositStart: string;
  depositEnd: string;
  fulfillmentEnd: string;
  outcome: 'None' | 'Settled' | 'Cancelled';
  settledAt: string;
  settlementEmitted: boolean;
  cancelledAt: string;
  paused: boolean;
  complianceCheck: string;
  complianceDisabled: boolean;
  tgldAuthorized: boolean | null;
  totalDeposits: string;
  funding: string;
  filledBids: string;
  userRefund: string;
};

export type RawPair = {
  id: string;
  bidToken: RawToken;
  fillToken: RawToken;
  auctionCount: number;
};

export type RawPosition = {
  id: string;
  totalBidAmount: string;
  excludedAmount: string;
  hasClaimed: boolean;
  claimedAmount: string;
  claimedRefundAmount: string;
  user: { id: string };
  auctionInstance: RawAuction | Record<string, never>;
};

export type RawWish = {
  id: string;
  account: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  expiresAt: string;
  setAt: string;
};

const TOK = `id symbol decimals`;

const AUCTION = `
  id
  fixedPriceAuction { id }
  number
  pair { id }
  bidToken { ${TOK} }
  auctionToken { ${TOK} }
  fixedPrice
  minDeposit
  createdAt
  depositStart
  depositEnd
  fulfillmentEnd
  outcome
  settledAt
  settlementEmitted
  cancelledAt
  paused
  complianceCheck
  complianceDisabled
  tgldAuthorized
  totalDeposits
  funding
  filledBids
  userRefund
`;

const POSITION = `
  id
  totalBidAmount
  excludedAmount
  hasClaimed
  claimedAmount
  claimedRefundAmount
  user { id }
  auctionInstance { ... on FixedPriceAuctionInstance { ${AUCTION} } }
`;

const WISH = `id account fromToken toToken fromAmount expiresAt setAt`;

export const createIndexer = (url: string) => {
  const query = async <T>(
    label: string,
    q: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, variables }),
    });
    if (!res.ok)
      throw new Error(`Granary indexer ${label}: HTTP ${res.status}`);
    const body = await res.json();
    if (body.errors?.length)
      throw new Error(
        `Granary indexer ${label}: ${JSON.stringify(body.errors)}`
      );
    return body.data as T;
  };

  // Rows past the first 1000, paged by id (the docs' demand cursor).
  const all = async <R extends { id: string }>(
    label: string,
    entity: string,
    where: string,
    fields: string,
    N: number,
    vars: Record<string, unknown> = {},
    varDefs = ''
  ): Promise<R[]> => {
    const rows: R[] = [];
    let idGt = '';
    for (;;) {
      const data = await query<Record<string, R[]>>(
        label,
        `query ${label}($N: Int!, $idGt: ${
          entity === 'positions' ? 'String' : 'Bytes'
        }!${varDefs}) {
          rows: ${entity}(block: { number: $N }, first: ${PAGE}, orderBy: id,
            where: { id_gt: $idGt ${where} }) { ${fields} }
        }`,
        { N, idGt: idGt || (entity === 'positions' ? '' : '0x'), ...vars }
      );
      rows.push(...data.rows);
      if (data.rows.length < PAGE) return rows;
      idGt = data.rows[data.rows.length - 1].id;
    }
  };

  return {
    meta: async (): Promise<RawMeta> =>
      (
        await query<{ _meta: RawMeta }>(
          'Meta',
          `query Meta { _meta { block { number timestamp } hasIndexingErrors } }`
        )
      )._meta,

    auctions: (N: number) =>
      all<RawAuction>(
        'GranaryAuctions',
        'fixedPriceAuctionInstances',
        '',
        AUCTION,
        N
      ),

    pairs: async (N: number) =>
      (
        await query<{ pairs: RawPair[] }>(
          'GranaryPairs',
          `query GranaryPairs($N: Int!) {
            pairs(block: { number: $N }, first: ${PAGE}) {
              id bidToken { ${TOK} } fillToken { ${TOK} } auctionCount
            }
          }`,
          { N }
        )
      ).pairs,

    // every account's wishes and auction positions: the demand inputs
    wishes: (N: number) => all<RawWish>('DemandWishes', 'wishes', '', WISH, N),
    demandPositions: (N: number) =>
      all<RawPosition>(
        'DemandPositions',
        'positions',
        ', auctionType: FixedPriceAuction, totalBidAmount_gt: "0"',
        POSITION,
        N
      ),

    myPositions: (N: number, me: string) =>
      all<RawPosition>(
        'MyPositions',
        'positions',
        ', auctionType: FixedPriceAuction, user_: { id: $me }',
        POSITION,
        N,
        { me },
        ', $me: Bytes!'
      ),

    myWishes: (N: number, me: string) =>
      all<RawWish>(
        'MyWishes',
        'wishes',
        ', account: $me, fromAmount_gt: "0"',
        WISH,
        N,
        { me },
        ', $me: Bytes!'
      ),
  };
};

export type GranaryIndexer = ReturnType<typeof createIndexer>;
