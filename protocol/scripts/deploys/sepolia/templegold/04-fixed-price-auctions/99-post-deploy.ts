import '@nomiclabs/hardhat-ethers';
import { ethers } from 'ethers';
import { FixedPriceAuction__factory, FixedPriceAuctionFactory__factory, TempleGold__factory, ComplianceCheck__factory } from '../../../../../typechain';
import {
  mine,
  runAsyncMain,
} from '../../../helpers';
import { DEFAULT_SETTINGS } from '../default-settings';
import { DeployContext, getDeployContext } from '../deploy-context';

async function main() {
  const context = await getDeployContext(__dirname);
  await authorizeTgldAuction(context);
  await setFlagger(context);
}

async function authorizeTgldAuction({ owner, ADDRS }: DeployContext) {
  const auctionAddress = ADDRS.GRANARY.FIXED_PRICE_AUCTION;
  const factory = FixedPriceAuctionFactory__factory.connect(ADDRS.GRANARY.FIXED_PRICE_AUCTION_FACTORY, owner);
  if (!await factory.isAuction(auctionAddress)) {
    throw new Error('The configured auction was not created by this factory');
  }

  const auction = FixedPriceAuction__factory.connect(auctionAddress, owner);
  const config = await auction.getConfig();
  const tgldAddress = ADDRS.TEMPLE_GOLD.TEMPLE_GOLD;
  if (config.bidToken.toLowerCase() !== tgldAddress.toLowerCase()
      && config.fillToken.toLowerCase() !== tgldAddress.toLowerCase()) {
    console.log('This auction does not use TGLD; no authorization needed');
    return;
  }

  const templeGold = TempleGold__factory.connect(tgldAddress, owner);
  if (await templeGold.authorized(auctionAddress)) {
    console.log('Auction already authorized');
    return;
  }
  if ((await templeGold.owner()).toLowerCase() !== (await owner.getAddress()).toLowerCase()) {
    throw new Error('Run this step with the TempleGold owner, or submit authorizeContract through its multisig');
  }

  // Authorize the clone, and retain authorization while claims or refunds remain.
  await mine(templeGold.authorizeContract(auctionAddress, true));
}

async function setFlagger({ owner, ADDRS }: DeployContext) {
  const flagger = DEFAULT_SETTINGS.GRANARY.FLAGGER;
  if (!ethers.utils.isAddress(flagger) || flagger === ethers.constants.AddressZero) {
    throw new Error('Set GRANARY.FLAGGER to the test Overlord address');
  }

  const auction = FixedPriceAuction__factory.connect(ADDRS.GRANARY.FIXED_PRICE_AUCTION, owner);
  const config = await auction.getConfig();
  // Use the auction's current list, which may differ from the deployment config.
  const compliance = ComplianceCheck__factory.connect(config.complianceCheck, owner);
  await mine(compliance.setFlagger(flagger, true));
}

runAsyncMain(main);
