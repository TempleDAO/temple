import { ethers } from 'hardhat';
import { TempleGold__factory } from '../../../../../typechain';
import { ensureExpectedEnvvars } from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';
import { DEFAULT_SETTINGS as BERACHAIN_DEFAULT_SETTINGS } from '../../../berachain/templegold/default-settings';
import { CONTRACTS as BERACHAIN_ADDRS} from '../../../berachain/templegold/contract-addresses/berachain';
import { setPeer } from '../../../layer-zero-utils';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const MAINNET_ADDRS = getDeployedContracts();
    const oft = TempleGold__factory.connect(MAINNET_ADDRS.TEMPLE_GOLD.TEMPLE_GOLD, owner);
    await setPeer(oft, BERACHAIN_DEFAULT_SETTINGS.GLOBAL.LZ_EID, BERACHAIN_ADDRS.TEMPLE_GOLD.TEMPLE_GOLD);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
