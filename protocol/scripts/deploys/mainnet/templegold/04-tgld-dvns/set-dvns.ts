import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { ensureExpectedEnvvars } from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';
import { DEFAULT_SETTINGS as BERACHAIN_DEFAULT_SETTINGS } from '../../../berachain/templegold/default-settings';
import { setDvnConfig } from '../../../layer-zero-utils';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const ADDRS = getDeployedContracts();

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

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
