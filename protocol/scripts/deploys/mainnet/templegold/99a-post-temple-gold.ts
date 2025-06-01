import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, getDeployedTempleGoldContracts } from './contract-addresses';
import { Constants as BERACHAIN_CONSTANTS } from '../../berachain/constants';
import { EnforcedOptionParamStruct } from '../../../../typechain/@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3';
import { TempleGold } from '../../../../typechain';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_ADDRESSES = getDeployedTempleGoldContracts();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    const teamGnosis = TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEAM_GNOSIS; //'0x4D6175d58C5AceEf30F546C0d5A557efFa53A950';
    const distributionParams = {
        staking: ethers.utils.parseEther("15"),
        auction: ethers.utils.parseEther("70"),
        gnosis: ethers.utils.parseEther("15")
    }
    const vestingFactor = {
        value: 156,
        weekMultiplier: 3600 * 24 * 7 // 1 week
    }
    // Set and whitelist contracts
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setTeamGnosis(teamGnosis));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setStableGoldAuction(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.STABLE_GOLD_AUCTION));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setStaking(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setVestingFactor(vestingFactor));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.setDistributionParams(distributionParams));
    // authorize contracts
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.STABLE_GOLD_AUCTION, true));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, true));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.authorizeContract(teamGnosis, true));

    // set enforced options
    await setEnforcedOptionsBerachain(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD);
}

async function setEnforcedOptionsBerachain(templeGold: TempleGold) {
    // set enforced options
     const options: EnforcedOptionParamStruct[] = [{
        eid: BERACHAIN_CONSTANTS.LAYER_ZERO.EID,
        msgType: 1, // SEND
        options: "0x00030100110100000000000000000000000000030d40", // 200k gas limit
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
