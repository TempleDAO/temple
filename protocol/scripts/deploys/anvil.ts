import { Wallet } from "ethers";

export const ANVIL_SIGNER_PRIVATE_KEYS = [
  // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
];

export function anvilSignerIndex(address: string): number | undefined {
  for (const [i, pk] of ANVIL_SIGNER_PRIVATE_KEYS.entries()) {
    const wallet = new Wallet(pk);
    if (address.toLowerCase() === wallet.address.toLowerCase()) {
      return i;
    }
  }
  return undefined;
}