import '@nomiclabs/hardhat-ethers';
import { runAsyncMain } from '../../../helpers';
import { DEFAULT_SETTINGS as MAINNET_DEFAULT_SETTINGS } from '../../../mainnet/templegold/default-settings';
import { setDvnConfig } from '../../../layer-zero-utils';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { owner, ADDRS } = await getDeployContext(__dirname);

    const oftAddress = ADDRS.TEMPLE_GOLD.TEMPLE_GOLD;
    const destEid = MAINNET_DEFAULT_SETTINGS.GLOBAL.LZ_EID;
    await setDvnConfig(owner, oftAddress, destEid, {
        confirmations: 45,
        requiredDVNCount: 4,
        optionalDVNCount: 0,
        optionalDVNThreshold: 0,
        requiredDVNs: [
            '0x06e8042729CeF3aE6D6DB5350f48F9D736C3675d', // Canary
            '0x282b3386571f7f794450d5789911a9804FA346b4', // LayerZero Labs
            '0xDd7B5E1dB4AaFd5C8EC3b764eFB8ed265Aa5445B', // Nethermind
            '0xeCbaA45c33ce6Fa284995e5F8314f5bC7F1C2008'  // Horizen
        ],
        optionalDVNs: [],
    });
}

runAsyncMain(main);
