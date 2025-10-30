import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { EpochPayments__factory } from '../../../../typechain';
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
 
  const factory = new EpochPayments__factory(owner);
  await deployAndMine(
    'VESTING_TGLD',
    factory,
    factory.deploy,
    TEMPLEGOLD_ADDRESSES.CORE.RESCUER_MSIG,
    ownerAddress,
    ownerAddress,
    TEMPLEGOLD_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN
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