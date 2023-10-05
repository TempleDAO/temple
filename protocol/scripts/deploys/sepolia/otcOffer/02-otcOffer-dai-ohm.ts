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
    CORE_ADDRESSES.EXTERNAL.OLYMPUS.OHM_TOKEN, // user sell token
    CORE_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN, // user buy token
    CORE_ADDRESSES.OTC_OFFER.FUNDS_OWNER, // fundsOwner
    ethers.utils.parseEther("11.4"), // initial offerPrice -- always 18 dp
    0, // offerPricingToken = OfferPricingToken.UserBuyToken
    ethers.utils.parseEther("11"), // minOfferPrice
    ethers.utils.parseEther("12"), // maxOfferPrice
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