import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { StableGoldAuction__factory } from '../../../../typechain';
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

  const factory = new StableGoldAuction__factory(owner);
  await deployAndMine(
    'STABLE_GOLD_AUCTION',
    factory,
    factory.deploy,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
    TEMPLEGOLD_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
    ownerAddress, // treasury
    "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", // rescuer can't be executor. using placeholder
    ownerAddress, // executor
    ownerAddress // auction automation eoa
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