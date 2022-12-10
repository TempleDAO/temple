import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import {
  TempleTeamPaymentsV2,
  TempleTeamPaymentsV2__factory,
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

  const templeTeamPaymentsImplFactory = new TempleTeamPaymentsV2__factory(
    owner
  );
  await deployAndMine(
    'Temple Team Payments Implementation',
    templeTeamPaymentsImplFactory,
    templeTeamPaymentsImplFactory.deploy
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
