import { ethers, network } from "hardhat";
import { BaseContract, BigNumber, BigNumberish, Contract, Signer } from "ethers";
import { assert, expect } from "chai";
import { ITempleElevatedAccess, TempleERC20Token, TempleERC20Token__factory } from "../typechain";
import { impersonateAccount, time as timeHelpers } from "@nomicfoundation/hardhat-network-helpers";

export const NULL_ADDR = "0x0000000000000000000000000000000000000000"

export async function resetFork(
  blockNumber: number, 
  rpcUrl: string | undefined = process.env.TESTS_MAINNET_RPC_URL
) {
  console.log("Forking Mainnet:", blockNumber, rpcUrl);
  await network.provider.request({
    method: "hardhat_reset",
    params: [
        {
        forking: {
            jsonRpcUrl: rpcUrl,
            blockNumber,
        },
    },
    ],
  });
}

// Impersonate an address and run fn(signer), then stop impersonating.
export async function impersonateSigner(address: string): Promise<Signer> {
  await impersonateAccount(address);
  return await ethers.getSigner(address);
}

export async function setExplicitAccess(contract: Contract, allowedCaller: string, fnNames: string[], value: boolean) {
    const access: ITempleElevatedAccess.ExplicitAccessStruct[] = fnNames.map(fn => {
        return {
            fnSelector: contract.interface.getSighash(contract.interface.getFunction(fn)),
            allowed: value
        }
    });
    await contract.setExplicitAccess(allowedCaller, access);
}

/// deprecated, use pattern
/// await expect(/* transaction promise */)
///     .to.be.revertedWith("Error msg");
export async function shouldThrow(p: Promise<any>, matches: RegExp) {
  try {
    await p;
  } catch(e) {
    expect(() => { throw e } ).throws(matches);
    return
  }

  expect.fail("Expected error matching: " + matches.source + " none thrown");
}

export interface ERC20Light {
  balanceOf: (account: string) => Promise<BigNumber>
  address: string
  name: () => Promise<string>
}

export async function expectBalancesChangeBy(
  tx: () => Promise<any>, 
  ...changes: [ERC20Light, Signer|BaseContract, BigNumberish][]
): Promise<void> {
  const oldBalances: BigNumber[] = await getBalances(changes);
  await tx();
  const newBalances: BigNumber[] = await getBalances(changes);

  for (let i = 0; i < changes.length; i++) {
    const [token, account, delta] = changes[i];
    const address = await getAddressOf(account);
    const expectedChange = BigNumber.from(delta);
    const actualChange = newBalances[i].sub(oldBalances[i]);
    assert(expectedChange.eq(actualChange),
      `Expected "${address}" on token '${await token.name()}' to change balance by ${fromAtto(expectedChange)}, ` +
        `but it has changed by ${fromAtto(actualChange)}`)
  }
}

async function getBalances(changes: [ERC20Light, Signer|BaseContract, BigNumberish][]) {
  const balances: BigNumber[] = [];

  for (const [token, account, ] of changes) {
    balances.push(await token.balanceOf(await getAddressOf(account)))
  }

  return balances;
}

async function getAddressOf(account: Signer|BaseContract) {
  if (account instanceof Signer) {
    return await account.getAddress();
  } else {
    return account.address;
  }
}

/**
 * Current block timestamp
 */
export const blockTimestamp = async (): Promise<number> => {
  return await timeHelpers.latest();
}

/**
 * Mine to a specific block timestamp
 */
export const mineToTimestamp = async (timestamp: number) => {
  const currentTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
  if (timestamp < currentTimestamp) {
    throw new Error("Cannot mine a timestamp in the past");
  }
  await mineForwardSeconds(timestamp - currentTimestamp);
}

/**
 * Mine forward the given number of seconds
 */
export const mineForwardSeconds = async (seconds: number) => {
  await timeHelpers.increase(seconds);
}

/**
 * Helper to always mine up to a given epoch (failing if we have passed it already)
 */
export const mineToEpoch = async (startTimestamp: number, epochSizeSecond: number, epochNumber: number) => {
  const currentTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
  const currentEpoch = Math.floor(((currentTimestamp - startTimestamp) / epochSizeSecond));
  if (epochNumber < currentEpoch) {
    throw new Error(`Cannot mine to epoch ${epochNumber}, it's in the past`);
  }

  const nextEpochStartTime = startTimestamp + (epochNumber * epochSizeSecond) + 1;
  await mineToTimestamp(nextEpochStartTime);
}

export function toAtto(n: number): BigNumber {
  return ethers.utils.parseEther(n.toString());
}

export function fromAtto(n: BigNumber): number {
  return Number.parseFloat(ethers.utils.formatUnits(n, 18));
}

export function fromFixedPoint112x112(n: BigNumber): number {

  // Get last 112 bit of number (n & ((1 << 112) - 1))
  const numToBin = Number.parseInt(n.and(BigNumber.from(1).shl(112).sub(1)).toString(), 10);
  const bin = numToBin.toString(2).padStart(112, "0");
  let fractionalPart = 0;
  for (let i = 0; i < bin.length; i++) {
     const bit =  parseInt(bin[i]);
     fractionalPart += (bit) * (2 ** (-1 * (i + 1)));
  }
  return Number.parseFloat(n.shr(112).toString()) + fractionalPart;
}

export async function deployAndAirdropTemple(
  owner: Signer,
  airdropRecipients: Signer[],
  airdropAmount: BigNumberish
  ): Promise<TempleERC20Token> {
  const templeToken = await new TempleERC20Token__factory(owner).deploy()

  await templeToken.addMinter(await owner.getAddress());
  for (const u of airdropRecipients) {
    await templeToken.mint(await u.getAddress(), airdropAmount)
  }

  return templeToken;
}