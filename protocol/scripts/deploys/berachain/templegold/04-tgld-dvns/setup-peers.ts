import { ethers } from 'hardhat';
import { TempleGold__factory } from '../../../../../typechain';
import { ensureExpectedEnvvars } from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';
import { DEFAULT_SETTINGS as MAINNET_DEFAULT_SETTINGS } from '../../../mainnet/templegold/default-settings';
import { CONTRACTS as MAINNET_ADDRS} from '../../../mainnet/templegold/contract-addresses/mainnet';
import { setPeer } from '../../../layer-zero-utils';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const BERACHAIN_ADDRS = getDeployedContracts();
    const oft = TempleGold__factory.connect(BERACHAIN_ADDRS.TEMPLE_GOLD.TEMPLE_GOLD, owner);
    await setPeer(oft, MAINNET_DEFAULT_SETTINGS.GLOBAL.LZ_EID, MAINNET_ADDRS.TEMPLE_GOLD.TEMPLE_GOLD);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
