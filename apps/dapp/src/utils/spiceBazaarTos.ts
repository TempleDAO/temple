import { ethers } from 'ethers';

export const SPICE_BAZAAR_TOS_URL =
  'https://templedao.link/spice-bazaar-disclaimer';

// EIP-1271 magic value: bytes4(keccak256("isValidSignature(bytes32,bytes)"))
const EIP1271_MAGIC_VALUE = '0x1626ba7e';

export const getSpiceBazaarTosStorageKey = (walletAddress: string) =>
  `templedao.spicebazaar.tos.${walletAddress.toLowerCase()}`;

export const buildSpiceBazaarTosMessage = (
  walletAddress: string,
  timestamp: string
) =>
  `I agree to the Spice Bazaar Terms & Conditions at:\n\n${SPICE_BAZAAR_TOS_URL}\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;

/**
 * Validates signature for EOA wallets using ecrecover.
 * Returns true if the recovered address matches the wallet address.
 */
export const isSpiceBazaarTosSignatureValid = (
  walletAddress: string,
  timestamp: string,
  signature: string
): boolean => {
  try {
    const message = buildSpiceBazaarTosMessage(walletAddress, timestamp);
    const recovered = ethers.utils.verifyMessage(message, signature);
    return recovered.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
};

/**
 * Validates signature using EIP-1271 for smart contract wallets (e.g., multisigs).
 * Calls isValidSignature on the contract to verify the signature.
 */
const isEIP1271SignatureValid = async (
  walletAddress: string,
  messageHash: string,
  signature: string,
  provider: ethers.providers.Provider
): Promise<boolean> => {
  try {
    const eip1271Abi = [
      'function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)',
    ];
    const contract = new ethers.Contract(walletAddress, eip1271Abi, provider);
    const result = await contract.isValidSignature(messageHash, signature);
    return result === EIP1271_MAGIC_VALUE;
  } catch {
    return false;
  }
};

/**
 * Async signature validation that supports both EOA and smart contract wallets.
 * For EOA wallets, uses standard ecrecover.
 * For smart contract wallets (multisigs), uses EIP-1271 isValidSignature.
 */
export const isSpiceBazaarTosSignatureValidAsync = async (
  walletAddress: string,
  timestamp: string,
  signature: string,
  provider: ethers.providers.Provider
): Promise<{ isValid: boolean; isContractWallet: boolean }> => {
  // First try EOA validation (standard ecrecover)
  if (isSpiceBazaarTosSignatureValid(walletAddress, timestamp, signature)) {
    return { isValid: true, isContractWallet: false };
  }

  // Check if the wallet is a smart contract
  const code = await provider.getCode(walletAddress);
  const isContract = code !== '0x';

  if (!isContract) {
    // Not a contract, and EOA validation failed
    return { isValid: false, isContractWallet: false };
  }

  // Try EIP-1271 validation for smart contract wallets
  const message = buildSpiceBazaarTosMessage(walletAddress, timestamp);
  const messageHash = ethers.utils.hashMessage(message);
  const isValid = await isEIP1271SignatureValid(
    walletAddress,
    messageHash,
    signature,
    provider
  );

  return { isValid, isContractWallet: true };
};
