/**
 * Run to update pre-sale allocations. An epoch at a time
 *
 * Script needs some manual editing on each run (hasn't been factored to command line flags)
 *
 *   1/ Update CURRENT_EPOCH value
 *   2/ Run once in 'dryrun' mode (that is, with lines which update contracts commented out)
 *   3/ After confirming changes, run again with those lines enabled
 */

import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { ERC20__factory, ExitQueue__factory, FakeERC20, FakeERC20__factory, LockedOGTemple, LockedOGTemple__factory, Presale, PresaleAllocation, PresaleAllocation__factory, Presale__factory, TempleERC20Token, TempleERC20Token__factory, TempleStaking, TempleStaking__factory, TempleTreasury, TempleTreasury__factory } from '../../typechain';
import * as fs from 'fs';
import parse from 'csv-parse';
import { fromAtto, toAtto } from '../deploys/helpers';
import { createSecureServer } from 'http2';
import { collapseTextChangeRangesAcrossMultipleVersions } from 'typescript';

async function main() {
  expectAddressWithPrivateKeyOnMainnet();

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
  const CURRENT_EPOCH = 11;
  for (const alloc of allocations) {
    if (alloc.address == 'missing') {
      continue;
    }

    // optimisation to speed up script, only run for the current epoch
    if (alloc.epoch !== CURRENT_EPOCH) {
      continue;
    }

    const currAlloc = await PRESALE_ALLOCATION.allocationOf(alloc.address);
    const [epoch, amount] = [currAlloc.epoch.toNumber(), fromAtto(currAlloc.amount)]

    if (amount === 0) {
      console.log(`ADD ${alloc.address} (${alloc.epoch}, ${alloc.allocation})`);
      // await PRESALE_ALLOCATION.setAllocation(alloc.address, toAtto(alloc.allocation), alloc.epoch)
    } else if (epoch < CURRENT_EPOCH && alloc.epoch === CURRENT_EPOCH) {
      console.log(`**** UPDATING ${alloc.address} FROM (${epoch}, ${amount}) -- TO -- (${alloc.epoch}, ${amount + alloc.allocation})`);
      // await PRESALE_ALLOCATION.setAllocation(alloc.address, toAtto(amount + alloc.allocation), alloc.epoch)
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
