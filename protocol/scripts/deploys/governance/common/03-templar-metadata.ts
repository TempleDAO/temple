import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TemplarMetadata, TemplarMetadata__factory } from '../../../../typechain';
import {
  getDeployedContracts,
} from '../contract-addresses';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const DEPLOYED = getDeployedContracts();

  const factory = new TemplarMetadata__factory(owner);
  const templarMetadata = await deployAndMine<TemplarMetadata,any>(
    'TemplarMetadata', factory, factory.deploy,
    DEPLOYED.TEMPLAR_NFT,
  );

  console.log("templar nft", DEPLOYED.TEMPLAR_NFT);
  console.log("templarMetadata.templars", await templarMetadata.templars());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });