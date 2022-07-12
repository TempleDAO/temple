import { ethers, Wallet } from 'ethers';
import {
  ERC20,
  ERC20__factory,
  TempleTreasury,
  TempleTreasury__factory,
  TempleStaking,
  TempleStaking__factory,
  OGTemple,
  OGTemple__factory,
} from 'types/typechain';
import frax3crv_fABI from 'data/abis/frax3crv-f';
import frax3crv_fRewardsABI from 'data/abis/frax3crv-fRewardPool';
import { fromAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';
import { fetchSubgraph } from 'utils/subgraph';
import { Nullable } from 'types/util';
import { isDevelopmentEnv } from 'utils/helpers';
import axios from 'axios';
import env from 'constants/env';

export interface ProtocolMetrics {
  templeValue: number;
  circulatingSupply: number;
  riskFreeValue: number;
}

export interface TreasuryMetrics {
  treasuryValue: number;
  templeApy: number;
  templeValue: number;
  dynamicVaultApy: number;
}

export interface DashboardMetrics {
  treasuryValue: number;
  treasuryTempleValue: number;
  templeTotalSupply: number;
  templeEpy: number;
  templeApy: number;
  templeValue: number;
  ogTemplePrice: number;
  ogTempleRatio: number;
  iv: number;
  circMCap: number;
  circTempleSupply: number;
  socialMetrics: SocialMetrics;
  templeRFV: number;
  riskFreeValue: number;
  percentageStaked: number;
}

export interface AccountMetrics {
  templeBalance: number;
  templeValue: number;
  ogTemplePrice: number;
  ogTempleRatio: number;
  lockedOGTempleBalance: number;
  unClaimedOGTempleBalance: number;
  totalSacrificed: number;
  templeApy: number;
}

interface DiscordResponse {
  disciples: string;
  enclaveChaos: string;
  enclaveLogic: string;
  enclaveMystery: string;
  enclaveOrder: string;
  enclaveStructure: string;
  initiates: string;
  masters: string;
  totalMembers: string;
  unverified: string;
  verified: string;
}

export interface SocialMetrics {
  twitter_followers_count: Nullable<string>;
  discord: Nullable<DiscordResponse>;
}

const ENV_VARS = import.meta.env;

// Temple MintMultiple is fixed tp 6
const MINT_MULTIPLE = 6.0;

/**
 * Service to get the Temple Metrics
 */
export class MetricsService {
  private readonly signer: Wallet;
  private stableCoinContract: ERC20;
  private templeCoinContract: ERC20;
  private ogTempleCoinContract: OGTemple;
  //no type since this is a Vyper contract and we have no typechain type def for it atm
  private frax3crv_fCoinContract;
  //TODO: add this contract to protocol repo and get typechain type def as opposed to ABI
  private frax3crv_fRewardsContract;
  private treasuryContract: TempleTreasury;
  private templeStakingContract: TempleStaking;
  private readonly treasuryAddress: string;
  private provider;
  private farmingWalletAddress: string;

  constructor() {
    //TODO: remove comments when we can have CVX contract addresses on rinkeby + locally
    if (
      ENV_VARS.VITE_SERVER_PRIVATE_KEY === undefined
      /*||
      ENV_VARS.VITE_PUBLIC_FRAX3CRV_F_ADDRESS === undefined ||
      ENV_VARS.VITE_PUBLIC_FRAX3CRV_F_REWARDS_ADDRESS*/
    ) {
      console.info(`
      VITE_SERVER_PRIVATE_KEY=${ENV_VARS.VITE_SERVER_PRIVATE_KEY}
      VITE_PUBLIC_FRAX3CRV_F_ADDRESS=${ENV_VARS.VITE_PUBLIC_FRAX3CRV_F_ADDRESS}
      VITE_PUBLIC_FRAX3CRV_F_REWARDS_ADDRESS=${ENV_VARS.VITE_PUBLIC_FRAX3CRV_F_REWARDS_ADDRESS}
      `);
      //throw new Error(`Missing env vars in Metrics Service`);
    }

    const ALCHEMY_PROVIDER_NETWORK = ENV_VARS.VITE_ALCHEMY_PROVIDER_NETWORK;
    const SERVER_PRIVATE_KEY = ENV_VARS.VITE_SERVER_PRIVATE_KEY;
    const FRAX3CRV_F_ADDRESS = ENV_VARS.VITE_PUBLIC_FRAX3CRV_F_ADDRESS;
    const FRAX3CRV_F_REWARDS_ADDRESS = ENV_VARS.VITE_PUBLIC_FRAX3CRV_F_REWARDS_ADDRESS;
    const FARMING_WALLET_ADDRESS = ENV_VARS.VITE_PUBLIC_FARMING_WALLET_ADDRESS;

    this.provider = isDevelopmentEnv()
      ? new ethers.providers.Web3Provider(window.ethereum)
      : new ethers.providers.AlchemyProvider(ALCHEMY_PROVIDER_NETWORK, env.alchemyId);

    this.signer = new ethers.Wallet(SERVER_PRIVATE_KEY, this.provider);

    this.stableCoinContract = new ERC20__factory(this.signer).attach(env.contracts.frax);

    this.templeCoinContract = new ERC20__factory(this.signer).attach(env.contracts.temple);

    this.frax3crv_fCoinContract =
      FRAX3CRV_F_ADDRESS && new ethers.Contract(FRAX3CRV_F_ADDRESS, frax3crv_fABI, this.signer);

    this.frax3crv_fRewardsContract =
      FRAX3CRV_F_REWARDS_ADDRESS && new ethers.Contract(FRAX3CRV_F_REWARDS_ADDRESS, frax3crv_fRewardsABI, this.signer);

    this.treasuryAddress = env.contracts.treasuryIv;
    this.treasuryAddresses = [
      env.contracts.treasuryIv,
      AMM_OPS_ADDRESS,
      env.contracts.templeV2Router,
      env.contracts.templeV2FraxPair,
      FARMING_WALLET_ADDRESS,
    ];

    this.farmingWalletAddress = FARMING_WALLET_ADDRESS;

    this.treasuryContract = new TempleTreasury__factory(this.signer).attach(env.contracts.treasuryIv);

    this.templeStakingContract = new TempleStaking__factory(this.signer).attach(env.contracts.templeStaking);
  }

  /**
   * Gets Temple Treasury Metrics
   */
  async getTreasuryMetrics(): Promise<TreasuryMetrics> {
    const [treasuryValue, { templeValue }, templeApy] = await Promise.all([
      this.getTreasuryValue(),
      this.getProtocolMetrics(),
      this.getTempleApy(),
    ]);

    return {
      treasuryValue,
      templeApy,
      templeValue,
    };
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    this.ogTempleCoinContract = new OGTemple__factory(this.signer).attach(await this.templeStakingContract.OG_TEMPLE());

    const treasuryValue = await this.getTreasuryValue();
    const treasuryTempleValue = fromAtto(await this.templeCoinContract.balanceOf(this.treasuryAddress));
    const templeTotalSupply = fromAtto(await this.templeCoinContract.totalSupply());
    const ogTempleTotalSupply = fromAtto(await this.ogTempleCoinContract.totalSupply());

    const stakingContractApy = await this.templeStakingContract.getEpy(10000000);

    const epy = Number(stakingContractApy) / 10000000;

    const { templeValue, circulatingSupply, riskFreeValue } = await this.getProtocolMetrics();
    const iv = await this.getIV();

    const ogTempleRatio = Number(await this.templeStakingContract.balance(1000)) / 1000;

    const socialMetrics = await this.getSocialMetrics();

    return {
      socialMetrics,
      treasuryValue,
      treasuryTempleValue,
      templeTotalSupply,
      templeEpy: epy * 100,
      templeApy: await this.getTempleApy(epy),
      templeValue,
      circTempleSupply: circulatingSupply,
      circMCap: circulatingSupply * templeValue,
      ogTempleTotalSupply,
      percentageStaked: (ogTempleTotalSupply * ogTempleRatio) / circulatingSupply,
      ogTemplePrice: templeValue * ogTempleRatio,
      ogTempleRatio,
      iv,
      riskFreeValue,
    };
  }

  async getAccountMetrics(walletAddress: string): Promise<AccountMetrics> {
    const { templeValue } = await this.getProtocolMetrics();
    const currentTime = Date.now();

    const templeBalance = fromAtto(await this.templeCoinContract.balanceOf(walletAddress));

    const ogTempleRatio = Number(await this.templeStakingContract.balance(1000)) / 1000;

    const { stakes, unstakes } = await this.getStakedOGTempleTransactions(walletAddress);

    const totalSacrificed = stakes.reduce((prev: any, current: any) => prev + parseFloat(current?.stableAmount), 0);

    const lockedOGTempleBalance = stakes.reduce(
      (prev: any, current: any) =>
        prev + (current.lockedUntil * 1000 > currentTime ? parseFloat(current?.ogAmount) : 0),
      0
    );

    const OGTempleBalanceStaked = stakes.reduce(
      (prev: any, current: any) =>
        prev + (current.lockedUntil * 1000 < currentTime ? parseFloat(current?.ogAmount) : 0),
      0
    );

    const OGTempleBalanceUnstaked = unstakes.reduce(
      (prev: any, current: any) => prev + parseFloat(current?.ogAmount),
      0
    );

    const unClaimedOGTempleBalance = OGTempleBalanceStaked - OGTempleBalanceUnstaked;

    const epy = Number(await this.templeStakingContract.getEpy(10000000)) / 10000000;

    return {
      templeBalance,
      templeValue,
      ogTemplePrice: templeValue * ogTempleRatio,
      ogTempleRatio,
      lockedOGTempleBalance,
      unClaimedOGTempleBalance,
      totalSacrificed,
      templeApy: await this.getTempleApy(epy),
    };
  }

  /**
   * Helper to get the Treasury value
   */
  private getTreasuryValue = async (): Promise<number> => {
    let treasuryValue = 0;
    for (const address of this.treasuryAddresses) {
      treasuryValue += fromAtto(await this.stableCoinContract.balanceOf(address));
    }

    if (this.frax3crv_fCoinContract && this.frax3crv_fRewardsContract) {
      const [frax3crv_f, virtualPrice] = await Promise.all([
        this.frax3crv_fRewardsContract.balanceOf(this.farmingWalletAddress),
        this.frax3crv_fCoinContract.get_virtual_price(),
      ]);

      treasuryValue += fromAtto(frax3crv_f) * fromAtto(virtualPrice);
    }

    return treasuryValue;
  };

  /**
   * Helper to get the Temple IV
   */
  private getIV = async (): Promise<number> => {
    const iv = await this.treasuryContract.intrinsicValueRatio();
    const { temple, stablec } = iv;
    const rate = fromAtto(stablec) / fromAtto(temple);
    return formatNumber(rate);
  };

  /**
   * Helper to calculate the APY
   */
  private getTempleApy = async (epy: any): Promise<number> => {
    if (!epy) epy = (await this.templeStakingContract.getEpy(10000000)).toNumber() / 10000000;
    return Math.trunc((Math.pow(epy + 1, 365.25) - 1) * 100);
  };

  /**
   * Helper to get the stake transactions
   */
  private getStakedOGTempleTransactions = async (walletAddress: string) => {
    try {
      const response = await fetchSubgraph(
        `{
        stakes(where: {templar: "${walletAddress.toLowerCase()}"}) {
          templar {
            id
          }
          amount
          ogAmount
          stableAmount
          mintedTemple
          bonusTemple
          lockedUntil
          transaction {
            id
          }
          timestamp
        }
        unstakes(where: {templar: "${walletAddress.toLowerCase()}"}) {
          templar {
            id
          }
          ogAmount
          transaction {
            id
          }
          timestamp
        }
      }`
      );
      return response?.data ?? { stakes: [], unstakes: [] };
    } catch (error) {
      console.info(error);
      return { stakes: [], unstakes: [] };
    }
  };

  private getProtocolMetrics = async (): Promise<ProtocolMetrics> => {
    const response = await fetchSubgraph(
      `{
        protocolMetrics(first: 1, orderBy: timestamp, orderDirection: desc) {
          templePrice
          templeCirculatingSupply
          riskFreeValue
        }
      }`
    );

    const data = response?.data?.protocolMetrics?.[0] || {};

    return {
      templeValue: parseFloat(data.templePrice),
      circulatingSupply: parseFloat(data.templeCirculatingSupply),
      riskFreeValue: parseFloat(data.riskFreeValue),
    };
  };

  private getSocialMetrics = async (): Promise<SocialMetrics> => {
    const twitter_response = await axios({
      url: `${env.backendUrl}/api/twitter/summary`,
    });
    const twitter_followers_count = twitter_response?.data?.followers_count;

    const response = await axios({
      url: `${env.backendUrl}/api/discord/members/summary`,
    });
    const discord_metrics = response?.data;

    return {
      twitter_followers_count,
      discord: discord_metrics,
    };
  };
}
