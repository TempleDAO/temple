import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, getDeployedTempleGoldContracts } from '../contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_ADDRESSES = getDeployedTempleGoldContracts();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    
    const auctionsTimeDiff = 24 * 3600 * 7 * 2;
    const auctionConfig = {
        /// Time diff between two auctions. Usually 2 weeks
        auctionsTimeDiff: auctionsTimeDiff,
        ///  Cooldown after auction start is triggered, to allow deposits
        auctionStartCooldown: 3600,
        /// Minimum Gold distributed to enable auction start
        auctionMinimumDistributedGold: ethers.utils.parseEther("10_000"),
    };
    // auction starter
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.DAI_GOLD_AUCTION.setAuctionStarter(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.AUCTION_AUTOMATION_EOA));
    // auction config
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.DAI_GOLD_AUCTION.setAuctionConfig(auctionConfig));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
