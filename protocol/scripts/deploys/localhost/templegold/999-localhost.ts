import { ethers, network } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, getDeployedTempleGoldContracts } from '../../arbitrumOne/contract-addresses';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TempleGold__factory, TempleGoldStaking__factory, DaiGoldAuction__factory } from '../../../../typechain';


async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_ADDRESSES = getDeployedTempleGoldContracts();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    // signer 0
    const teamGnosis = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    console.log(`OWNER ${await TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.owner()}`);
    console.log(`OWNER ${await TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.executor()}`);
    const distributionParams = {
        staking: ethers.utils.parseEther("20"),
        daiGoldAuction: ethers.utils.parseEther("70"),
        gnosis: ethers.utils.parseEther("10")
    }
    const vestingFactor = {
        value: 35,
        weekMultiplier: 3600 * 24 * 7 // 1 week
    }
    ///// TEMPLE GOLD
    const templeGold = TempleGold__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD, owner);
    const staking = TempleGoldStaking__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, owner);
    const daiGoldAuction = DaiGoldAuction__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.DAI_GOLD_AUCTION, owner);
    console.log(`TempleGOld: ${await daiGoldAuction.templeGold()}`);
    // // Set and whitelist contracts
    await mine(templeGold.setTeamGnosis(teamGnosis));
    await mine(templeGold.setDaiGoldAuction(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.DAI_GOLD_AUCTION));
    await mine(templeGold.setStaking(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING));
    await mine(templeGold.setVestingFactor(vestingFactor));
    await mine(templeGold.setDistributionParams(distributionParams));
    // // authorize contracts
    await mine(templeGold.authorizeContract(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.DAI_GOLD_AUCTION, true));
    await mine(templeGold.authorizeContract(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, true));
    await mine(templeGold.authorizeContract(teamGnosis, true));

    // ///// Staking
    const duration = 24 * 3600 * 7;
    const unstakeCooldown =  duration * 2; // 2 weeks
    const rewardsDistributionCooldown = 3600; // 1 hour
    // reward duration
    await mine(staking.setRewardDuration(duration));
    // distribution starter
    await mine(staking.setDistributionStarter(teamGnosis));
    // rewards distribution cool down
    await mine(staking.setRewardDistributionCoolDown(rewardsDistributionCooldown));
    // unstake cool down
    await mine(staking.setUnstakeCooldown(unstakeCooldown));

    ////// DAI GOLD AUCTION
    const auctionsTimeDiff = 60;
    const auctionConfig = {
        /// Time diff between two auctions. Usually 2 weeks
        auctionsTimeDiff: auctionsTimeDiff,
        ///  Cooldown after auction start is triggered, to allow deposits
        auctionStartCooldown: 60,
        /// Minimum Gold distributed to enable auction start
        auctionMinimumDistributedGold: ethers.utils.parseEther("0.01"),
    };
    // auction starter
    await mine(daiGoldAuction.setAuctionStarter(teamGnosis));
    // auction config
    await mine(daiGoldAuction.setAuctionConfig(auctionConfig));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
