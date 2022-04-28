import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  JoiningFee,
  JoiningFee__factory,
  Vault,
  Vault__factory,
} from "../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS,
  DeployedContracts,
  ensureExpectedEnvvars,
  mine,
  toAtto,
} from "./helpers";

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

  const joiningFeeFactory = new JoiningFee__factory(owner);
  const joiningFee: JoiningFee = await deployAndMine(
    "TEMPLE_CORE_TEST_JOINING_FEE",
    joiningFeeFactory,
    joiningFeeFactory.deploy,
    toAtto(10),
  );

  const vaultFactory = new Vault__factory(owner);
  const testVault: Vault = await deployAndMine(
    "TEMPLE_CORE_TEST_VAULT",
    vaultFactory,
    vaultFactory.deploy,
    "TEMPLE",
    "TEMPLE",
    DEPLOYED.TEMPLE,
    604800,
    86400,
    {p: 1, q: 1},
    joiningFee.address,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
