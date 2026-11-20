import type { Address } from 'viem';
import { z } from 'zod';
import {
  auctionSchema as granaryAuctionSchema,
  createGranarySubgraph,
  granaryQuery,
  PAGE_SIZE,
  paginate,
} from '@/tasks/granary/subgraph';
import {
  auctionPhaseAt,
  AuctionPhaseInputs,
} from '@/tasks/granary/auction-phase';
import type { DepositorIndexConfig } from '../config';
import { lcAddress, lcAddressSchema } from '../shared';
import { PositionRead } from './plan';
import type {
  DepositorIndexRead,
  DepositorPosition,
  ElsewhereAuction,
  EnforcedAuction,
} from './run';

type IndexedAuction = z.infer<typeof auctionSchema>;

/**
 * Reads the Depositor index at one indexed block (the Watermark): the
 * factory's compliance-enabled Auctions, split by whether they point at
 * `complianceCheck`, and for those that do, the Positions
 * `PositionRead.forPhase` selects. The subgraph's `totalBidAmount` is the
 * contract's `deposits[account]` and `excludedAmount` its
 * `excluded[account]`.
 */
export async function readDepositorIndex(
  index: DepositorIndexConfig,
  complianceCheck: Address,
  nowSecs: number
): Promise<DepositorIndexRead> {
  const query = granaryQuery(index.subgraphUrl);
  const { number: watermark } = await createGranarySubgraph(
    index.subgraphUrl
  ).snapshot();

  const all = await paginate('auction', async (cursor) => {
    const { auctions } = await query(
      `query EnforceAuctions(
        $block: Int!
        $factory: String!
        $cursor: ID!
      ) {
        auctions: fixedPriceAuctionInstances(
          block: { number: $block }
          first: ${PAGE_SIZE}
          orderBy: id
          orderDirection: asc
          where: {
            id_gt: $cursor
            fixedPriceAuction_: { factory: $factory }
          }
        ) {
          id
          fixedPriceAuction {
            id
          }
          depositStart
          depositEnd
          fulfillmentEnd
          outcome
          complianceCheck
          complianceDisabled
        }
      }`,
      {
        block: watermark,
        factory: lcAddress(index.factory),
        cursor,
      },
      z.object({ auctions: z.array(auctionSchema) })
    );
    return auctions;
  });

  // Disabling compliance is one-way: such an Auction flags nobody and
  // can't be enforced.
  const ours = lcAddress(complianceCheck);
  const enabled = all.filter((a) => !a.complianceDisabled);
  const enforced = enabled.filter((a) => a.complianceCheck === ours);
  const elsewhere = enabled.filter((a) => a.complianceCheck !== ours);

  const phases = enforced.map((a) => ({
    id: a.id,
    reads: PositionRead.forPhase(auctionPhaseAt(a, nowSecs)),
  }));
  const readPositions = (read: PositionRead) => {
    const auctionIds = phases.filter((a) => a.reads[read]).map((a) => a.id);
    return auctionIds.length
      ? paginate('position', async (cursor) => {
          const { positions } = await query(
            `query EnforcePositions($block: Int!, $where: Position_filter!) {
              positions(
                block: { number: $block }
                first: ${PAGE_SIZE}
                orderBy: id
                orderDirection: asc
                where: $where
              ) {
                id
                user {
                  id
                }
                auctionInstance {
                  id
                }
                totalBidAmount
                excludedAmount
                hasClaimed
              }
            }`,
            {
              block: watermark,
              where: {
                ...PositionRead.FILTERS[read].where,
                id_gt: cursor,
                auctionType: 'FixedPriceAuction',
                auctionInstance_in: auctionIds,
              },
            },
            z.object({ positions: z.array(positionSchema) })
          );
          return positions;
        })
      : Promise.resolve([]);
  };
  const withDeposit = await readPositions('deposits');
  const withExcluded = await readPositions('excluded');
  // A Position with both a deposit and an excluded balance comes back twice.
  const positions = new Map<string, DepositorPosition>(
    [...withDeposit, ...withExcluded].map(({ id, ...p }) => [id, p])
  );

  return {
    watermark: BigInt(watermark),
    enforced: enforced.map((a): EnforcedAuction => ({
      id: a.id,
      address: a.fixedPriceAuction.id,
      ...toPhaseInputs(a),
    })),
    elsewhere: elsewhere.map((a): ElsewhereAuction => ({
      address: a.fixedPriceAuction.id,
      complianceCheck: a.complianceCheck,
      ...toPhaseInputs(a),
    })),
    positions: [...positions.values()],
  };
}

/** What `auctionPhaseAt` needs of an indexed Auction. */
function toPhaseInputs(a: IndexedAuction): AuctionPhaseInputs {
  return {
    depositStart: a.depositStart,
    depositEnd: a.depositEnd,
    fulfillmentEnd: a.fulfillmentEnd,
    outcome: a.outcome,
  };
}

const auctionSchema = granaryAuctionSchema
  .pick({
    id: true,
    depositStart: true,
    depositEnd: true,
    fulfillmentEnd: true,
    outcome: true,
  })
  .extend({
    fixedPriceAuction: z.object({ id: lcAddressSchema }),
    complianceCheck: lcAddressSchema,
    complianceDisabled: z.boolean(),
  });

/** A subgraph BigDecimal ("75", "0.5", "0"), parsed to whether it is > 0. */
const positiveSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/)
  .transform((s) => !s.startsWith('-') && /[1-9]/.test(s));

/** A subgraph Position, as the Position id and the DepositorPosition it is. */
const positionSchema = z
  .object({
    id: z.string().min(1),
    user: z.object({ id: lcAddressSchema }),
    auctionInstance: z.object({ id: z.string().min(1) }),
    totalBidAmount: positiveSchema,
    excludedAmount: positiveSchema,
    hasClaimed: z.boolean(),
  })
  .transform((p): DepositorPosition & { id: string } => ({
    id: p.id,
    auctionId: p.auctionInstance.id,
    account: p.user.id,
    hasDeposit: p.totalBidAmount,
    hasClaimed: p.hasClaimed,
    hasExcludedBalance: p.excludedAmount,
  }));
