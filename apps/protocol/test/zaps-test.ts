import { ethers, network } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { expect } from "chai";
import { blockTimestamp, fromAtto, mineToEpoch, shouldThrow, toAtto } from "./helpers";

import { ExitQueue } from "../typechain/ExitQueue";
import { ExitQueue__factory } from "../typechain/factories/ExitQueue__factory";
import { FakeERC20 } from "../typechain/FakeERC20";
import { FakeERC20__factory } from "../typechain/factories/FakeERC20__factory";
import { OpeningCeremony } from "../typechain/OpeningCeremony";
import { OpeningCeremony__factory } from "../typechain/factories/OpeningCeremony__factory";
import { TempleERC20Token } from "../typechain/TempleERC20Token";
import { TempleERC20Token__factory } from "../typechain/factories/TempleERC20Token__factory";
import { TempleStaking } from "../typechain/TempleStaking";
import { TempleStaking__factory } from "../typechain/factories/TempleStaking__factory";
import { TempleTreasury } from "../typechain/TempleTreasury";
import { TempleTreasury__factory } from "../typechain/factories/TempleTreasury__factory";
import { TreasuryManagementProxy } from "../typechain/TreasuryManagementProxy";
import { TreasuryManagementProxy__factory } from "../typechain/factories/TreasuryManagementProxy__factory";
import { Zap } from "../typechain/Zap";
import { Zap__factory } from "../typechain/factories/Zap__factory";

// import * as Web3Utils from "web3-utils";

const {
  toBN,
  keccak256,
  soliditySha3,
} = require("web3-utils");

const Path = require("../scripts/Path");

