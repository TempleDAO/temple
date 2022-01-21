import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  FaithMerkleAirdrop,
  FaithMerkleAirdrop__factory,
} from "../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS,
  DeployedContracts,
  ensureExpectedEnvvars,
  mine,
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

  const faithMerkleAirdropFactory = new FaithMerkleAirdrop__factory(owner);
  const faithMerkleAirdrop: FaithMerkleAirdrop = await deployAndMine(
    "TEMPLE FAITH MERKLE AIRDROP",
    faithMerkleAirdropFactory,
    faithMerkleAirdropFactory.deploy,
    DEPLOYED.FAITH,
    [] // Assume this is the Merkle Root, how do I get this?
  );

  await mine(faithMerkleAirdrop.setOwner(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
