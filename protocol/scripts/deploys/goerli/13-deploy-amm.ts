import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { MintAllowance, TempleFraxAMMOps, TempleFraxAMMOps__factory, TempleFraxAMMRouter, TempleFraxAMMRouter__factory, TempleStableAMMRouter, TempleStableAMMRouter__factory, TempleUniswapV2Pair, TempleUniswapV2Pair__factory } from '../../../typechain';
import {
  deployAndMine,
  DeployedContracts,
  DEPLOYED_CONTRACTS,
  ensureExpectedEnvvars,
  mine,
} from '../helpers';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }
  
  const FEI = '0xa1e7CdD887d6fac4861b5663984A9Ba72cFF9522'

  // Setup custom AMM
  const pairFactory = new TempleUniswapV2Pair__factory(owner);
  const fraxPair: TempleUniswapV2Pair = await deployAndMine(
    'TEMPLE_V2_PAIR', pairFactory, pairFactory.deploy,
    DEPLOYED.MULTISIG,
    DEPLOYED.TEMPLE,
    DEPLOYED.FRAX);

  //const fraxPair = '0x85dA8c4312742522519911052Fa2B4aC302E4d6c'

  const feiPair: TempleUniswapV2Pair = await deployAndMine(
      'TEMPLE_V2_PAIR', pairFactory, pairFactory.deploy,
      DEPLOYED.MULTISIG,
      DEPLOYED.TEMPLE,
      FEI);

  //const feiPair = '0xD83834165E2b130341d58dd5A43460B7f4C491BD'

  const templeRouterFactory = new TempleStableAMMRouter__factory(owner)
  const templeRouter: TempleStableAMMRouter = await deployAndMine(
    'TEMPLE_V2_ROUTER', templeRouterFactory, templeRouterFactory.deploy,
    DEPLOYED.TEMPLE,
    DEPLOYED.TREASURY,
    DEPLOYED.FRAX,
  );

  await mine(templeRouter.addPair(DEPLOYED.FRAX, fraxPair.address));
  await mine(templeRouter.addPair(FEI, feiPair.address));


  //await mine(templeRouter.toggleOpenAccess());
  //await mine(templeRouter.setProtocolMintEarningsAccount(templeAmmOps.address));

  await mine(templeRouter.transferOwnership(DEPLOYED.MULTISIG));

  console.log("**** TODO: Needs to be manually wired post deploy");
  console.log("pair.setRouter(templeRouter.address)")
  console.log("TEMPLE.addMinter(templeRouter.address)");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });