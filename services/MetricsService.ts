import { AlchemyProvider } from '@ethersproject/providers';
import { ethers, Wallet } from 'ethers';
import { ERC20, ERC20__factory, TempleTreasury, TempleTreasury__factory } from '../types/typechain';
import { fromAtto } from '../utils/bigNumber';
import { formatNumber } from '../utils/formatter';


export interface TreasuryMetrics {
  treasuryValue: number;
  templeApy: number;
  templeValue: number;
}

// Temple MintMultiple is fixed tp 6
const MINT_MULTIPLE = 6.0;
// Temple EPY is now fixed to 1%
const TEMPLE_EPY=  1 / 100;

/**
 * Service to get the Temple Metrics
 */
export class MetricsService {
  private readonly alchemyProvider: AlchemyProvider;
  private readonly signer: Wallet;
  private stableCoinContract: ERC20;
  private treasuryContract: TempleTreasury;
  private readonly treasuryAddress: string;

  constructor() {
    if (process.env.ALCHEMY_PROVIDER_NETWORK === undefined
        || process.env.ALCHEMY_API_KEY === undefined
        || process.env.NEXT_PUBLIC_TREASURY_ADDRESS === undefined
        || process.env.SERVER_PRIVATE_KEY === undefined
        || process.env.NEXT_PUBLIC_STABLE_COIN_ADDRESS === undefined
    ) {
      throw new Error(`Missing env vars in Metrics Service`);
    }

    const STABLE_COIN_ADDRESS = process.env.NEXT_PUBLIC_STABLE_COIN_ADDRESS;
    const ALCHEMY_PROVIDER_NETWORK = process.env.ALCHEMY_PROVIDER_NETWORK;
    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
    const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
    const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;

    this.alchemyProvider = new ethers.providers.AlchemyProvider(ALCHEMY_PROVIDER_NETWORK, ALCHEMY_API_KEY);

    this.signer = new ethers.Wallet(SERVER_PRIVATE_KEY, this.alchemyProvider);

    this.stableCoinContract = new ERC20__factory()
        .attach(STABLE_COIN_ADDRESS)
        .connect(this.signer);
    this.treasuryAddress = TREASURY_ADDRESS;
    this.treasuryContract = new TempleTreasury__factory()
        .attach(TREASURY_ADDRESS)
        .connect(this.signer);
  }

  /**
   * Gets Temple Treasury Metrics
   */
  async getTreasuryMetrics(): Promise<TreasuryMetrics> {
    const treasuryValue = fromAtto((await this.stableCoinContract.balanceOf(this.treasuryAddress)));

    return {
      treasuryValue,
      templeApy: this.getTempleApy(),
      templeValue: await this.getTempleValue(),
    };
  }

  /**
   * Helper to get the Temple Value
   */
  private getTempleValue = async (): Promise<number> => {
      const iv = await this.treasuryContract.intrinsicValueRatio();
      const { temple, stablec } = iv;
      const rate = (fromAtto(temple) / fromAtto(stablec)) / MINT_MULTIPLE;
      return formatNumber(1 / rate);
  };

  /**
   * Helper to calculate the APY
   */
  private getTempleApy = (): number => {
    return Math.trunc((Math.pow(TEMPLE_EPY + 1, 365.25) - 1) * 100)
  }
}
