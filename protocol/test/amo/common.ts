import { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { IBalancerVault, IBalancerHelpers, IERC20, IWeightPool2Tokens, TempleERC20Token } from "../../typechain";
import amoAddresses from "./amo-constants";
import { toAtto } from "../helpers";

const { TEMPLE_BB_A_USD_BALANCER_POOL_ID } = amoAddresses.mainnet.others;

export async function seedTempleBbaUsdPool(
    templeToken: TempleERC20Token,
    balancerVault: IBalancerVault,
    balancerHelpers: IBalancerHelpers,
    signer: Signer,
    amount: BigNumber,
    to: string
) {
    const signerAddress = await signer.getAddress();
    const maxAmountsIn = [amount, amount];
    const [assets, ,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
    const { joinPoolRequest } = await getJoinPoolRequest(assets, balancerHelpers, signerAddress, to, maxAmountsIn);

    // No approval required for bbaUsd into the balancer vault.
    await templeToken.connect(signer).approve(balancerVault.address, amount);
    await balancerVault.connect(signer).joinPool(TEMPLE_BB_A_USD_BALANCER_POOL_ID, signerAddress, to, joinPoolRequest); 
}

export async function swapDaiForBbaUsd(
    balancerVault: IBalancerVault,
    daiToken: IERC20,
    daiWhale: Signer,
    amount: BigNumber,
    to: string
) {
    const whaleAddress = await daiWhale.getAddress();
    const daiConnect = daiToken.connect(daiWhale);
    // do batch swap
    const kind = 0;
    const swaps = [
        {
            poolId: "0xae37d54ae477268b9997d4161b96b8200755935c000000000000000000000337",
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amount,
            userData: "0x"
        },
        {
            poolId: "0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb",
            assetInIndex: 1,
            assetOutIndex: 2,
            amount: 0,
            userData: "0x"
        },
        {
            poolId: "0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe",
            assetInIndex: 2,
            assetOutIndex: 3,
            amount: 0,
            userData: "0x"
        },
        {
            poolId: "0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc",
            assetInIndex: 3,
            assetOutIndex: 4,
            amount: 0,
            userData: "0x"
        }, 
        {
            poolId: "0x82698aecc9e28e9bb27608bd52cf57f704bd1b83000000000000000000000336",
            assetInIndex: 4,
            assetOutIndex: 5,
            amount: 0,
            userData: "0x"
        },
        {
            poolId: "0xa13a9247ea42d743238089903570127dda72fe4400000000000000000000035d",
            assetInIndex: 5,
            assetOutIndex: 6,
            amount: 0,
            userData: "0x"
        }
    ];
    const assets = [
        "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        "0x02d60b84491589974263d922D9cC7a3152618Ef6",
        "0x804CdB9116a10bB78768D3252355a1b18067bF8f",
        "0x9210F1204b5a24742Eba12f710636D76240dF3d0",
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "0x82698aeCc9E28e9Bb27608Bd52cF57f704BD1B83",
        "0xA13a9247ea42D743238089903570127DdA72fE44",
    ];
    const zero = BigNumber.from(0);
    const limits = [
        amount,
        zero,
        zero,
        zero,
        zero,
        zero,
        BigNumber.from(-1).mul(amount).mul(9).div(10) // -1 * amount * 90%
    ];
    const deadline = toAtto(100);
    const funds = {
        sender: whaleAddress,
        fromInternalBalance: false,
        recipient: to,
        toInternalBalance: false
    }
    await daiConnect.approve(balancerVault.address, amount);
    await balancerVault.connect(daiWhale).batchSwap(kind, swaps, assets, funds, limits, deadline);
}

export async function ownerAddLiquidity(
    balancerVault: IBalancerVault,
    balancerHelpers: IBalancerHelpers,
    templeToken: TempleERC20Token,
    signer: Signer,
    from: string,
    to: string,
    amountIn: BigNumber
) {
    const [tokens, ,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
    const { joinPoolRequest } = await getJoinPoolRequest(tokens, balancerHelpers, from, to, [amountIn, amountIn]);

    // No approval required for bbaUsd into the balancer vault.
    await templeToken.connect(signer).approve(balancerVault.address, amountIn);
    await balancerVault.connect(signer).joinPool(TEMPLE_BB_A_USD_BALANCER_POOL_ID, await signer.getAddress(), to, joinPoolRequest);
}

export async function getTempleIndexInBalancerPool(
    balancerVault: IBalancerVault,
    templeAddress: string
) {
    const [tokens, ,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
    let index = 0;
    for(let i=0; i<tokens.length; i++) {
        if (ethers.utils.getAddress(tokens[i]) == ethers.utils.getAddress(templeAddress)) {
            index = i;
            break;
        }
    }
    return index;
}

export async function getJoinPoolRequest(
    assets: string[],
    balancerHelpers: IBalancerHelpers,
    from: string,
    to: string,
    maxAmountsIn: BigNumber[]
) {
    let userData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]", "uint256"], [1, maxAmountsIn, 1]);
    let joinPoolRequest = {
        assets,
        maxAmountsIn,
        userData,
        fromInternalBalance: false
    };
    const [bptOut, amountsIn] = await balancerHelpers.queryJoin(TEMPLE_BB_A_USD_BALANCER_POOL_ID, from, to, joinPoolRequest);

    // Use the quoted bptOut and amountsIn for the final request
    userData = ethers.utils.defaultAbiCoder.encode(["uint256","uint256[]","uint256"], [1, amountsIn, bptOut]);
    joinPoolRequest = {
        assets,
        maxAmountsIn: amountsIn,
        userData: userData,
        fromInternalBalance: false
    };
    
    return {
        joinPoolRequest,
        bptOut
    };
}

export async function getSpotPriceScaled(
    balancerVault: IBalancerVault,
    weightedPool2Tokens: IWeightPool2Tokens
) {
    const precision = toAtto(1);
    const [, balances,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
    const normWeights = await weightedPool2Tokens.getNormalizedWeights();
    // multiply by precision to avoid rounding down
    // 1e18 * templeWeight * stableAmount / (stableWeight * templeAmount)
    const currentSpotPrice = precision.mul(normWeights[0]).mul(balances[1]).div(normWeights[1].mul(balances[0]));
    return currentSpotPrice;
}

export function stableLotSizeForPriceTarget(
    balances: BigNumber[],
    templeIndexInPool: number,
    priceTarget: BigNumber
): BigNumber {
    const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;
    const bdQuote = balances[templeIndexInPool].mul(priceTarget).div(toAtto(1));
    return balances[stableIndexInPool].sub(bdQuote).abs();
}

export async function templeLotSizeForPriceTarget(
    balancerVault: IBalancerVault,
    templeIndexInPool: number,
    priceTarget: BigNumber
): Promise<BigNumber> {
    const [, balances,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
    const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;
    const bdDivQuoteWithFee = balances[stableIndexInPool].mul(toAtto(1)).div(BigNumber.from(priceTarget));
    return balances[templeIndexInPool].sub(bdDivQuoteWithFee).abs();
}

export async function singleSideDeposit(
    balancerVault: IBalancerVault,
    balancerHelpers: IBalancerHelpers,
    whale: Signer,
    amountsIn: BigNumber[],
) {
    const whaleAddress = await whale.getAddress();
    const [assets, ,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
    const { joinPoolRequest } = await getJoinPoolRequest(assets, balancerHelpers, whaleAddress, whaleAddress, amountsIn);

    // No approval required for bbaUsd into the balancer vault.
    await balancerVault.connect(whale).joinPool(TEMPLE_BB_A_USD_BALANCER_POOL_ID, whaleAddress, whaleAddress, joinPoolRequest);
}
