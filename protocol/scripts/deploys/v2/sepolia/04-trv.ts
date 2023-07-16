import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TreasuryReservesVault__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from './contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_DEPLOYED = getDeployedContracts();

  const treasuryReservesVaultFactory = new TreasuryReservesVault__factory(owner);
  await deployAndMine(
    'TREASURY_RESERVES_VAULT',
    treasuryReservesVaultFactory,
    treasuryReservesVaultFactory.deploy,
    await owner.getAddress(),
    await owner.getAddress(),
    TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.TPI_ORACLE
  )

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });