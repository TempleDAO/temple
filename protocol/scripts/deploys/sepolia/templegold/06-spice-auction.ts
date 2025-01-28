import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { SpiceAuction__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const ownerAddress = await owner.getAddress();
  const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
  const SEPOLIA_CHAIN_ID = 11155111;
  const SEPOLIA_LZ_EID = 40161;

  const factory = new SpiceAuction__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION',
    factory,
    factory.deploy,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
    TEMPLEGOLD_ADDRESSES.CORE.TEMPLE_TOKEN,
    ownerAddress,
    ownerAddress,
    SEPOLIA_LZ_EID, // lz eid
    SEPOLIA_CHAIN_ID,
    "TGLD_TEMPLE_SPICE"
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