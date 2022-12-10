import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import {
  TempleTeamPaymentsFactory,
  TempleTeamPaymentsFactory__factory,
} from '../../../../typechain';
import {
  deployAndMine,
  DeployedContracts,
  DEPLOYED_CONTRACTS,
  expectAddressWithPrivateKey,
  mine,
} from '../../helpers';

async function main() {
  expectAddressWithPrivateKey();
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`);
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  // update with previously funded epoch before the factory came into use
  const lastPaidEpoch = 8;
  const templeTeamPaymentsFactoryFactory =
    new TempleTeamPaymentsFactory__factory(owner);
  const templeTeamPaymentsFactory: TempleTeamPaymentsFactory =
    await deployAndMine(
      'Temple Team Payments Factory',
      templeTeamPaymentsFactoryFactory,
      templeTeamPaymentsFactoryFactory.deploy,
      DEPLOYED.TEMPLE,
      DEPLOYED.TEMPLE_TEAM_PAYMENTS_IMPLEMENTATION,
      lastPaidEpoch
    );

  console.log('Transfering ownership');
  await mine(templeTeamPaymentsFactory.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
