import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../../helpers';
import { connectToContracts, getDeployedContracts } from '../contract-addresses';
import { DEFAULT_SETTINGS } from '../default-settings';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const ADDRS = getDeployedContracts();
    const INSTANCES = connectToContracts(owner);
    
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
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
