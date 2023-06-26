import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleDebtTokenTestnetAdmin, TempleDebtTokenTestnetAdmin__factory, TempleDebtToken__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
  mine,
} from '../../helpers';
import { getDeployedContracts } from './contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const V2_DEPLOYED_CONTRACTS = getDeployedContracts();

  const factory = new TempleDebtTokenTestnetAdmin__factory(owner);
  const admin: TempleDebtTokenTestnetAdmin = await deployAndMine(
    'templeDebtTokenTestnetAdmin', factory, factory.deploy,
    V2_DEPLOYED_CONTRACTS.TEMPLE.TEMPLE_DEBT_TOKEN
  );

  const dUSD = TempleDebtToken__factory.connect(V2_DEPLOYED_CONTRACTS.TEMPLE.TEMPLE_DEBT_TOKEN, owner);
  await mine(dUSD.proposeNewExecutor(admin.address));
  await mine(admin.acceptExecutor());
  await mine(admin.addMinter(admin.address));
}
        
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });