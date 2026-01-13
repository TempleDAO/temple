import { ethers } from 'ethers';

export const SPICE_BAZAAR_TOS_URL =
  'https://templedao.link/spice-bazaar-disclaimer';

export const getSpiceBazaarTosStorageKey = (walletAddress: string) =>
  `templedao.spicebazaar.tos.${walletAddress.toLowerCase()}`;

export const buildSpiceBazaarTosMessage = (
  walletAddress: string,
  timestamp: string
) =>
  `I agree to the Spice Bazaar Terms & Conditions at:\n\n${SPICE_BAZAAR_TOS_URL}\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;

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
