import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
    runAsyncMain,
} from '../../../helpers';
import { connectToContracts, ContractInstances, getDeployedContracts, ContractAddresses } from '../contract-addresses';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { EnforcedOptionParamStruct } from '../../../../../typechain/@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { owner, ADDRS, INSTANCES } = await getDeployContext(__dirname);
    
    // await _templeGoldPostDeploy(owner, ADDRS, INSTANCES);
    // await _stakingPostDeploy(owner, INSTANCES);
    // await _daiGoldPostDeploy(owner, INSTANCES);
    // await _templeTeleporterPostDeploy();
    // await _setSpiceAuctionConfig(INSTANCES);
}

async function _templeGoldPostDeploy(
    owner: SignerWithAddress,
    ADDRS: ContractAddresses,
    INSTANCES: ContractInstances
) {
    const ownerAddress = await owner.getAddress();
    const distributionParams = {
        staking: DEFAULT_SETTINGS.TEMPLE_GOLD.DISTRIBUTION.STAKING,
        auction: DEFAULT_SETTINGS.TEMPLE_GOLD.DISTRIBUTION.AUCTION,
        gnosis: DEFAULT_SETTINGS.TEMPLE_GOLD.DISTRIBUTION.GNOSIS
    }
    const vestingFactor = {
        value: DEFAULT_SETTINGS.TEMPLE_GOLD.VESTING.VALUE,
        weekMultiplier: DEFAULT_SETTINGS.TEMPLE_GOLD.VESTING.WEEK_MULTIPLIER
    }
    // Set and whitelist contracts
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setTeamGnosis(ownerAddress));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setStableGoldAuction(ADDRS.TEMPLE_GOLD.STABLE_GOLD_AUCTION));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setStaking(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD_STAKING));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setVestingFactor(vestingFactor));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setDistributionParams(distributionParams));
    // authorize contracts
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(ADDRS.TEMPLE_GOLD.STABLE_GOLD_AUCTION, true));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, true));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(ownerAddress, true));

    // set enforced options
    const options: EnforcedOptionParamStruct[] = [{
        eid: DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_LZ_EID,
        msgType: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.MSG_TYPE,
        options: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.OPTIONS, // 200k gas limit
    }];
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setEnforcedOptions(options));
}

async function _stakingPostDeploy(
    owner: SignerWithAddress,
    INSTANCES: ContractInstances
) {
    const ownerAddress = await owner.getAddress();
    // reward duration
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setRewardDuration(DEFAULT_SETTINGS.STAKING.REWARDS_DURATION));
    // distribution starter
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setDistributionStarter(ownerAddress));
    // rewards distribution cool down
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setRewardDistributionCoolDown(DEFAULT_SETTINGS.STAKING.REWARDS_COOLDOWN));
    // unstake cool down
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING.setUnstakeCooldown(DEFAULT_SETTINGS.STAKING.UNSTAKE_COOLDOWN));
}

async function _daiGoldPostDeploy(
    owner: SignerWithAddress,
    INSTANCES: ContractInstances
) {
    const ownerAddress = await owner.getAddress();
    const auctionConfig = {
        auctionsTimeDiff: DEFAULT_SETTINGS.STABLE_GOLD_AUCTION.TIME_DIFF,
        auctionStartCooldown: DEFAULT_SETTINGS.STABLE_GOLD_AUCTION.START_COOLDOWN,
        auctionMinimumDistributedGold: DEFAULT_SETTINGS.STABLE_GOLD_AUCTION.MIN_DISTRIBUTED,
    };
    // auction starter
    await mine(INSTANCES.TEMPLE_GOLD.STABLE_GOLD_AUCTION.setAuctionStarter(ownerAddress));
    // auction config
    await mine(INSTANCES.TEMPLE_GOLD.STABLE_GOLD_AUCTION.setAuctionConfig(auctionConfig));
}

async function _templeTeleporterPostDeploy() {
    // Add all temple teleporter contracts cross chain as minters of TEMPLE token
}

async function _setSpiceAuctionConfig(
    INSTANCES: ContractInstances
) {
    const config = {
        duration: DEFAULT_SETTINGS.SPICE.AUCTION.DURATION,
        waitPeriod: 1, // 1 seocnd. testing reasons
        startCooldown: 10,
        minimumDistributedAuctionToken: 1,
        starter: "0x0000000000000000000000000000000000000000",
        isTempleGoldAuctionToken: true,
        recipient: DEFAULT_SETTINGS.SPICE.AUCTION.RECIPIENT
    }

    await mine(INSTANCES.TEMPLE_GOLD.SPICE_AUCTION!.setAuctionConfig(config));
}

runAsyncMain(main);