import {
  abi as SWAP_ROUTER_ABI,
  bytecode as SWAP_ROUTER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';

// xdescribe("Zaps Test", async () => {
// 
//   let stablecToken;
//   let treasury: TempleTreasury;
//   let treasuryManagement : TreasuryManagementProxy;
//   let templeToken: TempleERC20Token;
//   let openingCeremony : OpeningCeremony;
//   let exitQueue: ExitQueue
//   let staking: TempleStaking;
//   let lockedOGTemple: LockedOGTemple;
//   let owner: Signer;
//   let stakers: Signer[];
//   let guests : Signer[];
//   let ZAP: Zap;
// 
//   const EPOCH_SIZE: number = 600;
//   const MINT_MULTIPLE: number = 6;
//   const UNLOCK_DELAY_SECONDS: number = 10;
//   const HARVEST_THRESHOLD: BigNumber = toAtto(10000);
//   const INVITE_THRESHOLD: BigNumber = toAtto(0); //Using zero here as our concern is whether users with guest status can zap.
//   const VERIFIED_BONUS_FACTOR: {numerator: number, denominator: number} = { numerator: 51879, denominator: 100000}; // 0.1 EPY as bonus
//   const GUEST_BONUS_FACTOR: {numerator: number, denominator: number} = { numerator: 45779, denominator: 100000};    // 0.9 EPY as bonus
// 
//   const UNISWAP_ROUTER_ADDRESS = "0xe592427a0aece92de3edee1f18e0157c05861564";
//   const UNISWAP_QUOTER_ABI = [{"inputs":[{"internalType":"address","name":"_factory","type":"address"},{"internalType":"address","name":"_WETH9","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"WETH9","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"path","type":"bytes"},{"internalType":"uint256","name":"amountIn","type":"uint256"}],"name":"quoteExactInput","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"name":"quoteExactInputSingle","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes","name":"path","type":"bytes"},{"internalType":"uint256","name":"amountOut","type":"uint256"}],"name":"quoteExactOutput","outputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"name":"quoteExactOutputSingle","outputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int256","name":"amount0Delta","type":"int256"},{"internalType":"int256","name":"amount1Delta","type":"int256"},{"internalType":"bytes","name":"path","type":"bytes"}],"name":"uniswapV3SwapCallback","outputs":[],"stateMutability":"view","type":"function"}];
//   const UNISWAP_QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
// 
//   const FRAX_ADDRESS = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
//   const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";  
// 
//   const ERC20_ABI = [{"inputs":[{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"},{"internalType":"address","name":"_creator_address","type":"address"},{"internalType":"address","name":"_timelock_address","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"FRAXBurned","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"FRAXMinted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"COLLATERAL_RATIO_PAUSER","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ADDRESS","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"pool_address","type":"address"}],"name":"addPool","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burnFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"collateral_ratio_paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"controller_address","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"creator_address","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"eth_usd_consumer_address","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"eth_usd_price","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"frax_eth_oracle_address","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"frax_info","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"frax_pools","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"frax_pools_array","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"frax_price","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"frax_step","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"fxs_address","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"fxs_eth_oracle_address","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"fxs_price","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"genesis_supply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"globalCollateralValue","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"global_collateral_ratio","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"last_call_time","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"minting_fee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner_address","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"b_address","type":"address"},{"internalType":"uint256","name":"b_amount","type":"uint256"}],"name":"pool_burn_from","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"m_address","type":"address"},{"internalType":"uint256","name":"m_amount","type":"uint256"}],"name":"pool_mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"price_band","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"price_target","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"redemption_fee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"refreshCollateralRatio","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"refresh_cooldown","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"pool_address","type":"address"}],"name":"removePool","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_controller_address","type":"address"}],"name":"setController","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_eth_usd_consumer_address","type":"address"}],"name":"setETHUSDOracle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_frax_oracle_addr","type":"address"},{"internalType":"address","name":"_weth_address","type":"address"}],"name":"setFRAXEthOracle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_fxs_address","type":"address"}],"name":"setFXSAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_fxs_oracle_addr","type":"address"},{"internalType":"address","name":"_weth_address","type":"address"}],"name":"setFXSEthOracle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_new_step","type":"uint256"}],"name":"setFraxStep","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"min_fee","type":"uint256"}],"name":"setMintingFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_owner_address","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_price_band","type":"uint256"}],"name":"setPriceBand","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_new_price_target","type":"uint256"}],"name":"setPriceTarget","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"red_fee","type":"uint256"}],"name":"setRedemptionFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_new_cooldown","type":"uint256"}],"name":"setRefreshCooldown","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"new_timelock","type":"address"}],"name":"setTimelock","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"timelock_address","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"toggleCollateralRatio","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"weth_address","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];
// 
//   beforeEach(async () => {
//     //Test using a fork of mainnet so we can use actual tokens and Uniswap for zapping
//     await network.provider.request({
//       method: "hardhat_reset",
//       params: [
//         {
//           forking: {
//             jsonRpcUrl: process.env.MAINNET_RPC_URL,
//             blockNumber: Number(process.env.FORK_BLOCK_NUMBER),
//           },
//         },
//       ],
//     });
// 
//     [owner] = (await ethers.getSigners()) as Signer[];
// 
//     //Impersonate FRAX whale
//     await network.provider.request({
//       method: "hardhat_impersonateAccount",
//       params: ["0x820A9eb227BF770A9dd28829380d53B76eAf1209"],
//     });
//     const fraxWhale = await ethers.getSigner("0x820A9eb227BF770A9dd28829380d53B76eAf1209");
//     stablecToken = new ethers.Contract(FRAX_ADDRESS, ERC20_ABI, fraxWhale);
// 
//     //Impersonate USDC whale
//     await network.provider.request({
//       method: "hardhat_impersonateAccount",
//       params: ["0x50b42514389F25E1f471C8F03f6f5954df0204b0"],
//     });
//     const usdcWhale = await ethers.getSigner("0x50b42514389F25E1f471C8F03f6f5954df0204b0");
//     const USDC = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, usdcWhale);    
// 
//     templeToken = await new TempleERC20Token__factory(owner).deploy();
// 
//     treasury = await new TempleTreasury__factory(owner).deploy(
//       templeToken.address,
//       FRAX_ADDRESS,
//     );
// 
//     exitQueue = await new ExitQueue__factory(owner).deploy(
//       templeToken.address,
//       200, /* max per epoch */
//       100, /* max per address per epoch */
//       EPOCH_SIZE,
//     );
// 
//     staking = await new TempleStaking__factory(owner).deploy(
//       templeToken.address,
//       exitQueue.address,
//       EPOCH_SIZE,
//       (await blockTimestamp()) - 1,
//     );
// 
//     await staking.setEpy(0,100);
//     lockedOGTemple = await new LockedOGTemple__factory(owner).deploy(await staking.OG_TEMPLE());
// 
//     await templeToken.addMinter(treasury.address);
//     stakers = (await ethers.getSigners()).slice(1, 5);
// 
//     await Promise.all([
//       stablecToken.transfer(await owner.getAddress(), toAtto(100000)),
//       stablecToken.connect(owner).increaseAllowance(treasury.address, toAtto(100000)),
//     ]);
// 
//     await treasury.seedMint(1,100);
// 
//     treasuryManagement = await new TreasuryManagementProxy__factory(owner).deploy(
//       await owner.getAddress(),
//       treasury.address
//     );
// 
//     await treasury.transferOwnership(treasuryManagement.address);
// 
//     openingCeremony = await new OpeningCeremony__factory(owner).deploy(
//       FRAX_ADDRESS,
//       templeToken.address,
//       staking.address,
//       lockedOGTemple.address,
//       treasury.address,
//       treasuryManagement.address,
//       HARVEST_THRESHOLD,
//       INVITE_THRESHOLD,
//       VERIFIED_BONUS_FACTOR,
//       GUEST_BONUS_FACTOR,
//     );
// 
//     await templeToken.addMinter(openingCeremony.address);
// 
//     ZAP = await new Zap__factory(owner).deploy(
//       openingCeremony.address,
//       FRAX_ADDRESS,
//       UNISWAP_ROUTER_ADDRESS,
//       UNISWAP_QUOTER_ADDRESS,
//     );
// 
// 
//     //Prepare for stakers for testing
//     await openingCeremony.setLimitStablec(toAtto(5000), toAtto(1000000), toAtto(20000));
//     await openingCeremony.setLimitTemple(toAtto(5000), toAtto(1000000));
//     const can_add_verifier_role = await openingCeremony.CAN_ADD_VERIFIED_USER();
//     const verifier = (await ethers.getSigners())[10];
//     await openingCeremony.grantRole(can_add_verifier_role, await verifier.getAddress());
// 
//     for (const s of stakers) {
//       await USDC.transfer(await s.getAddress(), ethers.utils.parseUnits("100000", "mwei"));
//       await openingCeremony.connect(verifier).addVerifiedUser(await s.getAddress());
//     }
// 
//     guests = (await ethers.getSigners()).slice(5, 9);
//     for (const g of guests) {
//       await USDC.transfer(await g.getAddress(), ethers.utils.parseUnits("2000", "mwei"));
//     }
//   })
// 
//   it("Check mainnet fork works", async () => {
//       let swapRouter = new ethers.Contract(UNISWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, owner);
//       let wethAddress = await swapRouter.WETH9();
//       expect(wethAddress).eq("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
//   });
// 
//   it("Verified OpeningCeremony Zaps ETH", async () => {
//     let quoter = new ethers.Contract(UNISWAP_QUOTER_ADDRESS, UNISWAP_QUOTER_ABI, owner);
// 
//     for (const s of stakers) {
//        //This must be reversed of _path, seems like Uniswap bug for quoteExactOutput.
//       const _path = Path.encodePath(["0x853d955aCEf822Db058eb8505911ED77F175b99e","0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], [500,500]);
//       
//       const _fraxAmountOut = toAtto(15000);
//       let _amountTokenInMaximum = (await quoter.callStatic.quoteExactOutput(_path, _fraxAmountOut));
//       _amountTokenInMaximum = _amountTokenInMaximum.add(BigNumber.from(_amountTokenInMaximum).div(BigNumber.from(100))); //Doesn't really matter for ETH as it'll be using the actual ETH value sent, normally can set to 0
//       const overrides = {
//         value: _amountTokenInMaximum, //Actual ETH amount to be sent, which is based off _amountTokenInMaximum
//       }
//       const _tokenAddress = "0x0000000000000000000000000000000000000000"; //0x0... for ETH (not WETH)
// 
//       let intrinsicValueRatio = await treasury.intrinsicValueRatio();
//       let _boughtTemple = _fraxAmountOut.mul(intrinsicValueRatio.temple).div(intrinsicValueRatio.stablec).div(BigNumber.from(MINT_MULTIPLE));
//       let _bonusTemple = _boughtTemple.mul(VERIFIED_BONUS_FACTOR.numerator).div(VERIFIED_BONUS_FACTOR.denominator);
// 
//       let priorBalance = await ethers.provider.getBalance(await s.getAddress());
//       await ZAP.connect(s).mintAndStakeZapsOC(_amountTokenInMaximum, _tokenAddress, _fraxAmountOut, _path, overrides);
//       // await expect(ZAP.connect(s).mintAndStakeZapsOC(_amountTokenInMaximum, _tokenAddress, _fraxAmountOut, _path, overrides))
//       //   .to.emit(openingCeremony, 'MintComplete').withArgs(await s.getAddress(), _fraxAmountOut, _boughtTemple, _bonusTemple, (await lockedOGTemple.callStatic.locked(await s.getAddress(), 0)).BalanceOGTemple); //This doesn't work due to the last parameter, apparently you can't call a contract and wait for it's results as part of the checks.
// 
//       let afterBalance = await ethers.provider.getBalance(await s.getAddress());
//       expect(afterBalance).lt(priorBalance);
// 
//       const mintEvents = await openingCeremony.queryFilter(openingCeremony.filters.MintComplete(), "latest")
//       const lockEvents = await lockedOGTemple.queryFilter(lockedOGTemple.filters.OGTempleLocked(), "latest");
//       const zapEvents = await ZAP.queryFilter(ZAP.filters.ZapComplete(), "latest");
// 
//       expect(mintEvents.length).eq(lockEvents.length);
// 
//       for (const i in mintEvents) {
//         const m = mintEvents[i];
//         const l = lockEvents[i];
//         const z = zapEvents[i];
//         let amountTokenInUsed = z.args.amountExchangeToken;
// 
//         expect(fromAtto(m.args.mintedTemple)).eq(fromAtto(_boughtTemple));
//         expect(fromAtto(m.args.bonusTemple)).eq(fromAtto(_bonusTemple));
//         expect(fromAtto(m.args.mintedOGTemple)).gt(1); // expect OG Temple, calcs themselves tested elsewhere
//         expect(fromAtto(m.args.mintedOGTemple)).eq(fromAtto(l.args._amount));
//         expect(fromAtto(m.args.mintedOGTemple)).eq(fromAtto((await lockedOGTemple.locked(await s.getAddress(), 0)).BalanceOGTemple));
//         // expect(afterBalance).eq(priorBalance.sub(amountTokenInUsed)); //Will never be equal due to gas used. Need to find out how to get amount of gas used for TX in tests.
//         expect(fromAtto(afterBalance)).to.be.closeTo(fromAtto(priorBalance.sub(amountTokenInUsed)), 0.1); //Variance due to gas.
//       }
//     }
//   });
// 
//   it("Verified OpeningCeremony Zaps USDC", async () => {
//     let quoter = new ethers.Contract(UNISWAP_QUOTER_ADDRESS, UNISWAP_QUOTER_ABI, owner);
// 
//     for (const s of stakers) {
//        //This must be reversed of _path, seems like Uniswap bug for quoteExactOutput.
//       const _path = Path.encodePath(["0x853d955aCEf822Db058eb8505911ED77F175b99e","0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], [500]);
//       
//       const _fraxAmountOut = toAtto(15000);
//       let _amountTokenInMaximum = (await quoter.callStatic.quoteExactOutput(_path, _fraxAmountOut));
//       _amountTokenInMaximum = _amountTokenInMaximum.add(BigNumber.from(_amountTokenInMaximum).div(BigNumber.from(100))); //Doesn't really matter for ETH as it'll be using the actual ETH value sent, normally can set to 0
//       const _tokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; //0x0... for ETH (not WETH)
//       let tokenInContract = new ethers.Contract(_tokenAddress, ERC20_ABI, s);
// 
//       let intrinsicValueRatio = await treasury.intrinsicValueRatio();
//       let _boughtTemple = _fraxAmountOut.mul(intrinsicValueRatio.temple).div(intrinsicValueRatio.stablec).div(BigNumber.from(MINT_MULTIPLE));
//       let _bonusTemple = _boughtTemple.mul(VERIFIED_BONUS_FACTOR.numerator).div(VERIFIED_BONUS_FACTOR.denominator);
// 
//       let priorBalance = await tokenInContract.balanceOf(await s.getAddress());
//       await tokenInContract.increaseAllowance(ZAP.address, _amountTokenInMaximum);
//       await ZAP.connect(s).mintAndStakeZapsOC(_amountTokenInMaximum, _tokenAddress, _fraxAmountOut, _path);
//       let afterBalance = await tokenInContract.balanceOf(await s.getAddress());
//       expect(afterBalance).lt(priorBalance);
// 
//       const mintEvents = await openingCeremony.queryFilter(openingCeremony.filters.MintComplete(), "latest")
//       const lockEvents = await lockedOGTemple.queryFilter(lockedOGTemple.filters.OGTempleLocked(), "latest");
//       const zapEvents = await ZAP.queryFilter(ZAP.filters.ZapComplete(), "latest");
// 
//       expect(mintEvents.length).eq(lockEvents.length);
// 
//       for (const i in mintEvents) {
//         const m = mintEvents[i];
//         const l = lockEvents[i];
//         const z = zapEvents[i];
//         let amountTokenInUsed = z.args.amountExchangeToken;
// 
//         expect(fromAtto(m.args.mintedTemple)).eq(fromAtto(_boughtTemple));
//         expect(fromAtto(m.args.bonusTemple)).eq(fromAtto(_bonusTemple));
//         expect(fromAtto(m.args.mintedOGTemple)).gt(1); // expect OG Temple, calcs themselves tested elsewhere
//         expect(fromAtto(m.args.mintedOGTemple)).eq(fromAtto(l.args._amount));
//         expect(fromAtto(m.args.mintedOGTemple)).eq(fromAtto((await lockedOGTemple.locked(await s.getAddress(), 0)).BalanceOGTemple));
//         expect(afterBalance).eq(priorBalance.sub(amountTokenInUsed));
//       }
//     }
//   });
// 
//   it("Guests OpeningCeremony Zaps ETH", async () => {
//     let quoter = new ethers.Contract(UNISWAP_QUOTER_ADDRESS, UNISWAP_QUOTER_ABI, owner);
// 
//     //Set up guests. Have each staker invite one guest each.
//     expect(guests.length).eq(stakers.length);
// 
//     for (let i = 0; i < stakers.length; i++) {
//       await openingCeremony.connect(stakers[i]).addGuestUser(await guests[i].getAddress());
//     }
// 
//     for (const g of guests) {
//        //This must be reversed of _path, seems like Uniswap bug for quoteExactOutput.
//       const _path = Path.encodePath(["0x853d955aCEf822Db058eb8505911ED77F175b99e","0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"], [500,500]);
//       
//       const _fraxAmountOut = toAtto(1000);
//       let _amountTokenInMaximum = (await quoter.callStatic.quoteExactOutput(_path, _fraxAmountOut));
//       _amountTokenInMaximum = _amountTokenInMaximum.add(BigNumber.from(_amountTokenInMaximum).div(BigNumber.from(100))); //Doesn't really matter for ETH as it'll be using the actual ETH value sent, normally can set to 0
//       const overrides = {
//         value: _amountTokenInMaximum, //Actual ETH amount to be sent, which is based off _amountTokenInMaximum
//       }
//       const _tokenAddress = "0x0000000000000000000000000000000000000000"; //0x0... for ETH (not WETH)
// 
//       let intrinsicValueRatio = await treasury.intrinsicValueRatio();
//       let _boughtTemple = _fraxAmountOut.mul(intrinsicValueRatio.temple).div(intrinsicValueRatio.stablec).div(BigNumber.from(MINT_MULTIPLE));
//       let _bonusTemple = _boughtTemple.mul(GUEST_BONUS_FACTOR.numerator).div(GUEST_BONUS_FACTOR.denominator);
// 
//       let priorBalance = await ethers.provider.getBalance(await g.getAddress());
//       await ZAP.connect(g).mintAndStakeZapsOC(_amountTokenInMaximum, _tokenAddress, _fraxAmountOut, _path, overrides);
// 
//       let afterBalance = await ethers.provider.getBalance(await g.getAddress());
//       expect(afterBalance).lt(priorBalance);
// 
//       const mintEvents = await openingCeremony.queryFilter(openingCeremony.filters.MintComplete(), "latest")
//       const lockEvents = await lockedOGTemple.queryFilter(lockedOGTemple.filters.OGTempleLocked(), "latest");
//       const zapEvents = await ZAP.queryFilter(ZAP.filters.ZapComplete(), "latest");
// 
//       expect(mintEvents.length).eq(lockEvents.length);
// 
//       for (const i in mintEvents) {
//         const m = mintEvents[i];
//         const l = lockEvents[i];
//         const z = zapEvents[i];
//         let amountTokenInUsed = z.args.amountExchangeToken;
// 
//         expect(fromAtto(m.args.mintedTemple)).eq(fromAtto(_boughtTemple));
//         expect(fromAtto(m.args.bonusTemple)).eq(fromAtto(_bonusTemple));
//         expect(fromAtto(m.args.mintedOGTemple)).gt(1); // expect OG Temple, calcs themselves tested elsewhere
//         expect(fromAtto(m.args.mintedOGTemple)).eq(fromAtto(l.args._amount));
//         expect(fromAtto(m.args.mintedOGTemple)).eq(fromAtto((await lockedOGTemple.locked(await g.getAddress(), 0)).BalanceOGTemple));
//         expect(fromAtto(afterBalance)).to.be.closeTo(fromAtto(priorBalance.sub(amountTokenInUsed)), 0.1); //Variance due to gas.
//       }
//     }
//   });
// 
//   it("Guests OpeningCeremony Zaps USDC", async () => {
//     let quoter = new ethers.Contract(UNISWAP_QUOTER_ADDRESS, UNISWAP_QUOTER_ABI, owner);
// 
//     //Set up guests. Have each staker invite one guest each.
//     expect(guests.length).eq(stakers.length);
// 
//     for (let i = 0; i < stakers.length; i++) {
//       await openingCeremony.connect(stakers[i]).addGuestUser(await guests[i].getAddress());
//     }
// 
//     for (const g of guests) {
//        //This must be reversed of _path, seems like Uniswap bug for quoteExactOutput.
//       const _path = Path.encodePath(["0x853d955aCEf822Db058eb8505911ED77F175b99e","0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], [500]);
//       
//       const _fraxAmountOut = toAtto(1000);
//       let _amountTokenInMaximum = (await quoter.callStatic.quoteExactOutput(_path, _fraxAmountOut));
//       _amountTokenInMaximum = _amountTokenInMaximum.add(BigNumber.from(_amountTokenInMaximum).div(BigNumber.from(100))); //Doesn't really matter for ETH as it'll be using the actual ETH value sent, normally can set to 0
//       const _tokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; //0x0... for ETH (not WETH)
//       let tokenInContract = new ethers.Contract(_tokenAddress, ERC20_ABI, g);
// 
//       let intrinsicValueRatio = await treasury.intrinsicValueRatio();
//       let _boughtTemple = _fraxAmountOut.mul(intrinsicValueRatio.temple).div(intrinsicValueRatio.stablec).div(BigNumber.from(MINT_MULTIPLE));
//       let _bonusTemple = _boughtTemple.mul(GUEST_BONUS_FACTOR.numerator).div(GUEST_BONUS_FACTOR.denominator);
// 
//       let priorBalance = await tokenInContract.balanceOf(await g.getAddress());
//       await tokenInContract.increaseAllowance(ZAP.address, _amountTokenInMaximum);
//       await ZAP.connect(g).mintAndStakeZapsOC(_amountTokenInMaximum, _tokenAddress, _fraxAmountOut, _path);
//       let afterBalance = await tokenInContract.balanceOf(await g.getAddress());
//       expect(afterBalance).lt(priorBalance);
// 
//       const mintEvents = await openingCeremony.queryFilter(openingCeremony.filters.MintComplete(), "latest")
//       const lockEvents = await lockedOGTemple.queryFilter(lockedOGTemple.filters.OGTempleLocked(), "latest");
//       const zapEvents = await ZAP.queryFilter(ZAP.filters.ZapComplete(), "latest");
// 
//       expect(mintEvents.length).eq(lockEvents.length);
// 
//       for (const i in mintEvents) {
//         const m = mintEvents[i];
//         const l = lockEvents[i];
//         const z = zapEvents[i];
//         let amountTokenInUsed = z.args.amountExchangeToken;
// 
//         expect(fromAtto(m.args.mintedTemple)).eq(fromAtto(_boughtTemple));
//         expect(fromAtto(m.args.bonusTemple)).eq(fromAtto(_bonusTemple));
//         expect(fromAtto(m.args.mintedOGTemple)).gt(1); // expect OG Temple, calcs themselves tested elsewhere
//         expect(fromAtto(m.args.mintedOGTemple)).eq(fromAtto(l.args._amount));
//         expect(fromAtto(m.args.mintedOGTemple)).eq(fromAtto((await lockedOGTemple.locked(await g.getAddress(), 0)).BalanceOGTemple));
//         expect(afterBalance).eq(priorBalance.sub(amountTokenInUsed));
//       }
//     }
//   });
// });
