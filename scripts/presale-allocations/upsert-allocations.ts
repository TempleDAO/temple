/**
 * Run to update pre-sale allocations. An epoch at a time
 *
 * Script needs some environment variables set
 *
 *   1/ set EPOCH to whatever epoch we want to update (default 1)
 *   2/ By default, it's run in dryrun mode. To run it for realz, set the environment variable FOR_REALZ
 */

import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { ERC20__factory, ExitQueue__factory, FakeERC20, FakeERC20__factory, LockedOGTemple, LockedOGTemple__factory, Presale, PresaleAllocation, PresaleAllocation__factory, Presale__factory, TempleERC20Token, TempleERC20Token__factory, TempleStaking, TempleStaking__factory, TempleTreasury, TempleTreasury__factory } from '../../typechain';
import * as fs from 'fs';
import parse from 'csv-parse';
import { expectAddressWithPrivateKey, fromAtto, toAtto } from '../deploys/helpers';
import { createSecureServer } from 'http2';
import { collapseTextChangeRangesAcrossMultipleVersions } from 'typescript';

async function main() {
  expectAddressWithPrivateKey();

  const FOR_REALZ: boolean = process.env.FOR_REALZ !== undefined;
  const EPOCH = Number.parseInt(process.env.EPOCH || "1");

  console.log('');
  if (FOR_REALZ) {
    console.log("!!!!!!!!!! Running for realz, CTRL-C now if that's not what you want");
    // One second delay, to give operator a chance to cancel if they expected this to be in
    // dry run mode
    await new Promise((resolve, reject) => {
      setTimeout(resolve, 1000);
    })
    console.log(`Updating alloccations for epoch ${EPOCH}`)
  } else {
    console.log(`DRY RUN: expected actions to update alloccations for epoch ${EPOCH}`)
  }
  console.log('');

  const [owner] = await ethers.getSigners();

  const contractAddress: {[key: string]: string} = {
    'localhost': '0x202CCe504e04bEd6fC0521238dDf04Bc9E8E15aB',
    'rinkeby': '0x321518CCaf0f815Eff4A219951269A93BA45A5f8',
    'mainnet': '0x6cf2A119f98A4B4A7FA4Fd08A1E72D7aF3ba72FE',
  }

  if (network.name == 'localhost' && contractAddress['localhost'] === '') {
    contractAddress['localhost'] = (await new PresaleAllocation__factory(owner).deploy()).address;
    console.log('Created presale contract:', contractAddress['localhost']);
  }

  const PRESALE_ALLOCATION = new PresaleAllocation__factory(owner).attach(contractAddress[network.name]);

  // parse allocations
  const allocations = await new Promise<{epoch: number, allocation: number, address: string }[]>((resolve, reject) => {
    const allocs: {epoch: number, allocation: number, address: string }[] = [] 
    fs.createReadStream('scripts/presale-allocations/allocations.tsv').pipe(parse({delimiter: '\t'})).on('data', (row: string[]) => {
      if (row[0] === '') {
        return;
      }
      const [epoch, allocation, address] = row;
      allocs.push({
        epoch: Number.parseInt(epoch),
        allocation: Number.parseInt(allocation),
        address: address,
      })
    }).on('close', () => {
      resolve(allocs);
    })
  });

  // Set each allocation if
  //   1. not already set
  //   2. if it's the current epoch, then we add to whatever was there before
  for (const alloc of allocations) {

    // optimisation to speed up script, only run for the current epoch
    if (alloc.epoch !== EPOCH) {
      continue;
    }

    // If it's data we can't handle, skip
    if (alloc.address == 'missing' || alloc.address == 'none') {
      console.log(`**** SKIPING no address: ${alloc.address}`);
      continue;
    }

    if (alloc.allocation === 0) {
      console.log(`**** SKIPING ${alloc.address}. 0 Allocation in data sheet`);
      continue;
    }

    // Otherwise, get value on chain, and work out what the new alloc should be and update
    const currAlloc = await PRESALE_ALLOCATION.allocationOf(alloc.address);
    const [epoch, amount] = [currAlloc.epoch.toNumber(), fromAtto(currAlloc.amount)]

    if (amount === 0) {
      console.log(`ADD ${alloc.address} (${alloc.epoch}, ${alloc.allocation})`);
      if (FOR_REALZ) {
        await PRESALE_ALLOCATION.setAllocation(alloc.address, toAtto(alloc.allocation), alloc.epoch)
      }
    } else if (epoch < EPOCH && alloc.epoch === EPOCH) {
      console.log(`**** UPDATING ${alloc.address} FROM (${epoch}, ${amount}) -- TO -- (${alloc.epoch}, ${amount + alloc.allocation})`);
      if (FOR_REALZ) {
        await PRESALE_ALLOCATION.setAllocation(alloc.address, toAtto(amount + alloc.allocation), alloc.epoch)
      }
    } else {
      console.log(`**** SKIPING ${alloc.address}. Already exists on chain: (${epoch}, ${amount})`);
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
