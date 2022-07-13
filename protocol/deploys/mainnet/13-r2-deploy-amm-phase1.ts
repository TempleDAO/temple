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
  
  // // Setup custom AMM
  // const pairFactory = new TempleUniswapV2Pair__factory(owner);
  // const pair: TempleUniswapV2Pair = await deployAndMine(
  //   'TEMPLE_V2_PAIR', pairFactory, pairFactory.deploy,
  //   DEPLOYED.MULTISIG,
  //   DEPLOYED.TEMPLE,
  //   DEPLOYED.FRAX);

  //const templeRouterFactory = new TempleFraxAMMRouter__factory(owner);
  //const templeRouter: TempleFraxAMMRouter = await deployAndMine(
  //  'TEMPLE_V2_ROUTER', templeRouterFactory, templeRouterFactory.deploy,
  //   DEPLOYED.TEMPLE_V2_PAIR,
  //   DEPLOYED.TEMPLE,
  //   DEPLOYED.FRAX,
  //   DEPLOYED.TREASURY,
  //   DEPLOYED.TREASURY, // placeholder, to handle circular dep with router ops contract
  //   {frax: 1000000, temple: 255100},
  //   2, /* threshold decay per block */
  //   {frax: 100000, temple: 50000},
  //   {frax: 100000, temple: 5000},
  //);

  //// AMMWhitelist
  //const verifierPublicKey = "0x5fc43464209bd9b0f7Bf8e738E427D41C6d2C87a" // generated and owned by XAV
  //const ammWhitelistFactory = new AMMWhitelist__factory(owner);
  //const ammWhiteList: AMMWhitelist = await deployAndMine(
  //  'AMM_WHITELIST', ammWhitelistFactory, ammWhitelistFactory.deploy,
  //  templeRouter.address,
  //  verifierPublicKey);

  const templeFraxAMMOpsFactory = new TempleFraxAMMOps__factory(owner);
  const templeAmmOps: TempleFraxAMMOps = await deployAndMine(
    'TEMPLE_AMM_OPS',templeFraxAMMOpsFactory, templeFraxAMMOpsFactory.deploy,
    DEPLOYED.TEMPLE,
    DEPLOYED.TEMPLE_V2_ROUTER,
    DEPLOYED.TREASURY_MANAGEMENT,
    DEPLOYED.FRAX,
    DEPLOYED.TREASURY,
    DEPLOYED.TEMPLE_V2_PAIR,
  )

  //const templeRouterFactory = new TempleFraxAMMRouter__factory(owner);
  const templeRouter: TempleFraxAMMRouter = new TempleFraxAMMRouter__factory(owner).attach(DEPLOYED.TEMPLE_V2_ROUTER);
  await mine(templeRouter.setProtocolMintEarningsAccount(templeAmmOps.address));
  await mine(templeRouter.grantRole(await templeRouter.CAN_ADD_ALLOWED_USER(), DEPLOYED.AMM_WHITELIST))

  // await mine(templeRouter.transferOwnership(DEPLOYED.MULTISIG));
  await mine(templeAmmOps.transferOwnership(DEPLOYED.MULTISIG));
  // await mine(ammWhiteList.transferOwnership(DEPLOYED.MULTISIG));

  // // // TODO: Needs to be manually wired post deploy
  // // console.log("pair.setRouter(templeRouter.address)")
  // // console.log("add minter to TEMPLE TOKEN addMinter(templeRouter.address)");

  // // re-create the treasury management protocol
  // const treasuryManagementProxyFactory = new TreasuryManagementProxy__factory(owner);
  // await deployAndMine(
  //   'TREASURY_MANAGEMENT_PROXY', treasuryManagementProxyFactory, treasuryManagementProxyFactory.deploy,
  //   DEPLOYED.MULTISIG,
  //   DEPLOYED.TREASURY,
  // )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });