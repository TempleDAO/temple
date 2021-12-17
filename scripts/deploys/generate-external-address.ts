// Generate one off wallet address (for use in verification etc)
//  eg. when creating a once-off verifier address (for TempleCashback for example)
//      to gate access to the opening ceremony for those who completed the quest (eg. server generated signed requests)

import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { expectAddressWithPrivateKey } from './helpers';

async function main() {
  expectAddressWithPrivateKey();
  const [owner] = await ethers.getSigners();

  const externalAddress = ethers.Wallet.createRandom();
  console.log('PRIVATE KEY', externalAddress.privateKey);
  console.log('ADDRESS', externalAddress.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });