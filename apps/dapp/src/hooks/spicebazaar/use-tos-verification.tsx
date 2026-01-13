/**
 * Hook to verify if a wallet has signed the Spice Bazaar Terms of Service
 */
import {
  getSpiceBazaarTosStorageKey,
  isSpiceBazaarTosSignatureValid,
} from 'utils/spiceBazaarTos';

export const useTOSVerification = () => {
  /**
   * Checks if the given wallet address has a valid TOS signature
   * @param walletAddress - The wallet address to check (will be lowercased)
   * @returns true if TOS is signed and valid for this wallet, false otherwise
   */
  const isTOSSigned = (walletAddress: string | undefined): boolean => {
    if (!walletAddress) return false;

    const normalizedWallet = walletAddress.toLowerCase();
    const tosData =
      window.localStorage[getSpiceBazaarTosStorageKey(normalizedWallet)];

    if (!tosData) return false;

    try {
      const parsed = JSON.parse(tosData);
      // Verify the stored wallet matches current wallet
      const storedWallet =
        typeof parsed.walletAddress === 'string' ? parsed.walletAddress : '';

      if (!storedWallet || storedWallet.toLowerCase() !== normalizedWallet) {
        return false;
      }

      if (!parsed.signature || !parsed.timestamp) {
        return false;
      }

      return (
        isSpiceBazaarTosSignatureValid(
          storedWallet,
          parsed.timestamp,
          parsed.signature
        ) ||
        isSpiceBazaarTosSignatureValid(
          walletAddress,
          parsed.timestamp,
          parsed.signature
        )
      );
    } catch {
      // Invalid data, treat as not signed
      return false;
    }
  };

  return { isTOSSigned };
};
