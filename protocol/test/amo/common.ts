import { ethers, network } from "hardhat";
import { BigNumber, Contract, ContractReceipt, Signer } from "ethers";
import { AMO__IBalancerVault, ERC20, IBalancerHelpers, IERC20, IWeightPool2Tokens, TempleERC20Token } from "../../typechain";
import { expect } from "chai";
import amoAddresses from "./amo-constants";
import { toAtto } from "../helpers";

const { BALANCER_POOL_ID } = amoAddresses.others;
const { BBA_USD_TOKEN, TEMPLE } = amoAddresses.tokens;

export async function resetFork(blockNumber: Number) {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.TESTS_MAINNET_RPC_URL,
            blockNumber
          },
        },
      ],
    });
}

export async function impersonateAddress(address: string) {
    await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [address],
    });
    return ethers.provider.getSigner(address);
}

export async function fund(tokenWithSigner: IERC20, to: string, amount: BigNumber) {
    await tokenWithSigner.transfer(to, amount);
}

export function expectedEventsWithValues(
    receipt: ContractReceipt,
    eventTopic: string,
    decodeParams: string[],
    expectedValues: any[],
    returnlog: boolean
) {
    let eventFired: boolean = false;
    for (const log of receipt.logs) {
        if (log.topics.length > 0 && eventTopic == log.topics[0]) {
            eventFired = true;
            if (returnlog) {
                return log;
            }
            for (let i=0; i<expectedValues.length; i++) {
                if (expectedValues[i] !== undefined) {
                    if (i < log.topics.length-1) {
                        expect(expectedValues[i]).to.eq(log.topics[i+1]);
                    } else {
                        expect(expectedValues[i]).to.eq(ethers.utils.defaultAbiCoder.decode(["uint256"], log.data)[0]);
                    }
                }   
            }
        }
    }
    expect(eventFired).to.eq(true);
}

export async function seedTempleBbaUsdPool(
    bbaUsdToken: IERC20,
    templeToken: TempleERC20Token,
    bptToken: IERC20,
    balancerVault: AMO__IBalancerVault,
    balancerHelpers: IBalancerHelpers,
    signer: Signer,
    amount: BigNumber,
    to: string
) {
    const signerAddress = await signer.getAddress();
    // approvals
    await bbaUsdToken.connect(signer).approve(balancerVault.address, amount);
    await templeToken.connect(signer).approve(balancerVault.address, amount);
    const tokens = [TEMPLE, BBA_USD_TOKEN];
    const maxAmountsIn = [amount, amount];
    const userdata = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]", "uint256"], [1, maxAmountsIn, 1]);
    let req  = {
        assets: tokens,
        maxAmountsIn: maxAmountsIn,
        userData: userdata,
        fromInternalBalance: false
    }
    let bptOut: BigNumber;
    let amountsIn: BigNumber[];
    [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, signerAddress, to, req);

    req.maxAmountsIn = amountsIn;
    req.userData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]", "uint256"], [1, amountsIn, bptOut]);
    await balancerVault.connect(signer).joinPool(BALANCER_POOL_ID, signerAddress, to, req);

  
}

export async function swapDaiForBbaUsd(
    balancerVault: AMO__IBalancerVault,
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
    balancerVault: AMO__IBalancerVault,
    balancerHelpers: IBalancerHelpers,
    bbaUsdToken: IERC20,
    templeToken: TempleERC20Token,
    signer: Signer,
    from: string,
    to: string,
    amountIn: BigNumber
) {
    const reqData = await getJoinPoolRequest(balancerVault, balancerHelpers, from, to, [amountIn, amountIn]);
    const bptOut = reqData.bptOut;
    const req = reqData.joinPoolRequest;

    //await amo.addLiquidity(req, bptOut);
    await bbaUsdToken.connect(signer).approve(balancerVault.address, amountIn);
    await templeToken.connect(signer).approve(balancerVault.address, amountIn);
    await balancerVault.connect(signer).joinPool(BALANCER_POOL_ID, await signer.getAddress(), to, req);
}

export async function getJoinPoolRequest(
    balancerVault: AMO__IBalancerVault,
    balancerHelpers: IBalancerHelpers,
    from: string,
    to: string,
    maxAmountsIn: BigNumber[]
) {
    let tokens: string[];
    let balances: BigNumber[];
    [tokens, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    const userData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]", "uint256"], [1, maxAmountsIn, 1]);
    let joinPoolRequest = {
        assets: tokens,
        maxAmountsIn,
        userData,
        fromInternalBalance: false
    }
    let bptOut: BigNumber;
    let amountsIn: BigNumber[];
    [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, from, to, joinPoolRequest);
    joinPoolRequest.maxAmountsIn = amountsIn;
    return {
        joinPoolRequest,
        bptOut
    };
}

