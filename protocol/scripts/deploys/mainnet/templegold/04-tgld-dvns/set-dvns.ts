import '@nomiclabs/hardhat-ethers';
import { runAsyncMain } from '../../../helpers';
import { DEFAULT_SETTINGS as BERACHAIN_DEFAULT_SETTINGS } from '../../../berachain/templegold/default-settings';
import { setDvnConfig } from '../../../layer-zero-utils';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { owner, ADDRS } = await getDeployContext(__dirname);

    const oftAddress = ADDRS.TEMPLE_GOLD.TEMPLE_GOLD;
    const destEid = BERACHAIN_DEFAULT_SETTINGS.GLOBAL.LZ_EID;
    await setDvnConfig(owner, oftAddress, destEid, {
        confirmations: 20,
        requiredDVNCount: 4,
        optionalDVNCount: 0,
        optionalDVNThreshold: 0,
        requiredDVNs: [
          '0x380275805876Ff19055EA900CDb2B46a94ecF20D', // Horizen
          '0x589dEDbD617e0CBcB916A9223F4d1300c294236b', // LayerZero Labs
          '0xa4fE5A5B9A846458a70Cd0748228aED3bF65c2cd', // Canary
          '0xa59BA433ac34D2927232918Ef5B2eaAfcF130BA5'  // Nethermind
        ],
        optionalDVNs: [],
    });
}

runAsyncMain(main);
