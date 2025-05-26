import {
  createContext,
  useContext,
  useState,
  PropsWithChildren,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { DaiGoldAuction, TempleGold, TempleGoldStaking } from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import env from 'constants/env';
import { fromAtto } from 'utils/bigNumber';
import { useNotification } from 'providers/NotificationProvider';
import { estimateAndMine } from 'utils/ethers';
import { getBigNumberFromString, getTokenInfo } from 'components/Vault/utils';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber } from 'ethers';
import { asyncNoop } from 'utils/helpers';
import { useApiManager } from 'hooks/use-api-manager';
import { useQuery } from '@tanstack/react-query';

import { getAppConfig } from 'constants/newenv';

const ENV = import.meta.env;

export type StakePageMetrics = {
  stakedTemple: number;
  circulatingSupply: number;
  totalEpochRewards: number;
  yourStake: number;
  yourRewards: number;
};

export type DaiGoldAuctionInfo = {
  currentEpoch: number;
  nextEpoch: number;
  currentEpochAuctionLive: boolean;
  auctionStartTime: number; // Date?
  auctionEndTime: number; // Date?
  totalBidTokenAmount: number;
  totalAuctionTokenAmount: number;
  priceRatio: number;
  auctionDuration: number;
  nextAuctionStartTimestamp: number | undefined; // Date?
};

interface SpiceBazaarContextValue {
  stakePageMetrics: {
    data: StakePageMetrics;
    loading: boolean;
    fetch: () => Promise<void>;
  };
  staking: {
    stakeTemple: (amount: string) => Promise<void>;
    unstakeTemple: (amount: string, claimRewards: boolean) => Promise<void>;
    claimRewards: () => Promise<void>;
    getUnstakeTime: () => Promise<number>;
  };
  daiGoldAuctionInfo: {
    data: DaiGoldAuctionInfo;
    loading: boolean;
    fetch: (silent?: boolean) => Promise<void>;
  };
  daiGoldAuctions: {
    bid: (amount: string) => Promise<void>;
    claim: (epoch: number) => Promise<void>;
  };
  currentUser: {
    data: {
      dailyVestedTgldReward: number;
      previousEpochRewards: number;
      currentEpochBidAmount: number;
    };
    loading: boolean;
    fetch: () => Promise<void>;
    getClaimableAtEpoch: (epochId: string) => Promise<number>;
  };
}

const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
const SEVEN_DAYS_IN_SECONDS = ONE_DAY_IN_SECONDS * 7;

const INITIAL_STATE: SpiceBazaarContextValue = {
  stakePageMetrics: {
    data: {
      stakedTemple: 0,
      circulatingSupply: 0,
      totalEpochRewards: 0,
      yourStake: 0,
      yourRewards: 0,
    },
    loading: false,
    fetch: asyncNoop,
  },
  staking: {
    stakeTemple: asyncNoop,
    unstakeTemple: asyncNoop,
    claimRewards: asyncNoop,
    getUnstakeTime: async () => 0,
  },
  daiGoldAuctionInfo: {
    data: {
      currentEpoch: 0,
      nextEpoch: 0,
      currentEpochAuctionLive: false,
      totalAuctionTokenAmount: 0,
      auctionStartTime: 0,
      auctionEndTime: 0,
      totalBidTokenAmount: 0,
      priceRatio: 0,
      auctionDuration: 0,
      nextAuctionStartTimestamp: undefined,
    },
    loading: false,
    fetch: asyncNoop,
  },
  daiGoldAuctions: {
    bid: asyncNoop,
    claim: asyncNoop,
  },
  currentUser: {
    data: {
      dailyVestedTgldReward: 0,
      previousEpochRewards: 0,
      currentEpochBidAmount: 0,
    },
    loading: false,
    fetch: asyncNoop,
    getClaimableAtEpoch: async () => 0,
  },
};

const SpiceBazaarContext =
  createContext<SpiceBazaarContextValue>(INITIAL_STATE);