export async function getSpotPriceScaled(
    balancerVault: AMO__IBalancerVault,
    weightedPool2Tokens: IWeightPool2Tokens
) {
    let balances: BigNumber[];
    const precision = BigNumber.from(10_000);
    [, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    const normWeights = await weightedPool2Tokens.getNormalizedWeights();
    // multiply by precision to avoid rounding down
    const currentSpotPrice = precision.mul(balances[1]).div(normWeights[1]).div(balances[0].div(normWeights[0]));
    return currentSpotPrice;
}

export async function singleSideDepositStableToPriceTarget(
    balancerVault: AMO__IBalancerVault,
    balancerHelpers: IBalancerHelpers,
    bbaUsdWhale: Signer,
    stableToken: ERC20,
    templeIndexInPool: number,
    priceTarget: number // scaled
) {
    const whaleAddress = await bbaUsdWhale.getAddress();
    const stableIndexInPool = templeIndexInPool== 0 ? 1 : 0;
    let assets: string[];
    let balances: BigNumber[];
    [assets, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);

    const bdDivQuoteWithFee = balances[templeIndexInPool].mul(1_000).mul(10_000).div(BigNumber.from(priceTarget).mul(995));
    let stableLotSize = balances[stableIndexInPool].sub(bdDivQuoteWithFee);
    if (stableLotSize.lt(0)) {
        stableLotSize = stableLotSize.mul(-1);
    }

    // query join pool
    let bptOut: BigNumber;
    let amountsIn: BigNumber[] = [BigNumber.from(0), stableLotSize];
    let userdata = ethers.utils.defaultAbiCoder.encode(["uint256","uint256[]","uint256"], [1, amountsIn, 1]);
    let req = {
        assets: assets,
        maxAmountsIn: amountsIn,
        userData: userdata,
        fromInternalBalance: false
    };

    [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, whaleAddress, whaleAddress, req);
    userdata = ethers.utils.defaultAbiCoder.encode(["uint256","uint256[]","uint256"], [1, amountsIn, bptOut]);
    const request = {
        assets: assets,
        maxAmountsIn: amountsIn,
        userData: userdata,
        fromInternalBalance: false
    }
    await stableToken.connect(bbaUsdWhale).approve(balancerVault.address, stableLotSize);
    await balancerVault.connect(bbaUsdWhale).joinPool(BALANCER_POOL_ID, whaleAddress, whaleAddress, request);
}

export async function singleSideDepositTempleToPriceTarget(
    balancerVault: AMO__IBalancerVault,
    balancerHelpers: IBalancerHelpers,
    templeWhale: Signer,
    currentPriceScaled: BigNumber,
    templeIndexInPool: number,
    templeToken: TempleERC20Token,
    bbaUsdToken: ERC20,
    priceTarget: number // scaled
) {
    // calculate lot size for stable tokens
    let balances: BigNumber[];
    [,balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    const stableIndexInPool = templeIndexInPool== 0 ? 1 : 0;
    // a ratio for stable balances against price quote with fees
    const bdDivQuoteWithFee = balances[stableIndexInPool].mul(1_000).mul(10_000).div(BigNumber.from(priceTarget).mul(995));
    let templeLotSize = balances[templeIndexInPool].sub(bdDivQuoteWithFee);
    if (templeLotSize.lt(0)) {
        templeLotSize = templeLotSize.mul(-1);
    }
    // query join pool with expected temple amounts
    const whaleAddress = await templeWhale.getAddress();
    let bptOut: BigNumber;
    let amountsIn: BigNumber[] = [templeLotSize, BigNumber.from(0)];
    const assets = [TEMPLE, bbaUsdToken.address]
    let userdata = ethers.utils.defaultAbiCoder.encode(["uint256","uint256[]","uint256"], [1, amountsIn, 1]);
    let req = {
        assets: assets,
        maxAmountsIn: amountsIn,
        userData: userdata,
        fromInternalBalance: false
    };
    [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, whaleAddress, whaleAddress, req);
    userdata = ethers.utils.defaultAbiCoder.encode(["uint256","uint256[]","uint256"], [1, amountsIn, bptOut]);
    const request = {
        assets: assets,
        maxAmountsIn: amountsIn,
        userData: userdata,
        fromInternalBalance: false
    }
    await templeToken.connect(templeWhale).approve(balancerVault.address, amountsIn[0]);
    await balancerVault.connect(templeWhale).joinPool(BALANCER_POOL_ID, whaleAddress, whaleAddress, request);
}