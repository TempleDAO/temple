import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../../helpers';
import { connectToContracts, getDeployedContracts } from '../contract-addresses';
import { Constants as BERACHAIN_CONSTANTS } from '../../../berachain/constants';
import { EnforcedOptionParamStruct } from '../../../../../typechain/@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3';
import { TempleGold } from '../../../../../typechain';
import { DEFAULT_SETTINGS } from '../default-settings';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const ADDRS = getDeployedContracts();
    const INSTANCES = connectToContracts(owner);
    const teamGnosis = ADDRS.TEMPLE_GOLD.TEAM_GNOSIS;
    
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
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setTeamGnosis(teamGnosis));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setStableGoldAuction(ADDRS.TEMPLE_GOLD.STABLE_GOLD_AUCTION));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setStaking(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD_STAKING));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setVestingFactor(vestingFactor));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setDistributionParams(distributionParams));
    // authorize contracts
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(ADDRS.TEMPLE_GOLD.STABLE_GOLD_AUCTION, true));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, true));
    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(teamGnosis, true));

    // set enforced options
    await setEnforcedOptionsBerachain(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD);
}

async function setEnforcedOptionsBerachain(templeGold: TempleGold) {
    // set enforced options
     const options: EnforcedOptionParamStruct[] = [{
        eid: BERACHAIN_CONSTANTS.LAYER_ZERO.EID,
        msgType: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.MSG_TYPE,
        options: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.OPTIONS, // 200k gas limit
    }];
    await mine(templeGold.setEnforcedOptions(options));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
