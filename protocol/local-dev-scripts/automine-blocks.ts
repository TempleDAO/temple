import '@nomiclabs/hardhat-ethers';
import { blockTimestamp, mineToTimestamp } from '../test/helpers';

// Mine a new block every second (useful in local testing to simulate activity on production)
async function main() {
  const mineblocks = setTimeout(async () => {
    const timestamp = await blockTimestamp();
    await mineToTimestamp(timestamp);
    console.info(`EVM timestamp: ${timestamp}`);
    await main();
  }, 1000);
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then()
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
