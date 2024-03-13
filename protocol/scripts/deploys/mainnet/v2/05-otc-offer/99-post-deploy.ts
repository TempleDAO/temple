import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {
  ensureExpectedEnvvars,
  mine,
} from "../../../helpers";
import { connectToContracts, getDeployedContracts } from "../contract-addresses";


async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const deployedContracts = getDeployedContracts();
    const connectedContracts = connectToContracts(owner);
    const multiOtcOffer = connectedContracts.STRATEGIES.FOHMO_GNOSIS_STRATEGY.OTC_OFFER.MULTI_OTC_OFFER;
    const daiToken = deployedContracts.EXTERNAL.MAKER_DAO.DAI_TOKEN;
    const ohmToken = deployedContracts.EXTERNAL.OLYMPUS.OHM_TOKEN;
    const gOhmToken = deployedContracts.EXTERNAL.OLYMPUS.GOHM_TOKEN;
    const fundsOwner = deployedContracts.STRATEGIES.FOHMO_GNOSIS_STRATEGY.UNDERLYING_GNOSIS_SAFE;

    /// Add OTC markets
    let otcMarketInfo;
    {   
      // dai-ohm. `userBuyToken` is DAI
      otcMarketInfo = {
          fundsOwner: fundsOwner,
          userBuyToken: daiToken,
          userSellToken: ohmToken,
          offerPricingToken: 0, // userBuyToken
          minValidOfferPrice: ethers.utils.parseEther("11"), // minOfferPrice
          maxValidOfferPrice: ethers.utils.parseEther("12"), //maxOfferPrice
          scalar: 0, // default scalar
          offerPrice: ethers.utils.parseEther("11.8") // offerPrice
      };
      await mine(multiOtcOffer.addOtcMarket(otcMarketInfo));
    }

    {
      // ohm-dai. `userBuyToken` is OHM
      otcMarketInfo = {
        fundsOwner: fundsOwner,
        userBuyToken: ohmToken,
        userSellToken: daiToken,
        offerPricingToken: 1,
        minValidOfferPrice: ethers.utils.parseEther("13.75"),
        maxValidOfferPrice: ethers.utils.parseEther("19"),
        scalar: 0,
        offerPrice: ethers.utils.parseEther("13.9"),
      };
      await mine(multiOtcOffer.addOtcMarket(otcMarketInfo));
    }

    {
      // dai-gohm
      otcMarketInfo = {
        fundsOwner: fundsOwner,
        userBuyToken: daiToken,
        userSellToken: gOhmToken,
        offerPricingToken: 0,
        minValidOfferPrice: ethers.utils.parseEther("2900"),
        maxValidOfferPrice: ethers.utils.parseEther("3300"),
        scalar: 0,
        offerPrice: ethers.utils.parseEther("3177"),
      };
      await mine(multiOtcOffer.addOtcMarket(otcMarketInfo));
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });