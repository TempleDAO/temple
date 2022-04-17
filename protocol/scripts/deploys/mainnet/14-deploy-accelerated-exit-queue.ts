import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { AcceleratedExitQueue__factory, AMMWhitelist, AMMWhitelist__factory, ExitQueue, ExitQueue__factory, TempleERC20Token__factory, TempleFraxAMMOps, TempleFraxAMMOps__factory, TempleFraxAMMRouter, TempleFraxAMMRouter__factory, TempleUniswapV2Pair, TempleUniswapV2Pair__factory, TreasuryManagementProxy__factory } from '../../../typechain';
import { deployAndMine, DeployedContracts, DEPLOYED_CONTRACTS, expectAddressWithPrivateKey, mine } from '../helpers';

async function main() {
  expectAddressWithPrivateKey();
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }
  
  const acceleratedExitQueueFactory = await new AcceleratedExitQueue__factory(owner);
  const acceleratedExitQueue = await deployAndMine(
    'ACCELERATED_EXIT_QUEUE', acceleratedExitQueueFactory, acceleratedExitQueueFactory.deploy,
    DEPLOYED.TEMPLE,
    DEPLOYED.EXIT_QUEUE,
    DEPLOYED.STAKING,
  )
  
  console.log("Multisig needs to transfer ownership of exit queue to accelerated exit queue");
  // await new ExitQueue__factory(owner).attach(DEPLOYED.EXIT_QUEUE).transferOwnership(acceleratedExitQueue.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });