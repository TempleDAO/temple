interface IAnalytics {
  treasuryValue: number;
  circulatingMarketCap: number;
  fullyDilutedValuation: number;
  circulatingTempleSupply: number;
  fullyDilutedTempleSupply: number;
  discordUsers: number;
  twitterFollowers: number;
  enclaveMembers: {
    chaos: number;
    logic: number;
    structure: number;
    mystery: number;
    order: number;
  };
}

export const useAnalytics = () => {};
