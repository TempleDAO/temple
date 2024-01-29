import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { OtcOffer__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const factory = new OtcOffer__factory(owner);
  await deployAndMine(
    'STRATEGIES.FOHMO_GNOSIS_STRATEGY.OTC_OFFER.OHM_DAI',
    factory,
    factory.deploy,
    TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN, // user sell token
    TEMPLE_V2_ADDRESSES.EXTERNAL.OLYMPUS.OHM_TOKEN, // user buy token
    TEMPLE_V2_ADDRESSES.STRATEGIES.FOHMO_GNOSIS_STRATEGY.UNDERLYING_GNOSIS_SAFE, // fundsOwner
    ethers.utils.parseEther("13.90"), // initial offerPrice -- always 18 dp
    1, // offerPricingToken == DAI (USER_SELL_TOKEN)
    ethers.utils.parseEther("13.75"), // minOfferPrice
    ethers.utils.parseEther("19"), // maxOfferPrice
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