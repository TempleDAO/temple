import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { AMMWhitelist__factory, OpeningCeremony__factory, TempleERC20Token, TempleERC20Token__factory, TempleFraxAMMRouter__factory, TempleTeamPayments__factory, TempleUniswapV2Pair, TempleUniswapV2Pair__factory } from '../../../typechain';
import { blockTimestamp, deployAndMine, DeployedContracts, DEPLOYED_CONTRACTS, expectAddressWithPrivateKey, toAtto } from '../helpers';

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

  // TODO: Update to actual verifier wallet
  const verifierPublicKey = "0x22e6E0cF7966892E24b5764cC603A03801Df1FFd" // for mainnet

  // Create 2 versions of the team payment contract (contigent and fixed)
  const teamPaymentsFactory = new TempleTeamPayments__factory(owner)
  await deployAndMine(
    'TEMPLE_TEAM_FIXED_PAYMENTS', teamPaymentsFactory, teamPaymentsFactory.deploy,
    DEPLOYED.TEMPLE,
  )
  await deployAndMine(
    'TEMPLE_TEAM_CONTIGENT_PAYMENTS', teamPaymentsFactory, teamPaymentsFactory.deploy,
    DEPLOYED.TEMPLE,
  )
  
  // Setup custom AMM
  const pairFactory = new TempleUniswapV2Pair__factory(owner);
  const pair: TempleUniswapV2Pair = await deployAndMine(
    'TEMPLE_V2_PAIR', pairFactory, pairFactory.deploy,
    owner.address, 
    DEPLOYED.TEMPLE,
    DEPLOYED.FRAX);

  const templeRouterFactory = new TempleFraxAMMRouter__factory(owner);
  const templeRouter = await deployAndMine(
    'TEMPLE_V2_ROUTER', templeRouterFactory, templeRouterFactory.deploy,
     pair.address,
     DEPLOYED.TEMPLE,
     DEPLOYED.FRAX,
     DEPLOYED.TREASURY,
     {frax: 100000, temple: 9000},
     100, /* threshold decay per block */
     {frax: 1000000, temple: 1000000},
     {frax: 1000000, temple: 100000},
  );

  await pair.setRouter(templeRouter.address);
  await (new TempleERC20Token__factory(owner).attach(DEPLOYED.TEMPLE)).addMinter(templeRouter.address);

  // NOTE: This is how we'd add liquidity (will be done manually)
  // await templeToken.increaseAllowance(templeRouter.address, toAtto(10000000));
  // await stablecToken.increaseAllowance(templeRouter.address, toAtto(10000000));
  // await templeRouter.addLiquidity(toAtto(100000), toAtto(1000000), 1, 1, await owner.getAddress(),  (await blockTimestamp()) + 900);

  // AMMWhitelist
  const ammWhitelistFactory = new AMMWhitelist__factory(owner);
  await deployAndMine(
    'AMM_WHITELIST', ammWhitelistFactory, ammWhitelistFactory.deploy,
    templeRouter.address,
    verifierPublicKey);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });