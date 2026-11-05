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

  if (process.env.POST_DEPLOY_ACTION === 'update-implementation') {
    await updateImplementation(context);
    return;
  }
  if (process.env.POST_DEPLOY_ACTION === 'setup') {
    await authorizeTgldAuction(context);
    await setFlagger(context);
    return;
  }
  throw new Error('POST_DEPLOY_ACTION must be setup or update-implementation');
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

async function updateImplementation({ owner, ADDRS }: DeployContext) {
  const factory = FixedPriceAuctionFactory__factory.connect(ADDRS.GRANARY.FIXED_PRICE_AUCTION_FACTORY, owner);
  const implementationAddress = ADDRS.GRANARY.FIXED_PRICE_AUCTION_IMPLEMENTATION;
  if (!ethers.utils.isAddress(implementationAddress) || implementationAddress === ethers.constants.AddressZero) {
    throw new Error('Set GRANARY.FIXED_PRICE_AUCTION_IMPLEMENTATION to the new deployed address');
  }
  const target = implementationAddress.toLowerCase();
  if ((await factory.implementation()).toLowerCase() === target) {
    console.log('Configured implementation is already active');
    return;
  }

  const implementation = FixedPriceAuction__factory.connect(implementationAddress, owner);

  const signer = (await owner.getAddress()).toLowerCase();
  if ((await factory.proposedImplementation()).toLowerCase() !== target) {
    if ((await factory.executor()).toLowerCase() !== signer) {
      throw new Error('Run with the factory executor first to propose the configured implementation');
    }
    await mine(factory.proposeImplementation(implementationAddress));
    console.log('Proposed implementation:', implementationAddress);
  }

  if ((await factory.rescuer()).toLowerCase() !== signer) {
    console.log('Proposal ready. Rerun this action with the factory rescuer to accept it.');
    return;
  }
  await mine(factory.acceptImplementation(implementationAddress));
  if ((await factory.implementation()).toLowerCase() !== target) {
    throw new Error('Factory implementation was not updated to the configured address');
  }
  console.log('Active implementation:', implementationAddress);
}


runAsyncMain(main);
