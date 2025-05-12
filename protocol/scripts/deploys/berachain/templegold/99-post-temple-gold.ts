import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts } from '../../mainnet/templegold/contract-addresses';
import { Constants as MAINNET_CONSTANTS } from '../../mainnet/constants';
import { EnforcedOptionParamStruct } from '../../../../typechain/@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3';
import { TempleGold } from '../../../../typechain';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    // set enforced options
    await setEnforcedOptionsMainnet(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD);
}

async function setEnforcedOptionsMainnet(templeGold: TempleGold) {
    // set enforced options
    const options: EnforcedOptionParamStruct[] = [{
        eid: MAINNET_CONSTANTS.LAYER_ZERO.EID,
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
