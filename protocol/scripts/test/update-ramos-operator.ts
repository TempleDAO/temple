import { ethers, network } from "hardhat";
import { Signer } from "ethers";
import { RAMOS__factory } from "../../typechain";
import { DEPLOYED_CONTRACTS, mine } from '../deploys/helpers';

/**
 * Update RAMOS' operator in an Anvil (Foundry) forked mainnet
 * 1/ Get Foundry: https://book.getfoundry.sh/getting-started/installation
 * 2/ Run Anvil:
 *         anvil -f <MAINNET_RPC> --fork-block-number <BLOCK_ID>
 *       where: <MAINNET_RPC> == A mainnet RPC, eg https://eth-mainnet.alchemyapi.io/v2/<KEY>
 *              <BLOCK_ID> == A recent mainnet block from https://etherscan.io/blocks, eg 17213900
 *                            For repeatable tests, use the same block id.
 * 3/ Run this script:
 *         npx hardhat run --network anvil scripts/test/update-ramos-operator.ts
 */

// Impersonate an address and run fn(signer), then stop impersonating.
async function impersonateSigner(address: string): Promise<Signer> {
    await network.provider.request({
      method: 'anvil_impersonateAccount',
      params: [address],
    });
    return await ethers.getSigner(address);
}

// Transfer ETH from one account to another.
async function fundEth(from: Signer, to: Signer, amount: number) {
    await from.sendTransaction({
        to: await to.getAddress(),
        value: ethers.utils.parseEther(amount.toString()),
    });
}
  
async function main() {
    // anvilSigner is pulled from "remote", ie the anvil node.
    const [anvilSigner] = await ethers.getSigners();
    console.log(`Anvil Signer: ${await anvilSigner.getAddress()}`);

    // UPDATE THIS TO YOUR BOT EOA
    const newOperator = await anvilSigner.getAddress();

    const ramos = RAMOS__factory.connect(DEPLOYED_CONTRACTS.mainnet.RAMOS_DAI, anvilSigner);   

    // Impersonate and fund the Temple multisig with ETH.
    const msigAddr = await ramos.owner();
    const msig = await impersonateSigner(msigAddr);
    await fundEth(anvilSigner, msig, 1);
    
    // Update the operator to our bot.
    await mine(ramos.connect(msig).setOperator(newOperator));
    console.log(`RAMOS operator == ${await ramos.operator()}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
