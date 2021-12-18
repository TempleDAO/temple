import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { AMMWhitelist, AMMWhitelist__factory, TempleERC20Token__factory, TempleFraxAMMOps, TempleFraxAMMOps__factory, TempleFraxAMMRouter, TempleFraxAMMRouter__factory, TempleUniswapV2Pair, TempleUniswapV2Pair__factory, TreasuryManagementProxy__factory } from '../../../typechain';
import { deployAndMine, DeployedContracts, DEPLOYED_CONTRACTS, expectAddressWithPrivateKey, mine } from '../helpers';

async function main() {
  expectAddressWithPrivateKey();
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }
  
  const daoMultisig = "0x4D6175d58C5AceEf30F546C0d5A557efFa53A950";

  const verifierPublicKey = "0x5fc43464209bd9b0f7Bf8e738E427D41C6d2C87a" // generated and owned by XAV

  // Environment setup in phase1
  const pair: TempleUniswapV2Pair = new TempleUniswapV2Pair__factory(owner).attach(DEPLOYED.TEMPLE_V2_PAIR);
  const templeRouter: TempleFraxAMMRouter = new TempleFraxAMMRouter__factory(owner).attach(DEPLOYED.TEMPLE_V2_ROUTER)
  const treasuryManagementProxy = new TreasuryManagementProxy__factory(owner).attach(DEPLOYED.TREASURY_MANAGEMENT);

  // Contract where we send frax earned by treasury
  const templeAmmOps: TempleFraxAMMOps = await new TempleFraxAMMOps__factory(owner).deploy(
    DEPLOYED.TEMPLE,
    templeRouter.address,
    treasuryManagementProxy.address,
    DEPLOYED.FRAX,
    DEPLOYED.TREASURY,
    pair.address,
  )
  await mine(templeRouter.setProtocolMintEarningsAccount(templeAmmOps.address));

  // NOTE: This is how we'd add liquidity (will be done manually)
  // await templeToken.increaseAllowance(templeRouter.address, toAtto(10000000));
  // await stablecToken.increaseAllowance(templeRouter.address, toAtto(10000000));
  // await templeRouter.addLiquidity(toAtto(100000), toAtto(1000000), 1, 1, await owner.getAddress(),  (await blockTimestamp()) + 900);

  // AMMWhitelist
  const ammWhitelistFactory = new AMMWhitelist__factory(owner);
  const ammWhiteList: AMMWhitelist = await deployAndMine(
    'AMM_WHITELIST', ammWhitelistFactory, ammWhitelistFactory.deploy,
    templeRouter.address,
    verifierPublicKey);

  // change owner to multisig
  await mine(templeRouter.transferOwnership(daoMultisig));
  await mine(templeAmmOps.transferOwnership(daoMultisig));
  await mine(ammWhiteList.transferOwnership(daoMultisig));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });