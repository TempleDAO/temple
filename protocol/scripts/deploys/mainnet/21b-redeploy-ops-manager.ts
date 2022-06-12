import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  OpsManager,
  OpsManager__factory,
  VaultedTemple__factory,
} from "../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS,
  DeployedContracts,
  ensureExpectedEnvvars,
  mine,
  blockTimestamp
} from "../helpers";

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      return;
  } else {
      DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  const opsManagerFactory = new OpsManager__factory({ "contracts/core/OpsManagerLib.sol:OpsManagerLib" : DEPLOYED.OPS_MANAGER_LIB }, owner)
  const opsManager: OpsManager = await deployAndMine("Ops Manager", 
    opsManagerFactory, 
    opsManagerFactory.deploy,
    DEPLOYED.TEMPLE,
    DEPLOYED.JOINING_FEE
  )

  // transfer ownership
  console.log('Transfering ownership');

  const vaultedTemple = new VaultedTemple__factory(owner).attach(await opsManager.vaultedTemple())
  await mine(vaultedTemple.transferOwnership(DEPLOYED.MULTISIG));
  await mine(opsManager.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });