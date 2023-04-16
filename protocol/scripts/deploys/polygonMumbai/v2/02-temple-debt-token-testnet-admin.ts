import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleDebtTokenTestnetAdmin__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from './contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const V2_DEPLOYED_CONTRACTS = getDeployedContracts();

  const factory = new TempleDebtTokenTestnetAdmin__factory(owner);
  await deployAndMine(
    'templeDebtTokenTestnetAdmin', factory, factory.deploy,
    V2_DEPLOYED_CONTRACTS.TEMPLE.TEMPLE_DEBT_TOKEN
  );
}
        
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });