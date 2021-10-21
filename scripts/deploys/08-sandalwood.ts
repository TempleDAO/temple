import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { SandalwoodToken, SandalwoodToken__factory } from '../../typechain';
import { deployAndMine, expectAddressWithPrivateKey } from './helpers';

async function main() {
  expectAddressWithPrivateKey();

  const [owner] = await ethers.getSigners();

  const sandalwoodTokenFactory = new SandalwoodToken__factory(owner);

  const sandalwoodToken: SandalwoodToken = await deployAndMine(
    'SANDALWOOD_TOKEN', sandalwoodTokenFactory, sandalwoodTokenFactory.deploy,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });