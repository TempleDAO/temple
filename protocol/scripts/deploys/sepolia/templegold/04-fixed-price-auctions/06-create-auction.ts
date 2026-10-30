import '@nomiclabs/hardhat-ethers';
import { ContractTransaction } from 'ethers';
import { FixedPriceAuction__factory, FixedPriceAuctionFactory__factory } from '../../../../../typechain';
import {
  mine,
  runAsyncMain,
} from '../../../helpers';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);
  const ownerAddress = await owner.getAddress();
  const factory = FixedPriceAuctionFactory__factory.connect(ADDRS.GRANARY.FIXED_PRICE_AUCTION_FACTORY, owner);
  const implementation = FixedPriceAuction__factory.connect(await factory.implementation(), owner);
  const block = await owner.provider!.getBlock('latest');
  const settings = DEFAULT_SETTINGS.GRANARY.AUCTION;
  const depositStart = block.timestamp + settings.START_DELAY;
  const depositEnd = depositStart + settings.DEPOSIT_DURATION;

  const config = {
    bidToken: ADDRS.CORE.TEMPLE_TOKEN,
    fillToken: ADDRS.EXTERNAL.SKY.USDS,
    price: settings.PRICE,
    depositStart,
    depositEnd,
    fulfillmentEnd: depositEnd + settings.FULFILLMENT_DURATION,
    minDeposit: settings.MIN_DEPOSIT,
    funder: ownerAddress,
    proceedsRecipient: ownerAddress,
    complianceCheck: ADDRS.GRANARY.COMPLIANCE_CHECK,
  };

  console.log('Creating auction with config:', config);
  const encodedConfig = await implementation.encodeConfig(config);
  await logCreatedAuction(factory.createAuction(encodedConfig));
}

async function logCreatedAuction(transaction: Promise<ContractTransaction>) {
  await mine(transaction);
  const receipt = await (await transaction).wait();
  const created = receipt.events?.find(event => event.event === 'AuctionCreated');
  if (!created?.args) {
    throw new Error(`AuctionCreated event missing from ${receipt.transactionHash}; check the receipt before retrying`);
  }

  console.log(`FIXED_PRICE_AUCTION=${created.args[0]}`);
  console.log(`AUCTION_START_BLOCK=${receipt.blockNumber}`);
}

runAsyncMain(main);
