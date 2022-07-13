import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TempleTeamPayments, TempleTeamPayments__factory } from '../../../typechain';
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

  const templeTeamPaymentsFactory = new TempleTeamPayments__factory(owner);
  const templeTeamFixedPayments: TempleTeamPayments = await deployAndMine(
    'TEMPLE_TEAM_FIXED_PAYMENTS', templeTeamPaymentsFactory, templeTeamPaymentsFactory.deploy,
    DEPLOYED.TEMPLE,
    13140000, // 5 months in seconds
    Math.round(Date.now() / 1000) // 2 months ago
  )

  await mine(templeTeamFixedPayments.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });