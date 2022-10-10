import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { AscendZaps__factory, AscendZaps, OpsManager__factory} from '../../../typechain';
import {
  deployAndMine,
  DeployedContracts,
  DEPLOYED_CONTRACTS,
  ensureExpectedEnvvars,
  mine,
} from '../helpers';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  const opsManagerFactory = new OpsManager__factory({ "contracts/core/OpsManagerLib.sol:OpsManagerLib" : DEPLOYED.OPS_MANAGER_LIB }, owner).attach(DEPLOYED.OPS_MANAGER);
  const vaultedTempleAddress = await opsManagerFactory.vaultedTemple();

  const ascendZapsFactory = new AscendZaps__factory(owner);
  const ascendZaps = await deployAndMine(
    'AscendZaps', 
    ascendZapsFactory,
    ascendZapsFactory.deploy,
    vaultedTempleAddress,
    DEPLOYED.TEMPLE
  )

  await mine((ascendZaps as AscendZaps).transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });