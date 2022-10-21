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

  // From: https://etherscan.io/address/0x65fE8BaBF7DA367b2B45cBD748F0490713f84828#events
  const validVaults = [
    "0x402832ec42305cf7123bc9903f693e944484b9c1", // 1m-core (1m-core-a)
    "0xa99980c64fc6c302377c39f21431217fcbaf39af", // 1m-core (1m-core-b)
    "0xb6226ad4fef850dc8b85a83bdc0d4aff9c61cd39", // 1m-core (1m-core-c)
    "0xd43cc1814bd87b67b318e4807cde50c090d01c1a", // 1m-core (1m-core-d)
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
