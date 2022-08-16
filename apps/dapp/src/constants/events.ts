enum Ascend {
  Swap = 'ascend.swap',
}

enum Vault {
  Deposit = 'vault.deposit',
  Claim = 'vault.claim',
}

enum Trade {
  Buy = 'trade.buy',
  Sell = 'trade.sell',
}

export const AnalyticsEvent = {
  Ascend,
  Vault,
  Trade,
};
