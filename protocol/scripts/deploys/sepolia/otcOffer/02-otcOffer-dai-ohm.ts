import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { OtcOffer__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from './contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const CORE_ADDRESSES = getDeployedContracts();
  
  const factory = new OtcOffer__factory(owner);
  await deployAndMine(
    'OTC_OFFER.DAI_OHM',
    factory,
    factory.deploy,
    CORE_ADDRESSES.EXTERNAL.OLYMPUS.OHM_TOKEN,
    CORE_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
    CORE_ADDRESSES.CORE.FARMING_MULTISIG, // fundsOwner
    ethers.utils.parseEther("11.4"), // initial offerPrice -- always 18 dp
    2_000, // max new price delta - 20% from current price
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