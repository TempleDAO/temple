import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleGoldStaking__factory } from '../../../../typechain';
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
  console.log("ADDYSDSDFAS");
  console.log(TEMPLEGOLD_ADDRESSES.CORE.TEMPLE_TOKEN);
  console.log(TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD);
  console.log(ownerAddress);
  const factory = new TempleGoldStaking__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD_STAKING',
    factory,
    factory.deploy,
    "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", // rescuer can't be executor. using placeholder
    ownerAddress,
    TEMPLEGOLD_ADDRESSES.CORE.TEMPLE_TOKEN,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD
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