import { ethers } from 'ethers';
import {
  ERC20,
  ERC20__factory,
  TreasuryIV,
  TreasuryIV__factory,
  TempleStaking,
  TempleStaking__factory,
  OGTemple,
  OGTemple__factory,
} from 'types/typechain';
import frax3crv_fABI from 'data/abis/frax3crv-f.json';
import frax3crv_fRewardsABI from 'data/abis/frax3crv-fRewardPool.json';
import { fromAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';
import { fetchSubgraph } from 'utils/subgraph';
import { Nullable } from 'types/util';
import axios from 'axios';
import env from 'constants/env';
import { useConnectWallet } from '@web3-onboard/react';
import { useWallet } from 'providers/WalletProvider';

export interface ProtocolMetrics {
  templeValue: number;
  circulatingSupply: number;
  riskFreeValue: number;
}

export interface TreasuryMetrics {
  treasuryValue: number;
  templeApy: number;
  templeValue: number;
  dynamicVaultApy?: number;
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
  ogTempleTotalSupply: number;
  circMCap: number;
  circTempleSupply: number;
  socialMetrics: SocialMetrics;
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

// Temple MintMultiple is fixed tp 6
const MINT_MULTIPLE = 6.0;

/**
 * Service to get the Temple Metrics
 */
export class MetricsService {
  private signer: ethers.Signer;
  private stableCoinContract: ERC20;
  private templeCoinContract: ERC20;
  private ogTempleCoinContract: OGTemple;
  private frax3crv_fCoinContract;
  private frax3crv_fRewardsContract;
  private treasuryContract: TreasuryIV;
  private templeStakingContract: TempleStaking;
  private treasuryAddress: string;
  private treasuryAddresses: string[];
  private farmingWalletAddress: string;

  constructor() {
    // TODO: This file was changed because of the wagmi replacement
    // We can probably remove the file entirely if we don't need it anymore
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { signer } = useWallet();
    if (!signer) {
      throw new Error('No signer. Unable to initialize MetricsService');
    }

    this.signer = signer;

    this.stableCoinContract = ERC20__factory.connect(
      env.contracts.frax,
      this.signer
    );

    this.templeCoinContract = ERC20__factory.connect(
      env.contracts.temple,
      this.signer
    );

    this.frax3crv_fCoinContract =
      env.contracts.frax3CrvFarming &&
      new ethers.Contract(
        env.contracts.frax3CrvFarming,
        frax3crv_fABI,
        this.signer
      );

    this.frax3crv_fRewardsContract =
      env.contracts.frax3CrvFarmingRewards &&
      new ethers.Contract(
        env.contracts.frax3CrvFarmingRewards,
        frax3crv_fRewardsABI,
        this.signer
      );

    this.treasuryAddress = env.contracts.treasuryIv;
    this.treasuryAddresses = [
      env.contracts.treasuryIv,
      env.contracts.templeV2Router,
      env.contracts.templeV2FraxPair,
      env.contracts.farmingWallet,
    ];

    this.farmingWalletAddress = env.contracts.farmingWallet;

    this.treasuryContract = TreasuryIV__factory.connect(
      env.contracts.treasuryIv,
      this.signer
    );

    this.templeStakingContract = TempleStaking__factory.connect(
      env.contracts.templeStaking,
      this.signer
    );

    this.ogTempleCoinContract = OGTemple__factory.connect(
      env.contracts.ogTemple,
      this.signer
    );
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
    this.ogTempleCoinContract = new OGTemple__factory().attach(
      await this.templeStakingContract.OG_TEMPLE()
    );

    const treasuryValue = await this.getTreasuryValue();
    const treasuryTempleValue = fromAtto(
      await this.templeCoinContract.balanceOf(this.treasuryAddress)
    );
    const templeTotalSupply = fromAtto(
      await this.templeCoinContract.totalSupply()
    );
    const ogTempleTotalSupply = fromAtto(
      await this.ogTempleCoinContract.totalSupply()
    );

    const stakingContractApy = await this.templeStakingContract.getEpy(
      10000000
    );

    const epy = Number(stakingContractApy) / 10000000;

    const { templeValue, circulatingSupply, riskFreeValue } =
      await this.getProtocolMetrics();

    const ogTempleRatio =
      Number(await this.templeStakingContract.balance(1000)) / 1000;

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
      percentageStaked:
        (ogTempleTotalSupply * ogTempleRatio) / circulatingSupply,
      ogTemplePrice: templeValue * ogTempleRatio,
      ogTempleTotalSupply,
      ogTempleRatio,
      riskFreeValue,
    };
  }

  async getAccountMetrics(walletAddress: string): Promise<AccountMetrics> {
    const { templeValue } = await this.getProtocolMetrics();
    const currentTime = Date.now();

    const templeBalance = fromAtto(
      await this.templeCoinContract.balanceOf(walletAddress)
    );

    const ogTempleRatio =
      Number(await this.templeStakingContract.balance(1000)) / 1000;

    const { stakes, unstakes } = await this.getStakedOGTempleTransactions(
      walletAddress
    );

    const totalSacrificed = stakes.reduce(
      (prev: any, current: any) => prev + parseFloat(current?.stableAmount),
      0
    );

    const lockedOGTempleBalance = stakes.reduce(
      (prev: any, current: any) =>
        prev +
        (current.lockedUntil * 1000 > currentTime
          ? parseFloat(current?.ogAmount)
          : 0),
      0
    );

    const OGTempleBalanceStaked = stakes.reduce(
      (prev: any, current: any) =>
        prev +
        (current.lockedUntil * 1000 < currentTime
          ? parseFloat(current?.ogAmount)
          : 0),
      0
    );

    const OGTempleBalanceUnstaked = unstakes.reduce(
      (prev: any, current: any) => prev + parseFloat(current?.ogAmount),
      0
    );

    const unClaimedOGTempleBalance =
      OGTempleBalanceStaked - OGTempleBalanceUnstaked;

    const epy =
      Number(await this.templeStakingContract.getEpy(10000000)) / 10000000;

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
      treasuryValue += fromAtto(
        await this.stableCoinContract.balanceOf(address)
      );
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
   * Helper to calculate the APY
   */
  private getTempleApy = async (epy?: any): Promise<number> => {
    if (!epy)
      epy =
        (await this.templeStakingContract.getEpy(10000000)).toNumber() /
        10000000;
    return Math.trunc((Math.pow(epy + 1, 365.25) - 1) * 100);
  };

  /**
   * Helper to get the stake transactions
   */
  private getStakedOGTempleTransactions = async (walletAddress: string) => {
    try {
      const response = await fetchSubgraph<any>(
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
    const response = await fetchSubgraph<any>(
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
