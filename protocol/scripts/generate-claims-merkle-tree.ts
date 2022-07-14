import '@nomiclabs/hardhat-ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { toAtto } from './deploys/helpers';

async function main() {
  let abi = new ethers.utils.AbiCoder()

  // TODO: This should be a file checked that both the dApp and the protocol can reference
  const claims: [string,BigNumber][] = [
    ["0x407d73d8a49eeb85d32cf465507dd71d507100c3", toAtto(100)],
    ["0x407d73d8a49eeb85d32cf465507dd71d507100c3", toAtto(50)],
  ]

  const claimsMerkleTree = new MerkleTree(claims.map(c => keccak256(abi.encode(['address', 'uint256'], c))), keccak256, {sortPairs: true});

  console.log('*** MERKLE TREE ROOT ***');
  console.log(claimsMerkleTree.getRoot().toString('hex'));
  console.log("Buffer.from('...', 'hex') // convert back to buffer for use in smart contract setup")
  console.log();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });