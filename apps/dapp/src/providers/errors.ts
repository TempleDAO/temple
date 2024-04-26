export class NoWalletAddressError extends Error {
  constructor() {
    super('Programming Error: There must be a wallet address');

    this.name = 'NoWalletAddressError';
  }
}
