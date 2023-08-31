import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TreasuryReservesVault__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const treasuryReservesVaultFactory = new TreasuryReservesVault__factory(owner);
  await deployAndMine(
    'CORE.TREASURY_RESERVES_VAULT.ADDRESS',
    treasuryReservesVaultFactory,
    treasuryReservesVaultFactory.deploy,
    TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
    await owner.getAddress(),
    TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.TPI_ORACLE
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