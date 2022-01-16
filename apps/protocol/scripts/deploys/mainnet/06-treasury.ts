import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { ERC20__factory, TempleTreasury__factory } from '../../../typechain';
import { deployAndMine, DeployedContracts, DEPLOYED_CONTRACTS } from '../helpers';

async function main() {
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  const FRAX = new ERC20__factory(owner).attach(DEPLOYED.FRAX);

  const treasuryFactory = new TempleTreasury__factory(owner);
  const TREASURY = await deployAndMine(
    'TREASURY', treasuryFactory, treasuryFactory.deploy,
    DEPLOYED.TEMPLE,
    DEPLOYED.FRAX,
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });