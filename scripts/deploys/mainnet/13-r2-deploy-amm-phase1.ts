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

  // Setup custom AMM
  const pairFactory = new TempleUniswapV2Pair__factory(owner);
  const pair: TempleUniswapV2Pair = await deployAndMine(
    'TEMPLE_V2_PAIR', pairFactory, pairFactory.deploy,
    daoMultisig,
    DEPLOYED.TEMPLE,
    DEPLOYED.FRAX);

  const templeRouterFactory = new TempleFraxAMMRouter__factory(owner);
  await deployAndMine(
    'TEMPLE_V2_ROUTER', templeRouterFactory, templeRouterFactory.deploy,
     pair.address,
     DEPLOYED.TEMPLE,
     DEPLOYED.FRAX,
     DEPLOYED.TREASURY,
     DEPLOYED.TREASURY, // placeholder, to handle circular dep with router ops contract
     {frax: 100000, temple: 9000},
     100, /* threshold decay per block */
     {frax: 1000000, temple: 1000000},
     {frax: 1000000, temple: 100000},
  );

  // TODO: Needs to be manually wired post deploy
  console.log("pair.setRouter(templeRouter.address)")
  console.log("add minter to TEMPLE TOKEN addMinter(templeRouter.address)");

  // re-create the treasury management protocol
  const treasuryManagementProxyFactory = new TreasuryManagementProxy__factory(owner);
  await deployAndMine(
    'TREASURY_MANAGEMENT_PROXY', treasuryManagementProxyFactory, treasuryManagementProxyFactory.deploy,
    daoMultisig,
    DEPLOYED.TREASURY,
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });