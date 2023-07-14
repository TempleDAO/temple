import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { DsrBaseStrategy__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from './contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_DEPLOYED = getDeployedContracts();

  const dsrBaseStrategyFactory = new DsrBaseStrategy__factory(owner);
  await deployAndMine(
    'DSR_BASE_STRATEGY',
    dsrBaseStrategyFactory,
    dsrBaseStrategyFactory.deploy,
    await owner.getAddress(),
    await owner.getAddress(),
    "DsrBaseStrategy",
    TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS,
    TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN,
    TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_JOIN,
    TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.POT
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