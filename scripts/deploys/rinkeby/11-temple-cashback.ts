import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TempleCashback, TempleCashback__factory } from '../../../typechain';
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

  // need to change verifier to something reasonable when testing. Can use
  // helper script generate-external-address to create once-off wallet
  // to sign transactions without polluting your metamask for all time
  const verifierPublicKey = "0x0000000000000000000000000000000000000000"

  const templeCashbackFactory = new TempleCashback__factory(owner);
  const templeCashback: TempleCashback = await deployAndMine(
    'TEMPLE_CASHBACK', templeCashbackFactory, templeCashbackFactory.deploy,
    verifierPublicKey
  )

  await mine(templeCashback.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });