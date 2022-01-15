import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleERC20Token, TempleERC20Token__factory } from '../../../typechain';
import { deployAndMine, DEPLOYED_CONTRACTS, toAtto } from '../helpers';

async function main() {
  const [owner] = await ethers.getSigners();

  const templeFactory = new TempleERC20Token__factory(owner);
  const TEMPLE: TempleERC20Token = await deployAndMine(
    'TEMPLE', templeFactory, templeFactory.deploy,
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