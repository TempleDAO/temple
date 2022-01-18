// TODO: Re-enable once live with differen end to end scenarios on how people will actually
//       join the temple

// import { ContractTransaction, Signer } from "ethers";
// import { ethers } from "hardhat";
// import { ExitQueue, ExitQueue__factory, FakeERC20, FakeERC20__factory, LockedOGTemple, OGTemple, OGTemple__factory, PresaleAllocation, TempleERC20Token__factory, TempleStaking__factory, TempleTreasury, TempleTreasury__factory } from "../typechain";
// import { LockedOGTemple__factory } from "../typechain/factories/LockedOGTemple__factory";
// import { PresaleAllocation__factory } from "../typechain/factories/PresaleAllocation__factory";
// import { Presale__factory } from "../typechain/factories/Presale__factory";
// import { Presale } from "../typechain/Presale";
// import { TempleERC20Token } from "../typechain/TempleERC20Token";
// import { TempleStaking } from "../typechain/TempleStaking";
// import { blockTimestamp, fromAtto, mineToEpoch, toAtto } from "./helpers";
// import * as fs from 'fs';
// import parse from 'csv-parse';
// import {camelCase, round} from 'lodash';
// import { expect } from "chai";
// import { formatWithOptions } from "util";
// 
// 
// const EPOCH_SIZE = 10;
// const MAX_EXITABLE_PER_ADDRESS = toAtto(1000) ;
// const MAX_EXITABLE_PER_EPOCH = toAtto(1000) ;
// const MINT_MULTIPLE = 10;
// const UNLOCK_SEASON_START_OFFSET_SECONDS = 6;
// const UNLOCK_SEASON_END_OFFSET_SECONDS = 6;
// 
// /* This is a column in the spreadsheet for each case. Captures both state changes and expected invariants */
// interface StateAndExpectedInvariants {
//     // Parameters at start of epoch
//     epoch: number
//     epy: number
//     mintMultiple: number
//     mintySteakLockInPeriod: number
//     scalingFactorForHarvest: number
//     stakingRewardsPoolShare: number
//     lpRewardsPoolShare: number
//     bonusYieldPoolShare: number
//     teamPoolShare: number
// 
//     // Start of epoch data
//     templeSupplyForIvCalc: number;
//     treasuryInDaiCalc: number|"seed-mint"
//     stakingRewardsPaidLastEpoch: number
//     totalLockedStakedTempleIncRewards: number
//     totalNoLockStakedTempleIncRewards: number
//     totalTempleInStakingPoolUnearned: number
//     totalTempleInLpPoolUnearned: number
//     totalTempleInBonusPoolUnearned: number
//     totalTempleInTeamPool: number
// 
//     // Actions by user
//     daiInflowFromRegularStake: number
//     daiFromMintySteak: number
//     daiInflowFromInvestments: number
// 
//     templeMintedForAmm: number
//     treasuryDaiToAmm: number
// 
//     templeEnteringUnstakeQueue: number
//     templeWithdrawnFromUnstakeQueueExcelAssumesImmediate: number
//   }
// 
// // describe.only("Scenarios", async () => {
// xdescribe("Scenarios", async () => {
//   let STABLEC: FakeERC20;
//   let TREASURY: TempleTreasury;
//   let TEMPLE: TempleERC20Token;
//   let EXIT_QUEUE: ExitQueue
//   let STAKING: TempleStaking;
//   let OG_TEMPLE: OGTemple;
//   let STAKING_LOCK: LockedOGTemple;
//   let PRESALE: Presale;
//   let PRESALE_ALLOCATION: PresaleAllocation;
//   let owner: Signer;
// 
//   let lpPool: string;
//   let bonusYieldPool: string; 
//   let teamPool: string; 
//   
//   const cases: string[] = [
//     "scenarios/presale-harvest-80.tsv",
//     "scenarios/presale-100pc-harvest.tsv",
//   ]
// 
//   beforeEach(async () => {
//     [owner] = await ethers.getSigners();
// 
//     STABLEC = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");
//     PRESALE_ALLOCATION = await new PresaleAllocation__factory(owner).deploy();
// 
//     TEMPLE = await new TempleERC20Token__factory(owner).deploy()
//     EXIT_QUEUE = await new ExitQueue__factory(owner).deploy(
//       TEMPLE.address,
//       MAX_EXITABLE_PER_EPOCH,
//       MAX_EXITABLE_PER_ADDRESS,
//       EPOCH_SIZE,
//     );
// 
//     STAKING = await new TempleStaking__factory(owner).deploy(
//       TEMPLE.address,
//       EXIT_QUEUE.address,
//       EPOCH_SIZE,
//       (await blockTimestamp()) - 1,
//     );
// 
//     OG_TEMPLE = new OGTemple__factory(owner).attach(await STAKING.OG_TEMPLE());
//     STAKING_LOCK = await new LockedOGTemple__factory(owner).deploy(await OG_TEMPLE.address);
// 
//     TREASURY = await new TempleTreasury__factory(owner).deploy(
//       TEMPLE.address,
//       STABLEC.address,
//     );
// 
//     PRESALE = await new Presale__factory(owner).deploy(
//        STABLEC.address,
//        TEMPLE.address,
//        STAKING.address,
//        STAKING_LOCK.address,
//        TREASURY.address,
//        PRESALE_ALLOCATION.address,
//        MINT_MULTIPLE,
//        (await STAKING.startTimestamp()).toNumber() + UNLOCK_SEASON_START_OFFSET_SECONDS,
//     )
// 
//     await TEMPLE.addMinter(TREASURY.address);
//     await TEMPLE.addMinter(PRESALE.address);
//     await STABLEC.mint(await owner.getAddress(), toAtto(2000000000));
//     await STABLEC.increaseAllowance(TREASURY.address, toAtto(200));
//     await STABLEC.increaseAllowance(PRESALE.address, toAtto(2000000000));
//     await PRESALE_ALLOCATION.setAllocation(await owner.getAddress(), toAtto(2000000000), 1);
// 
//     // setup pools that will be a wallet to start with
//     lpPool = await ethers.Wallet.createRandom().getAddress();
//     bonusYieldPool = await ethers.Wallet.createRandom().getAddress();
//     teamPool = await ethers.Wallet.createRandom().getAddress();
//   })
// 
//   const scenarios: {[key: string]: Promise<StateAndExpectedInvariants[]>} = {};
//   for (const scenarioFile of cases) {
//     scenarios[scenarioFile] = new Promise((resolve, reject) => {
//       const scenario: StateAndExpectedInvariants[] = [];
// 
//       fs.createReadStream(scenarioFile).pipe(parse({delimiter: '\t'})).on('data', (row: string[]) => {
//           const data = row.slice(4);
//           if (scenario.length === 0) {
//             for (const _ in data) {
//               scenario.push({} as StateAndExpectedInvariants);
//             }
//           }
//           if (scenario.length !== data.length) {
//             reject("Error in scenario setup, all rows must be the same length");
//           }
// 
//           for (const i in data) {
//             if (data[1].trim() === '') {
//               continue;
//             } else if (data[i] === "seed-mint") {
//               (scenario[i] as any)[camelCase(row[1].toLocaleLowerCase())] = "seed-mint";
//             } else {
//               (scenario[i] as any)[camelCase(row[1].toLocaleLowerCase())] = Number.parseFloat(data[i].replace(/,/g, ''));
//             }
//           }
//         }).on('close', () => {
//           resolve(scenario);
//         })
//     });
//   }
// 
//   for (const name in scenarios) {
// 
// 
//     it(name, async () => {
//       const actionsAndInvariants = await scenarios[name];
//       for (const a of actionsAndInvariants) {
//         console.log();
//         console.log(`epoch: ${a.epoch}`);
//         if ((await STAKING.currentEpoch()).toNumber() < a.epoch) {
//           await mineToEpoch((await STAKING.startTimestamp()).toNumber(), (await STAKING.epochSizeSeconds()).toNumber(), a.epoch);
//         }
//         await STAKING.setEpy(a.epy / 100.0 * 10000, 10000);
//         await PRESALE.setUnlockTimestamp((await blockTimestamp()) + (a.mintySteakLockInPeriod * 24 * 60 * 60));
//         await TREASURY.upsertPool(STAKING.address, a.stakingRewardsPoolShare);
//         await TREASURY.upsertPool(lpPool, a.lpRewardsPoolShare);
//         console.log((await TREASURY.poolHarvestShare(lpPool)).toNumber());
//         await TREASURY.upsertPool(bonusYieldPool, a.bonusYieldPoolShare);
//         await TREASURY.upsertPool(teamPool, a.teamPoolShare);
// 
//         // Seed mint is special, no checks to be run if we are yet to seed mint
//         if (a.treasuryInDaiCalc === "seed-mint") {
//           await STABLEC.increaseAllowance(TREASURY.address, toAtto(a.daiInflowFromRegularStake));
//           await TREASURY.seedMint(toAtto(a.daiInflowFromRegularStake), toAtto(a.templeSupplyForIvCalc))
//           await TEMPLE.increaseAllowance(STAKING.address, toAtto(a.templeSupplyForIvCalc));
//           await STAKING.stake(toAtto(a.templeSupplyForIvCalc));
//           continue;
//         }
// 
//         // Invariants (pre mint and harvest)
//         const iv = await TREASURY.intrinsicValueRatio();
//         console.log('Total Dai (code, model)', fromAtto(iv.stablec), a.treasuryInDaiCalc);
//         console.log('Total Temple (code, model)', fromAtto(iv.temple), a.templeSupplyForIvCalc);
//         expect(fromAtto(iv.stablec)).approximately(a.treasuryInDaiCalc, 1e-2);
//         expect(fromAtto(iv.temple)).approximately(a.templeSupplyForIvCalc, 1e-2);
// 
//         // check invariant that we always have enough TEMPLE in the staking contract to pay out rewards
//         const totalOGTemple = await OG_TEMPLE.totalSupply();
//         const minExpectedStakingBalanceTemple = fromAtto(await STAKING.balance(totalOGTemple));
//         const stakingTotalTemple = fromAtto(await TEMPLE.balanceOf(STAKING.address));
//         expect(minExpectedStakingBalanceTemple).lte(stakingTotalTemple);
// 
//         // NOTE: Model MECE breakdown is different to how it's done on chain, these checks are harder now
//         // const epy: number = round(1 + (await STAKING.getEpy(1000000000)).toNumber() / 1000000000.0, 2);
//         // const totalOgTemple = await OG_TEMPLE.totalSupply();
//         // const nTempleStakedIncRewards = fromAtto(await STAKING.balance(totalOgTemple));
//         // const nTempleAsOfEpochNMinus1 = nTempleStakedIncRewards / epy;
//         // console.log(nTempleStakedIncRewards, nTempleAsOfEpochNMinus1, a.totalLockedStakedTempleIncRewards, a.totalNoLockStakedTempleIncRewards, a.totalLockedStakedTempleIncRewards + a.totalNoLockStakedTempleIncRewards, epy, (a.totalLockedStakedTempleIncRewards + a.totalNoLockStakedTempleIncRewards));
//         // expect(nTempleAsOfEpochNMinus1, `All staked temple, including rewards, as of last epoch`).approximately(a.totalLockedStakedTempleIncRewards + a.totalNoLockStakedTempleIncRewards, 2);
//         
//         console.log(fromAtto(await TEMPLE.balanceOf(lpPool)), a.totalTempleInLpPoolUnearned, 'lp pool');
//         console.log(fromAtto(await TEMPLE.balanceOf(teamPool)), a.totalTempleInTeamPool, 'team pool');
//         console.log(fromAtto(await TEMPLE.balanceOf(bonusYieldPool)), a.totalTempleInLpPoolUnearned, 'bonusYieldPool');
// 
//         expect(fromAtto(await TEMPLE.balanceOf(lpPool)), 'lp pool').approximately(a.totalTempleInLpPoolUnearned, 1e-2);
//         expect(fromAtto(await TEMPLE.balanceOf(bonusYieldPool)), 'bonus pool').approximately(a.totalTempleInBonusPoolUnearned, 1e-2);
//         expect(fromAtto(await TEMPLE.balanceOf(teamPool)), 'team pool').approximately(a.totalTempleInTeamPool, 1e-2);
// 
//         // Actions
//         if (a.daiFromMintySteak > 0) {
//           console.log(a.daiFromMintySteak);
//           await PRESALE.mintAndStake(toAtto(a.daiFromMintySteak));
//         }
//         await TREASURY.harvest(a.scalingFactorForHarvest);
//         console.log(fromAtto(await TREASURY.harvestedRewardsTemple()));
//         await TREASURY.distributeHarvest();
//       }
//     }).timeout(10000 * 1000);
//   }
// });