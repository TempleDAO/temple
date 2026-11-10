import { describe, expect, test } from 'vitest';
import { GRANARY_DEPLOYMENTS } from './config';
import { createGranarySubgraph } from './subgraph';

// Read-only checks against each deployment's real subgraph. Opt in with
// GRANARY_LIVE=1.
describe.skipIf(!process.env.GRANARY_LIVE).each(GRANARY_DEPLOYMENTS)(
  'Granary live subgraph ($network)',
  (deployment) => {
    test('queries real indexed snapshots, auction instances and updated wishes', async () => {
      const graph = createGranarySubgraph(deployment.subgraphUrl);
      const factory = deployment.fixedPriceAuctionFactory.toLowerCase();
      const snapshot = await graph.snapshot();

      const auctions = await graph.auctions(snapshot, factory);
      await graph.auctions(
        { ...snapshot, number: snapshot.number - 1 },
        factory
      );
      const wishes = await graph.wishes(snapshot, 0);

      expect(snapshot.number).toBeGreaterThan(0);
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(auctions.length).toBeGreaterThan(0);
      expect(wishes.length).toBeGreaterThan(0);

      const latestWishBlock = Number(
        wishes.reduce(
          (latest, w) => (w.setBlock > latest ? w.setBlock : latest),
          0n
        )
      );
      expect(await graph.wishes(snapshot, latestWishBlock)).toEqual([]);
    }, 90000);

    // Block 12023502 precedes the first Sepolia auction.
    test.runIf(deployment.network === 'sepolia')(
      'pins auction queries to a historical block',
      async () => {
        const graph = createGranarySubgraph(deployment.subgraphUrl);
        const factory = deployment.fixedPriceAuctionFactory.toLowerCase();

        expect(
          await graph.auctions({ number: 12023502, timestamp: 0 }, factory)
        ).toEqual([]);
      },
      90000
    );
  }
);