export const SpiceBazaarProvider = ({ children }: PropsWithChildren) => {
  const {
    wallet,
    signer,
    ensureAllowanceWithSigner,
    updateBalance,
    getConnectedSigner,
    switchNetwork,
  } = useWallet();

  const { papi } = useApiManager();
  const { openNotification } = useNotification();

  const getChainId = () => {
    if (ENV.VITE_ENV === 'production') {
      return 1;
    } else if (ENV.VITE_ENV === 'preview') {
      return 11155111;
    } else {
      throw new Error('Invalid environment');
    }
  };

  const getStakedTemple = useCallback(async () => {
    try {
      const templeGoldStaking = (await papi.getContract(
        getAppConfig().contracts.templeGoldStaking
      )) as TempleGoldStaking;

      const totalSupply = await templeGoldStaking.totalSupply();
      return fromAtto(totalSupply);
    } catch (err) {
      console.error('Error while getting staked temple', {
        cause: err,
      });
      return 0;
    }
  }, [papi]);

  const getCirculatingSupply = useCallback(async () => {
    try {
      const templeGoldContract = (await papi.getContract(
        getAppConfig().contracts.templeGold
      )) as TempleGold;

      const circulatingSupply = await templeGoldContract.circulatingSupply();

      return fromAtto(circulatingSupply);
    } catch (err) {
      console.error('Error while getting circulating supply', {
        cause: err,
      });
      return 0;
    }
  }, [papi]);

  const getTotalEpochRewards = useCallback(async () => {
    const stakingContract = (await papi.getContract(
      getAppConfig().contracts.templeGoldStaking
    )) as TempleGoldStaking;

    const rewardData = await stakingContract.getRewardData();

    if (!rewardData) {
      return 0;
    }
    const rewardRate = rewardData.rewardRate;

    if (!rewardRate) {
      return 0;
    }

    const rewards = fromAtto(rewardRate) * SEVEN_DAYS_IN_SECONDS;

    return rewards;
  }, [papi]);

  const getYourStake = useCallback(async () => {
    if (!wallet) {
      return 0;
    }

    try {
      const templeGoldStakingContract = (await papi.getContract(
        getAppConfig().contracts.templeGoldStaking
      )) as TempleGoldStaking;

      const balance = await templeGoldStakingContract.balanceOf(wallet);
      return fromAtto(balance);
    } catch (error) {
      console.error('Error fetching stake balance:', error);
      return 0;
    }
  }, [wallet, papi]);

  const getYourRewards = useCallback(async () => {
    if (!wallet) {
      return 0;
    }

    try {
      const templeGoldStakingContract = (await papi.getContract(
        getAppConfig().contracts.templeGoldStaking
      )) as TempleGoldStaking;

      const reward = await templeGoldStakingContract.earned(wallet);
      return fromAtto(reward);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      return 0;
    }
  }, [wallet, papi]);

  const fetchMetrics = useCallback(async (): Promise<StakePageMetrics> => {
    const allMetrics = await Promise.allSettled([
      getStakedTemple(),
      getCirculatingSupply(),
      getTotalEpochRewards(),
      getYourStake(),
      getYourRewards(),
    ]);

    const metricValues = allMetrics.map((metric) =>
      metric.status === 'fulfilled' ? metric.value : 0
    );

    return {
      stakedTemple: metricValues[0],
      circulatingSupply: metricValues[1],
      totalEpochRewards: metricValues[2],
      yourStake: metricValues[3],
      yourRewards: metricValues[4],
    };
  }, [
    getStakedTemple,
    getCirculatingSupply,
    getTotalEpochRewards,
    getYourStake,
    getYourRewards,
  ]);

  const {
    data: stakePageMetricsData,
    isLoading: stakePageMetricsLoading,
    refetch: refetchStakePageMetrics,
  } = useQuery({
    queryKey: ['stakePageMetrics', wallet ? wallet : 'no-wallet'],
    queryFn: fetchMetrics,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    enabled: false, // automatic fetching disabled
  });

  useEffect(() => {
    refetchStakePageMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  const fetchStakePageMetrics = useCallback(async (): Promise<void> => {
    await refetchStakePageMetrics();
    return;
  }, [refetchStakePageMetrics]);

  const stakeTemple = useCallback(
    async (amount: string) => {
      if (!wallet || !signer) {
        console.debug(
          'Missing wallet or signer when trying to use SpiceBazaar.'
        );
        return;
      }

      // TODO marshall: We can move this to a new SignerApi
      await switchNetwork(getChainId());

      try {
        const templeAmount = getBigNumberFromString(
          amount,
          getTokenInfo(TICKER_SYMBOL.TEMPLE_TOKEN).decimals
        );

        const connectedSigner = getConnectedSigner();

        await ensureAllowanceWithSigner(
          TICKER_SYMBOL.TEMPLE_TOKEN,
          env.contracts.temple,
          env.contracts.spiceBazaar.templeGoldStaking,
          templeAmount,
          true,
          connectedSigner
        );

        const templeGoldStaking = (await papi.getConnectedContract(
          getAppConfig().contracts.templeGoldStaking,
          connectedSigner
        )) as TempleGoldStaking;

        const populatedTransaction =
          await templeGoldStaking.populateTransaction.stake(templeAmount);

        const receipt = await estimateAndMine(
          connectedSigner,
          populatedTransaction
        );

        openNotification({
          title: `Staked ${amount} TEMPLE`,
          hash: receipt.transactionHash,
        });

        fetchStakePageMetrics();
        updateBalance();
      } catch (err) {
        console.error(err);
        openNotification({
          title: 'Error staking TEMPLE',
          hash: '',
        });
      }
    },
    [
      wallet,
      signer,
      switchNetwork,
      getConnectedSigner,
      ensureAllowanceWithSigner,
      papi,
      openNotification,
      fetchStakePageMetrics,
      updateBalance,
    ]
  );

  const getCurrentEpoch = useCallback(async () => {
    const daiGoldAuction = (await papi.getContract(
      getAppConfig().contracts.daiGoldAuction
    )) as DaiGoldAuction;

    return BigNumber.from(await daiGoldAuction.currentEpoch());
  }, [papi]);

  const getPreviousEpochRewards = useCallback(async () => {
    if (!wallet) {
      return 0;
    }

    const currentEpoch = await getCurrentEpoch();

    if (!currentEpoch) {
      return 0;
    }

    if (currentEpoch.lt(2)) {
      return 0;
    }

    const previousEpoch = currentEpoch.sub(1);

    const daiGoldAuctionContract = (await papi.getContract(
      getAppConfig().contracts.daiGoldAuction
    )) as DaiGoldAuction;

    const rewardsFromPreviousEpoch =
      await daiGoldAuctionContract.getClaimableAtEpoch(wallet, previousEpoch);

    return fromAtto(rewardsFromPreviousEpoch);
  }, [wallet, getCurrentEpoch, papi]);

  const getCurrentEpochBidAmount = useCallback(async () => {
    if (!wallet) {
      return 0;
    }

    const currentEpoch = await getCurrentEpoch();

    if (!currentEpoch) {
      return 0;
    }

    const daiGoldAuctionContract = (await papi.getContract(
      getAppConfig().contracts.daiGoldAuction
    )) as DaiGoldAuction;

    const currentEpochBidAmount = await daiGoldAuctionContract.depositors(
      wallet,
      currentEpoch
    );

    return fromAtto(currentEpochBidAmount);
  }, [wallet, getCurrentEpoch, papi]);

  const getDailyVestedTgldReward = useCallback(async () => {
    if (!wallet) {
      return 0;
    }

    try {
      const templeGoldStakingContract = (await papi.getContract(
        getAppConfig().contracts.templeGoldStaking
      )) as TempleGoldStaking;

      const balance = await templeGoldStakingContract.balanceOf(wallet);
      const balanceNumber = fromAtto(balance);

      const rewardData = await templeGoldStakingContract.getRewardData();
      const rewardPerDayBn = rewardData.rewardRate;
      const rewardPerDay = fromAtto(rewardPerDayBn) * ONE_DAY_IN_SECONDS;

      const totalSupplyBn = await templeGoldStakingContract.totalSupply();
      const totalSupplyNumber = fromAtto(totalSupplyBn);

      const dailyVested = (rewardPerDay * balanceNumber) / totalSupplyNumber;

      return dailyVested;
    } catch (err) {
      console.error('Error while getting daily vested tgld reward', {
        cause: err,
      });
      return 0;
    }
  }, [wallet, papi]);

  // Create a dedicated fetch function for currentUserMetrics
  const fetchUserMetrics = useCallback(async () => {
    const dailyVestedTgldReward = await getDailyVestedTgldReward();
    const previousEpochRewards = await getPreviousEpochRewards();
    const currentEpochBidAmount = await getCurrentEpochBidAmount();

    return {
      dailyVestedTgldReward,
      previousEpochRewards,
      currentEpochBidAmount,
    };
  }, [
    getDailyVestedTgldReward,
    getPreviousEpochRewards,
    getCurrentEpochBidAmount,
  ]);

  const {
    data: currentUserMetricsData,
    isLoading: currentUserMetricsLoading,
    refetch: refetchCurrentUserMetrics,
  } = useQuery({
    queryKey: ['currentUserMetrics', wallet ? wallet : 'no-wallet'],
    queryFn: fetchUserMetrics,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    enabled: false, // automatic fetching disabled
  });

  // Manually trigger fetch when wallet changes
  useEffect(() => {
    if (wallet) {
      refetchCurrentUserMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  const fetchCurrentUserMetrics = useCallback(async (): Promise<void> => {
    await refetchCurrentUserMetrics();
    return;
  }, [refetchCurrentUserMetrics]);

  const getEpochInfo = useCallback(
    async (epoch: number) => {
      const daiGoldAuctionContract = (await papi.getContract(
        getAppConfig().contracts.daiGoldAuction
      )) as DaiGoldAuction;

      return await daiGoldAuctionContract.getEpochInfo(epoch);
    },
    [papi]
  );

  const getAuctionConfig = useCallback(async () => {
    const daiGoldAuctionContract = (await papi.getContract(
      getAppConfig().contracts.daiGoldAuction
    )) as DaiGoldAuction;

    return await daiGoldAuctionContract.getAuctionConfig();
  }, [papi]);

  const unstakeTemple = useCallback(
    async (amount: string, claimRewards: boolean) => {
      if (!wallet || !signer) {
        console.debug(
          'Missing wallet or signer when trying to use SpiceBazaar.'
        );
        return;
      }

      const templeAmount = getBigNumberFromString(
        amount,
        getTokenInfo(TICKER_SYMBOL.TEMPLE_TOKEN).decimals
      );

      await switchNetwork(getChainId());

      const connectedSigner = getConnectedSigner();

      const templeGoldStaking = (await papi.getConnectedContract(
        getAppConfig().contracts.templeGoldStaking,
        connectedSigner
      )) as TempleGoldStaking;

      const populatedTransaction =
        await templeGoldStaking.populateTransaction.withdraw(
          templeAmount,
          claimRewards
        );

      const receipt = await estimateAndMine(
        connectedSigner,
        populatedTransaction
      );

      openNotification({
        title: `Unstaked ${amount} TEMPLE`,
        hash: receipt.transactionHash,
      });

      fetchStakePageMetrics();
      fetchCurrentUserMetrics();
      updateBalance();
    },
    [
      wallet,
      signer,
      switchNetwork,
      getConnectedSigner,
      papi,
      openNotification,
      fetchStakePageMetrics,
      updateBalance,
      fetchCurrentUserMetrics,
    ]
  );

  /**
   * Claim staking rewards
   */
  const claimRewards = useCallback(async () => {
    if (!wallet || !signer) {
      console.debug('Missing wallet or signer when trying to use SpiceBazaar.');
      return;
    }

    await switchNetwork(getChainId());

    const connectedSigner = getConnectedSigner();

    const templeGoldStaking = (await papi.getConnectedContract(
      getAppConfig().contracts.templeGoldStaking,
      connectedSigner
    )) as TempleGoldStaking;

    const populatedTransaction =
      await templeGoldStaking.populateTransaction.getReward(wallet);
    const receipt = await estimateAndMine(
      connectedSigner,
      populatedTransaction
    );

    openNotification({
      title: `Claimed your TGLD`,
      hash: receipt.transactionHash,
    });

    fetchStakePageMetrics();
    fetchCurrentUserMetrics();
  }, [
    wallet,
    signer,
    switchNetwork,
    getConnectedSigner,
    papi,
    openNotification,
    fetchStakePageMetrics,
    fetchCurrentUserMetrics,
  ]);

  const isCurrentEpochAuctionLive = useCallback(async () => {
    const daiGoldAuctionContract = (await papi.getContract(
      getAppConfig().contracts.daiGoldAuction
    )) as DaiGoldAuction;

    const currentEpoch = await getCurrentEpoch();
    const info = await daiGoldAuctionContract.getEpochInfo(
      Number(currentEpoch)
    );
    const now = Date.now();

    const isActive =
      now >= info.startTime.toNumber() * 1000 &&
      now < info.endTime.toNumber() * 1000;

    return isActive;
  }, [getCurrentEpoch, papi]);

  // Create a dedicated fetch function for daiGoldAuctionInfo
  const fetchAuctionInfo = useCallback(
    async (silent?: boolean) => {
      try {
        const currentEpoch = await getCurrentEpoch();
        const epochInfo = await getEpochInfo(Number(currentEpoch));
        const currentEpochAuctionLive = await isCurrentEpochAuctionLive();
        const auctionConfig = await getAuctionConfig();

        if (!epochInfo) {
          return INITIAL_STATE.daiGoldAuctionInfo.data;
        }

        const totalBidTokenAmountNumber = fromAtto(
          epochInfo.totalBidTokenAmount
        );
        const totalAuctionTokenAmountNumber = fromAtto(
          epochInfo.totalAuctionTokenAmount
        );

        const priceRatio =
          totalBidTokenAmountNumber / totalAuctionTokenAmountNumber;

        const nextAuctionStartTimestamp = auctionConfig?.auctionsTimeDiff
          ? auctionConfig?.auctionsTimeDiff + fromAtto(epochInfo.endTime)
          : undefined;

        const daiGoldAuctionContract = (await papi.getContract(
          getAppConfig().contracts.daiGoldAuction
        )) as DaiGoldAuction;
        const auctionDuration = await daiGoldAuctionContract.AUCTION_DURATION();
        const auctionDurationNumber = auctionDuration.toNumber() * 1000;

        return {
          currentEpoch: Number(currentEpoch),
          nextEpoch: Number(currentEpoch) + 1,
          currentEpochAuctionLive: currentEpochAuctionLive || false,
          auctionStartTime: new Date(
            epochInfo.startTime.toNumber() * 1000
          ).getTime(),
          auctionEndTime: new Date(
            epochInfo.endTime.toNumber() * 1000
          ).getTime(),
          totalAuctionTokenAmount: fromAtto(epochInfo.totalAuctionTokenAmount),
          totalBidTokenAmount: fromAtto(epochInfo.totalBidTokenAmount),
          priceRatio: priceRatio,
          auctionDuration: auctionDurationNumber,
          nextAuctionStartTimestamp,
        };
      } catch (err) {
        console.error('Error fetching auction info', err);
        return INITIAL_STATE.daiGoldAuctionInfo.data;
      }
    },
    [
      getCurrentEpoch,
      getEpochInfo,
      isCurrentEpochAuctionLive,
      getAuctionConfig,
      papi,
    ]
  );

  // Use React Query for daiGoldAuctionInfo
  const {
    data: daiGoldAuctionInfo = INITIAL_STATE.daiGoldAuctionInfo.data,
    isLoading: daiGoldAuctionInfoLoading,
    refetch: refetchDaiGoldAuctionInfo,
  } = useQuery({
    queryKey: ['daiGoldAuctionInfo', wallet ? wallet : 'no-wallet'],
    queryFn: () => fetchAuctionInfo(),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    enabled: false, // automatic fetching disabled
  });

  useEffect(() => {
    refetchDaiGoldAuctionInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  // Create a wrapper for the refetch function to match the existing API
  const fetchDaiGoldAuctionInfo = useCallback(
    async (silent?: boolean): Promise<void> => {
      await refetchDaiGoldAuctionInfo();
      return;
    },
    [refetchDaiGoldAuctionInfo]
  );

  const getUnstakeTime = useCallback(async () => {
    if (!wallet || !signer) {
      console.debug('Missing wallet or signer when trying to use SpiceBazaar.');
      return 0;
    }

    try {
      const templeGoldStaking = (await papi.getContract(
        getAppConfig().contracts.templeGoldStaking
      )) as TempleGoldStaking;

      const unstakeTime = await templeGoldStaking.getAccountUnstakeTime(wallet);
      return unstakeTime.toNumber();
    } catch (err) {
      console.error('Error while getting unstake time', {
        cause: err,
      });
      return 0;
    }
  }, [wallet, signer, papi]);

  const daiGoldAuctionBid = useCallback(
    async (amount: string) => {
      if (!wallet || !signer) {
        console.debug(
          'Missing wallet or signer when trying to use SpiceBazaar.'
        );
        return;
      }

      await switchNetwork(getChainId());

      try {
        const usdsAmount = getBigNumberFromString(
          amount,
          getTokenInfo(TICKER_SYMBOL.USDS).decimals
        );

        const connectedSigner = getConnectedSigner();

        await ensureAllowanceWithSigner(
          TICKER_SYMBOL.USDS,
          env.contracts.usds,
          env.contracts.spiceBazaar.daiGoldAuction,
          usdsAmount,
          true,
          connectedSigner
        );

        const daiGoldAuctionContract = (await papi.getConnectedContract(
          getAppConfig().contracts.daiGoldAuction,
          connectedSigner
        )) as DaiGoldAuction;

        const populatedTransaction =
          await daiGoldAuctionContract.populateTransaction.bid(usdsAmount);
        const receipt = await estimateAndMine(
          connectedSigner,
          populatedTransaction
        );

        openNotification({
          title: `Bid ${amount} USDS`,
          hash: receipt.transactionHash,
        });

        fetchDaiGoldAuctionInfo();
        updateBalance();
      } catch (err) {
        console.error('Error while bidding USDS', {
          cause: err,
        });
        openNotification({
          title: 'Error bidding USDS',
          hash: '',
        });
        throw err;
      }
    },
    [
      wallet,
      signer,
      switchNetwork,
      getConnectedSigner,
      ensureAllowanceWithSigner,
      papi,
      openNotification,
      fetchDaiGoldAuctionInfo,
      updateBalance,
    ]
  );

  const getClaimableAtEpoch = useCallback(
    async (currentEpoch: string) => {
      if (!wallet || !signer) {
        console.debug(
          'Missing wallet or signer when trying to use SpiceBazaar.'
        );
        return 0;
      }
      try {
        const daiGoldAuction = (await papi.getContract(
          getAppConfig().contracts.daiGoldAuction
        )) as DaiGoldAuction;

        const claimableAtEpoch = await daiGoldAuction.getClaimableAtEpoch(
          wallet,
          currentEpoch
        );
        return fromAtto(claimableAtEpoch);
      } catch (error) {
        console.error('Error fetching claimable value:', error);
        throw error;
      }
    },
    [wallet, signer, papi]
  );

  /**
   * Claim stable gold auction rewards
   * TODO: Rename
   */
  const daiGoldAuctionClaim = useCallback(
    async (epoch: number) => {
      if (!wallet || !signer) {
        console.debug(
          'Missing wallet or signer when trying to use SpiceBazaar.'
        );
        return;
      }

      await switchNetwork(getChainId());

      const connectedSigner = getConnectedSigner();

      const daiGoldAuction = (await papi.getConnectedContract(
        getAppConfig().contracts.daiGoldAuction,
        connectedSigner
      )) as DaiGoldAuction;

      const populatedTransaction =
        await daiGoldAuction.populateTransaction.claim(epoch);
      const receipt = await estimateAndMine(
        connectedSigner,
        populatedTransaction
      );

      openNotification({
        title: `Claimed your TGLD`,
        hash: receipt.transactionHash,
      });

      fetchDaiGoldAuctionInfo();
      updateBalance();
    },
    [
      wallet,
      signer,
      switchNetwork,
      getConnectedSigner,
      papi,
      openNotification,
      fetchDaiGoldAuctionInfo,
      updateBalance,
    ]
  );

  const value = useMemo(() => {
    // Calculate currentUserMetrics inside useMemo
    const currentUserMetrics = currentUserMetricsData || {
      dailyVestedTgldReward: 0,
      previousEpochRewards: 0,
      currentEpochBidAmount: 0,
    };

    const stakePageMetrics =
      stakePageMetricsData || INITIAL_STATE.stakePageMetrics.data;

    return {
      stakePageMetrics: {
        data: stakePageMetrics,
        loading: stakePageMetricsLoading,
        fetch: fetchStakePageMetrics,
      },
      staking: {
        stakeTemple,
        unstakeTemple,
        claimRewards,
        getUnstakeTime,
      },
      daiGoldAuctionInfo: {
        data: daiGoldAuctionInfo,
        loading: daiGoldAuctionInfoLoading,
        fetch: fetchDaiGoldAuctionInfo,
      },
      daiGoldAuctions: {
        bid: daiGoldAuctionBid,
        claim: daiGoldAuctionClaim,
      },
      currentUser: {
        data: currentUserMetrics,
        loading: currentUserMetricsLoading,
        fetch: fetchCurrentUserMetrics,
        getClaimableAtEpoch,
      },
    };
  }, [
    currentUserMetricsData,
    stakePageMetricsData,
    stakePageMetricsLoading,
    fetchStakePageMetrics,
    stakeTemple,
    unstakeTemple,
    claimRewards,
    getUnstakeTime,
    daiGoldAuctionInfo,
    daiGoldAuctionInfoLoading,
    fetchDaiGoldAuctionInfo,
    daiGoldAuctionBid,
    daiGoldAuctionClaim,
    currentUserMetricsLoading,
    fetchCurrentUserMetrics,
    getClaimableAtEpoch,
  ]);

  return (
    <SpiceBazaarContext.Provider value={value}>
      {children}
    </SpiceBazaarContext.Provider>
  );
};

export const useSpiceBazaar = () => useContext(SpiceBazaarContext);
