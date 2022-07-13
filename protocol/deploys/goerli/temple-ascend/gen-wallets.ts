import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';

async function main() {
    for (let i = 0; i < 20; i++) {
        const wallet = ethers.Wallet.createRandom()
        console.log(`"${wallet.privateKey.substring(2)}",`)
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