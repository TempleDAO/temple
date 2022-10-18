import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  OpsManager,
  OpsManager__factory,
  VaultEarlyWithdraw,
  VaultEarlyWithdraw__factory,
} from "../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS,
  DeployedContracts,
  ensureExpectedEnvvars,
  mine
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

  // From: https://goerli.etherscan.io/address/0x542891Faf336d69E440De80145Df21510dCa6a78#events
  const validVaults = [
    "0xced5a9dc11c135d1bdd045697fe37c2a416dcbfd",
    "0xb346612849145cfa5da043e025f1cfec6d407fee",
    "0xeebb96848a503414ef5906f05121209e9192558a",
    "0xd158bfd1e2337349eb9fe79fdc66467e3907da43",
    "0xe8ee55f1043fd7a52cd81b5827ef56fc46c1a628",
    "0xBF76F64070109b6611876a9A44C39395dE0b10fB",
  ];

  // Triple check these are indeed valid vaults
  const opsManager: OpsManager = OpsManager__factory.connect(DEPLOYED.OPS_MANAGER, owner);
  for (let i=0; i<validVaults.length; ++i) {
    const isValid = await opsManager.activeVaults(validVaults[i]);
    if (!isValid) {
      throw Error(`Inactive Vault: ${validVaults[i]}`);
    }
  }

  const vaultEarlyWithdrawFactory = new VaultEarlyWithdraw__factory(owner);
  const vaultEarlyWithdraw: VaultEarlyWithdraw = await deployAndMine(
    "Temple Vault Early Withdraw", vaultEarlyWithdrawFactory, vaultEarlyWithdrawFactory.deploy,
    DEPLOYED.TEMPLE,
    validVaults,
  );

  // transfer ownership
  console.log('Transfering ownership');
  await mine(vaultEarlyWithdraw.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
