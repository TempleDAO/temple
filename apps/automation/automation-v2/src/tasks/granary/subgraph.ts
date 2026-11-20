import axios from 'axios';
import { z } from 'zod';

const PAGE_SIZE = 1000;

export const addressSchema = z
  .string()
  .regex(/^0x[\da-f]{40}$/i)
  .transform((s) => s.toLowerCase());
const uintSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((s) => BigInt(s));
const hashSchema = z
  .string()
  .regex(/^0x[\da-f]{64}$/i)
  .transform((s) => s.toLowerCase());
const tokenSchema = z.object({
  id: addressSchema,
  symbol: z.string(),
  decimals: z.number().int().min(0).max(255),
  metadataPending: z.boolean().nullable().optional(),
});
const tokenFields = 'id symbol decimals metadataPending';

const auctionSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  epoch: uintSchema,
  fixedPriceAuction: z.object({ id: addressSchema }),
  pair: z.object({ bidToken: tokenSchema, fillToken: tokenSchema }),
  depositStart: uintSchema,
  depositEnd: uintSchema,
  fulfillmentEnd: uintSchema,
  outcome: z.enum(['None', 'Settled', 'Cancelled']),
  filledBids: uintSchema,
  totalDeposits: uintSchema,
  createdAt: uintSchema,
  createdHash: hashSchema,
  // Zero until the auction is settled by event or cancelled.
  settledAt: uintSchema,
  cancelledAt: uintSchema,
});

const wishSchema = z.object({
  id: z.string().min(1),
  fromAmount: uintSchema,
  expiresAt: uintSchema,
  setBlock: uintSchema,
  setAt: uintSchema,
  setHash: hashSchema,
  pair: z.object({ bidToken: tokenSchema, fillToken: tokenSchema }),
});

export type Auction = z.infer<typeof auctionSchema>;
export type Wish = z.infer<typeof wishSchema>;
export type Token = z.infer<typeof tokenSchema>;
export const snapshotSchema = z.object({
  number: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type GranarySubgraph = ReturnType<typeof createGranarySubgraph>;

async function paginate<T extends { id: string }>(
  entity: string,
  fetchPage: (cursor: string) => Promise<T[]>
): Promise<T[]> {
  const result: T[] = [];
  let cursor = '';

  for (;;) {
    const page = await fetchPage(cursor);
    result.push(...page);

    if (page.length < PAGE_SIZE) return result;

    const next = page.at(-1)!.id;
    if (next <= cursor)
      throw new Error(`Granary ${entity} cursor did not advance`);

    cursor = next;
  }
}

export function createGranarySubgraph(endpoint: string) {
  async function query<S extends z.ZodTypeAny>(
    document: string,
    variables: object,
    schema: S
  ): Promise<z.output<S>> {
    let response;

    try {
      response = await axios.post(
        endpoint,
        { query: document, variables },
        { timeout: 30000 }
      );
    } catch {
      throw new Error('Granary subgraph request failed');
    }

    const envelope = z
      .object({ data: z.unknown(), errors: z.array(z.unknown()).optional() })
      .parse(response.data);

    if (envelope.errors?.length)
      throw new Error('Granary subgraph returned GraphQL errors');

    return schema.parse(envelope.data);
  }

  async function snapshot(): Promise<Snapshot> {
    const { _meta } = await query(
      `query GranaryMeta {
        _meta {
          hasIndexingErrors
          block {
            number
            timestamp
          }
        }
      }`,
      {},
      z.object({
        _meta: z.object({
          hasIndexingErrors: z.literal(false),
          block: snapshotSchema,
        }),
      })
    );

    return _meta.block;
  }

  async function auctions(
    block: Snapshot,
    factory: string
  ): Promise<Auction[]> {
    return paginate('auction', async (cursor) => {
      const { auctions } = await query(
        `query GranaryAuctions(
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
            number
            epoch
            fixedPriceAuction {
              id
            }
            pair {
              bidToken {
                ${tokenFields}
              }
              fillToken {
                ${tokenFields}
              }
            }
            depositStart
            depositEnd
            fulfillmentEnd
            outcome
            filledBids
            totalDeposits
            createdAt
            createdHash
            settledAt
            cancelledAt
          }
        }`,
        { block: block.number, factory, cursor },
        z.object({ auctions: z.array(auctionSchema) })
      );

      return auctions;
    });
  }

  async function wishes(block: Snapshot, sinceBlock: number) {
    return paginate('wish', async (cursor) => {
      const { wishes } = await query(
        `query GranaryWishes(
          $block: Int!
          $sinceBlock: BigInt!
          $cursor: ID!
        ) {
          wishes(
            block: { number: $block }
            first: ${PAGE_SIZE}
            orderBy: id
            orderDirection: asc
            where: { setBlock_gt: $sinceBlock, id_gt: $cursor }
          ) {
            id
            fromAmount
            expiresAt
            setBlock
            setAt
            setHash
            pair {
              bidToken {
                ${tokenFields}
              }
              fillToken {
                ${tokenFields}
              }
            }
          }
        }`,
        { block: block.number, sinceBlock: sinceBlock.toString(), cursor },
        z.object({ wishes: z.array(wishSchema) })
      );

      return wishes;
    });
  }

  return { snapshot, auctions, wishes };
}
