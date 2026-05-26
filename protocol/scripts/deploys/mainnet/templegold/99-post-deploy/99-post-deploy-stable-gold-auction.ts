import {
    mine,
    runAsyncMain,
} from '../../../helpers';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { ADDRS, INSTANCES } = await getDeployContext(__dirname);
    
    const auctionConfig = {
        /// Time diff between two auctions. Usually 2 weeks
        auctionsTimeDiff: DEFAULT_SETTINGS.STABLE_GOLD_AUCTION.TIME_DIFF,
        ///  Cooldown after auction start is triggered, to allow deposits
        auctionStartCooldown: DEFAULT_SETTINGS.STABLE_GOLD_AUCTION.START_COOLDOWN,
        /// Minimum Gold distributed to enable auction start
        auctionMinimumDistributedGold: DEFAULT_SETTINGS.STABLE_GOLD_AUCTION.MIN_DISTRIBUTED,
    };
    // auction starter
    await mine(INSTANCES.TEMPLE_GOLD.STABLE_GOLD_AUCTION.setAuctionStarter(ADDRS.TEMPLE_GOLD.AUCTION_AUTOMATION_EOA));
    // auction config
    await mine(INSTANCES.TEMPLE_GOLD.STABLE_GOLD_AUCTION.setAuctionConfig(auctionConfig));
}
  
runAsyncMain(main);
