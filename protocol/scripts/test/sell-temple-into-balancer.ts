import { ethers, network } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { IBalancerVault, IERC20, IBalancerVault__factory, IERC20__factory } from "../../typechain";
import { DEPLOYED_CONTRACTS, blockTimestamp, mine } from '../deploys/helpers';

/**
 * Sell Temple => DAI in the Balancer pool
 * 1/ Get Foundry: https://book.getfoundry.sh/getting-started/installation
 * 2/ Run Anvil:
 *         anvil -f <MAINNET_RPC> --fork-block-number <BLOCK_ID>
 *       where: <MAINNET_RPC> == A mainnet RPC, eg https://eth-mainnet.alchemyapi.io/v2/<KEY>
 *              <BLOCK_ID> == A recent mainnet block from https://etherscan.io/blocks, eg 17213900
 *                            For repeatable tests, use the same block id.
 * 3/ Run this script:
 *         npx hardhat run --network anvil scripts/test/sell-temple-into-balancer.ts
*/

async function quote(
    balancerVault: IBalancerVault,
    poolId: string,
    templeToken: IERC20,
    daiToken: IERC20,
    amount: BigNumber,
    templeWhale: Signer,
): Promise<BigNumber> {
    const kind = 0; // Out Given Exact In
    const swapSteps = [
        {
            poolId,
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amount,
            userData: "0x"
        },
    ];
    const assets = [
        templeToken.address,
        daiToken.address,
    ];
    const funds = {
        sender: await templeWhale.getAddress(),
        fromInternalBalance: false,
        recipient: await templeWhale.getAddress(),
        toInternalBalance: false
    };
    const assetDeltas = await balancerVault.callStatic.queryBatchSwap(kind, swapSteps, assets, funds);
    console.log("Quote Asset Deltas:", assetDeltas);
    return assetDeltas[1].mul(-1);
}

async function swap(
    balancerVault: IBalancerVault,
    poolId: string,
    templeToken: IERC20,
    daiToken: IERC20,
    templeAmountToSell: BigNumber,
    expectedDaiAmount: BigNumber,
    slippageBps: number, // 10_000 == 100%. 1_000 == 1%
    templeWhale: Signer,
) {
    const kind = 0; // Out Given Exact In
    const singleSwap = {
        poolId,
        kind,
        assetIn: templeToken.address,
        assetOut: daiToken.address,
        amount: templeAmountToSell,
        userData: "0x"
    };

    const funds = {
        sender: await templeWhale.getAddress(),
        fromInternalBalance: false,
        recipient: await templeWhale.getAddress(),
        toInternalBalance: false
    };

    balancerVault = balancerVault.connect(templeWhale);

    const minDaiExpectedAfterSlippage = expectedDaiAmount.mul(10_000 - slippageBps).div(10_000);
    console.log("minDaiExpectedAfterSlippage:", ethers.utils.formatEther(minDaiExpectedAfterSlippage));

    const balancesBefore = {
        eth: await balancerVault.signer.getBalance(),
        temple: await templeToken.balanceOf(templeWhale.getAddress()),
        dai: await daiToken.balanceOf(templeWhale.getAddress()),
    };

    // Do the swap and wait for it to mine
    await mine(balancerVault.swap(singleSwap, funds, minDaiExpectedAfterSlippage, await blockTimestamp() + 60));

    const balancesAfter = {
        eth: await balancerVault.signer.getBalance(),
        temple: await templeToken.balanceOf(templeWhale.getAddress()),
        dai: await daiToken.balanceOf(templeWhale.getAddress()),
    };

    const getDelta = (b: BigNumber, a: BigNumber) => ethers.utils.formatEther(a.sub(b));

    console.log("Balances Change:");
    console.log(`\tETH   : ${getDelta(balancesBefore.eth, balancesAfter.eth)}`);
    console.log(`\tTEMPLE: ${getDelta(balancesBefore.temple, balancesAfter.temple)}`);
    console.log(`\tDAI   : ${getDelta(balancesBefore.dai, balancesAfter.dai)}`);

}

// Impersonate an address and run fn(signer), then stop impersonating.
async function impersonateSigner(address: string): Promise<Signer> {
    await network.provider.request({
      method: 'anvil_impersonateAccount',
      params: [address],
    });
    return await ethers.getSigner(address);
}
  
async function main() {
    // anvilSigner is pulled from "remote", ie the anvil node.
    const [anvilSigner] = await ethers.getSigners();
    console.log(`Anvil Signer: ${await anvilSigner.getAddress()}`);

    const balancerVault = IBalancerVault__factory.connect(DEPLOYED_CONTRACTS.mainnet.BALANCER_VAULT, anvilSigner);
    const templeToken = IERC20__factory.connect(DEPLOYED_CONTRACTS.mainnet.TEMPLE, anvilSigner);
    const daiToken = IERC20__factory.connect(DEPLOYED_CONTRACTS.mainnet.DAI_TOKEN, anvilSigner);
    const templeWhale = await impersonateSigner("0xfa4fc4ec2f81a4897743c5b4f45907c02ce06199");
    const templeAmountToSell = ethers.utils.parseEther("100000");
    const poolId = "0x8bd4a1e74a27182d23b98c10fd21d4fbb0ed4ba00002000000000000000004ed";
    const slippageBps = 500; // 0.05%

    const expectedDaiAmount = await quote(
        balancerVault,
        poolId,
        templeToken,
        daiToken,
        templeAmountToSell,
        templeWhale
    );

    await mine(templeToken.approve(balancerVault.address, templeAmountToSell));
    await swap(
        balancerVault,
        poolId,
        templeToken,
        daiToken,
        templeAmountToSell,
        expectedDaiAmount,
        slippageBps,
        templeWhale
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
