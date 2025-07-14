import { BigRational } from "@mountainpath9/big-rational";
import { VMap } from "./vmap";
import { binarySearchBy } from "./binsearch";
import { Address, getContract } from "viem";
import * as ERC20Metadata from "@/abi/IERC20Metadata";
import { PublicClient } from "@mountainpath9/overlord-viem";

export interface BaseApi {
    provider: PublicClient,
    getToken(address: string): Promise<Token>;
    getBlockNumberForTimestamp(timestamp: Date): Promise<number>;
}

export interface Token {
    address: string,
    symbol: string,
    decimals: bigint,
    brFromBi(v: bigint): BigRational;
    biFromBr(v: BigRational): bigint;
}

export async function createBaseApi(client: PublicClient): Promise<BaseApi> {
    const tokens = new VMap<string, Token>(s => s);
    const timestampBlocks = new VMap<Date, number>(d => d.toISOString());

    async function _getToken(address: Address): Promise<Token> {
        const erc20 = getContract({
            address: address,
            abi: ERC20Metadata.ABI,
            client: client,
        });
        const [symbol, decimals] = await Promise.all([erc20.read.symbol(), erc20.read.decimals()]);
        const decimalsBN = BigInt(decimals);
        return {
            address,
            symbol,
            decimals: decimalsBN,
            brFromBi: (v) => BigRational.fromBigIntWithDecimals(v, decimalsBN),
            biFromBr: (v) => v.toBigIntWithDecimals(decimalsBN),
        } 
    }

    async function _getBlockNumberForTimestamp(timestamp: Date): Promise<number> {
        const currentBlock = await client.getBlockNumber();
    
        async function cmpFn(blockNumber: number) {
          const t1 = await getBlockTimestamp(client, blockNumber);
          if (t1 === undefined) {
            throw new Error("cant get timestamp");
          }
          return t1 < timestamp ? 'LT' : t1 > timestamp ? 'GT' : 'EQ';
        }
        const loc = await binarySearchBy(cmpFn, 1, Number(currentBlock));
        return loc.result === 'found' ? loc.at : loc.at - 1;
      }
    
    async function getToken(address: Address): Promise<Token> {
        return tokens.getOrCreateAsync(address, () => _getToken(address));
    }
    
    async function getBlockNumberForTimestamp(timestamp: Date): Promise<number> {
        return timestampBlocks.getOrCreateAsync(timestamp, () => _getBlockNumberForTimestamp(timestamp));
    }
    
    return {
        provider: client,
        getToken,
        getBlockNumberForTimestamp,
    }
}

export interface StakingApi extends BaseApi {
    stakingToken: Token,
    rewardToken: Token,
    distributeReward(): Promise<Token> // todo change type
}

export async function getBlockTimestamp(client: PublicClient, blockNumber: number): Promise<Date> {
    const block = await client.getBlock({blockNumber: BigInt(blockNumber)});
    if (!block) {
      throw new Error(`Can't get block ${blockNumber}`);
    }
    const ts = Number(block.timestamp * 1000n);
    return new Date(ts);
}
