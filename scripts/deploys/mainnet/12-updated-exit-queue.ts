import '@nomiclabs/hardhat-ethers';
import { BigNumber } from 'ethers';
import { ethers, network } from 'hardhat';
import { ExitQueue, ExitQueue__factory, TempleStaking__factory } from '../../../typechain';
import { deployAndMine, DEPLOYED_CONTRACTS, mine, toAtto } from '../helpers';

const MAX_EXITABLE_PER_ADDRESS = toAtto(112358100000000000000000) ;
const MAX_EXITABLE_PER_EPOCH   = toAtto(112358100000000000000000) ;
const EPOCH_SIZE = 640;

async function main() {
  const [owner] = await ethers.getSigners();

  let DEPLOYED: {
    TEMPLE: string;
  };

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  const exitQueueFactory = new ExitQueue__factory(owner);
  const exitQueue: ExitQueue = await deployAndMine(
    'EXIT_QUEUE', exitQueueFactory, exitQueueFactory.deploy,
    DEPLOYED.TEMPLE,
    MAX_EXITABLE_PER_EPOCH,
    MAX_EXITABLE_PER_ADDRESS,
    EPOCH_SIZE,
  )

  const exits: [string, BigNumber][] = [
    [ "0x82dcff3c5f3cd89eee6887ca817a92289a73b7b8", BigNumber.from("52174046108558000000000") ],
    [ "0xb92480f52f33731568154fa811851a7316c503a2", BigNumber.from("19886640081941200000") ],
    [ "0x6f4fc13fc8205162d5003bb2bd2ef7a6ea1439c6", BigNumber.from("1426217620189770000000") ],
    [ "0x55e4750743f1e394dff3e46eb03136fc27f29611", BigNumber.from("2412031467123610000000") ],
    [ "0x9272b16e278051ed961886e67bf31b45e2d8cb66", BigNumber.from("2698485852260370000000") ],
    [ "0xdb4f969eb7904a6ddf5528ae8d0e85f857991cfd", BigNumber.from("574929072056737000000") ]
  ]

  await mine(exitQueue.setOwedTemple(exits.map(x => x[0]), exits.map(x => x[1])));
  await mine(exitQueue.transferOwnership("0x4D6175d58C5AceEf30F546C0d5A557efFa53A950");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });