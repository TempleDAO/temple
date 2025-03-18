import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, ContractInstances, getDeployedTempleGoldContracts, ContractAddresses } from '../../mainnet/templegold/contract-addresses';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_ADDRESSES = getDeployedTempleGoldContracts();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    
    // await _templeGoldPostDeploy(owner, TEMPLE_GOLD_ADDRESSES, TEMPLE_GOLD_INSTANCES);
    // await _stakingPostDeploy(owner, TEMPLE_GOLD_INSTANCES);
    // await _daiGoldPostDeploy(owner, TEMPLE_GOLD_INSTANCES);
    // await _templeTeleporterPostDeploy();
    // await _setSpiceAuctionConfig(owner, TEMPLE_GOLD_INSTANCES);
}

async function _templeGoldPostDeploy(
    owner: SignerWithAddress,
    TEMPLE_GOLD_ADDRESSES: ContractAddresses,
    TEMPLE_GOLD_INSTANCES: ContractInstances
) {
    const ownerAddress = await owner.getAddress();
    const distributionParams = {
        staking: ethers.utils.parseEther("20"),
        auction: ethers.utils.parseEther("70"),
        gnosis: ethers.utils.parseEther("10")
    }
    const vestingFactor = {
        value: 35,
        weekMultiplier: 3600 * 24 * 7 // 1 week
    }
    // Set and whitelist contracts
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setTeamGnosis(ownerAddress));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setStableGoldAuction(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.STABLE_GOLD_AUCTION));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setStaking(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setVestingFactor(vestingFactor));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setDistributionParams(distributionParams));
    // authorize contracts
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.STABLE_GOLD_AUCTION, true));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, true));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(ownerAddress, true));
}

async function _stakingPostDeploy(
    owner: SignerWithAddress,
    TEMPLE_GOLD_INSTANCES: ContractInstances
) {
    const ownerAddress = await owner.getAddress();
    const ONE_DAY = 24 * 3600;
    const duration = ONE_DAY * 7;
    const unstakeCooldown = ONE_DAY;
    const rewardsDistributionCooldown = 2 * 3600; // 2 minutes
    // reward duration
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setRewardDuration(duration));
    // distribution starter
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setDistributionStarter(ownerAddress));
    // rewards distribution cool down
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setRewardDistributionCoolDown(rewardsDistributionCooldown));
    // unstake cool down
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setUnstakeCooldown(unstakeCooldown));
}

async function _daiGoldPostDeploy(
    owner: SignerWithAddress,
    TEMPLE_GOLD_INSTANCES: ContractInstances
) {
    const ownerAddress = await owner.getAddress();
    const auctionsTimeDiff = 24 * 3600; // 1 hour
    const auctionConfig = {
        /// Time diff between two auctions. Usually 2 weeks
        auctionsTimeDiff: auctionsTimeDiff,
        ///  Cooldown after auction start is triggered, to allow deposits
        auctionStartCooldown: 60,
        /// Minimum Gold distributed to enable auction start
        auctionMinimumDistributedGold: ethers.utils.parseEther("10"),
    };
    // auction starter
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.STABLE_GOLD_AUCTION.setAuctionStarter(ownerAddress));
    // auction config
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.STABLE_GOLD_AUCTION.setAuctionConfig(auctionConfig));
}

async function _templeTeleporterPostDeploy() {
    // Add all temple teleporter contracts cross chain as minters of TEMPLE token
    // ownership of temple is multisig so this is here as a reminder
    // const addresses: string[] = [];
    // for (const address of addresses) {

    // }
}

async function _setSpiceAuctionConfig(
    owner: SignerWithAddress,
    TEMPLE_GOLD_INSTANCES: ContractInstances
) {
    const config = {
        duration: 60 * 60 * 24 * 7,
        waitPeriod: 1, // 1 seocnd. testing reasons
        startCooldown: 10,
        minimumDistributedAuctionToken: 1,
        starter: "0x0000000000000000000000000000000000000000",
        isTempleGoldAuctionToken: true,
        recipient: "0xC785695710292c042a2de8A0Ba16F3a054cC2eAD"
    }

    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.SPICE_AUCTION.setAuctionConfig(config));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
