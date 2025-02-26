import {
  createContext,
  useContext,
  useState,
  PropsWithChildren,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import {
  DaiGoldAuction__factory,
  TempleGoldStaking__factory,
  TempleGold__factory,
  ERC20__factory,
} from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import env from 'constants/env';
import { fromAtto } from 'utils/bigNumber';
import { useNotification } from 'providers/NotificationProvider';
import { estimateAndMine } from 'utils/ethers';
import { getBigNumberFromString, getTokenInfo } from 'components/Vault/utils';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber, ethers } from 'ethers';
import { asyncNoop } from 'utils/helpers';

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
  featureFlag: {
    isEnabled: boolean;
    toggle: () => void;
  };
}

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

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
  featureFlag: {
    isEnabled: false,
    toggle: asyncNoop,
  },
};

const SpiceBazaarContext =
  createContext<SpiceBazaarContextValue>(INITIAL_STATE);

export const SpiceBazaarProvider = ({ children }: PropsWithChildren) => {
  const {
    wallet,
    signer,
    ensureAllowance,
    updateBalance,
    providerWithReadOnlyFallback,
  } = useWallet();
  const { openNotification } = useNotification();

  const [stakePageMetricsLoading, setStakePageMetricsLoading] = useState(false);
  const [stakePageMetrics, setStakePageMetrics] = useState<StakePageMetrics>(
    INITIAL_STATE.stakePageMetrics.data
  );

  const [daiGoldAuctionInfoLoading, setDaiGoldAuctionInfoLoading] =
    useState(false);
  const [daiGoldAuctionInfo, setDaiGoldAuctionInfo] =
    useState<DaiGoldAuctionInfo>(INITIAL_STATE.daiGoldAuctionInfo.data);

  const [currentUserMetricsLoading, setCurrentUserMetricsLoading] =
    useState(false);

  const [currentUserMetrics, setCurrentUserMetrics] = useState<{
    dailyVestedTgldReward: number;
    previousEpochRewards: number;
    currentEpochBidAmount: number;
  }>({
    dailyVestedTgldReward: 0,
    previousEpochRewards: 0,
    currentEpochBidAmount: 0,
  });

  const getStoredFlagState = () => {
    if (typeof window !== 'undefined') {
      const storedFlag = localStorage.getItem('featureFlagState');
      return storedFlag ? JSON.parse(storedFlag) : false;
    }
    return false;
  };

  const [isFeatureEnabled, setIsFeatureEnabled] = useState(getStoredFlagState);

  const toggleFeatureFlag = useCallback(() => {
    setIsFeatureEnabled((prev: boolean) => {
      const newState = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('featureFlagState', JSON.stringify(newState));
      }
      return newState;
    });
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedFlag = localStorage.getItem('featureFlagState');
      if (storedFlag) {
        setIsFeatureEnabled(JSON.parse(storedFlag));
      }
    }
  }, []);

  const getStakedTemple = useCallback(async () => {
    try {
      const templeGoldStaking = TempleGoldStaking__factory.connect(
        env.contracts.spiceBazaar.templeGoldStaking,
        providerWithReadOnlyFallback
      );

      const totalSupply = await templeGoldStaking.totalSupply();
      return fromAtto(totalSupply);
    } catch (err) {
      console.error('Error while getting staked temple', {
        cause: err,
      });
      return 0;
    }
  }, [providerWithReadOnlyFallback]);

  const getCirculatingSupply = useCallback(async () => {
    try {
      const templeGold = TempleGold__factory.connect(
        env.contracts.templegold,
        providerWithReadOnlyFallback
      );

      const circulatingSupply = await templeGold.circulatingSupply();
      return fromAtto(circulatingSupply);
    } catch (err) {
      console.error('Error while getting circulating supply', {
        cause: err,
      });
      return 0;
    }
  }, [providerWithReadOnlyFallback]);

  const getCurrentEpoch = useCallback(async () => {
    const daiGoldAuction = DaiGoldAuction__factory.connect(
      env.contracts.spiceBazaar.daiGoldAuction,
      providerWithReadOnlyFallback
    );

    return BigNumber.from(await daiGoldAuction.currentEpoch());
  }, [providerWithReadOnlyFallback]);

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

    const daiGoldAuction = DaiGoldAuction__factory.connect(
      env.contracts.spiceBazaar.daiGoldAuction,
      providerWithReadOnlyFallback
    );

    const rewardsFromPreviousEpoch = await daiGoldAuction.getClaimableAtEpoch(
      wallet,
      previousEpoch
    );

    return fromAtto(rewardsFromPreviousEpoch);
  }, [wallet, getCurrentEpoch, providerWithReadOnlyFallback]);

  const getCurrentEpochBidAmount = useCallback(async () => {
    if (!wallet) {
      return 0;
    }

    const currentEpoch = await getCurrentEpoch();

    if (!currentEpoch) {
      return 0;
    }

    const daiGoldAuction = DaiGoldAuction__factory.connect(
      env.contracts.spiceBazaar.daiGoldAuction,
      providerWithReadOnlyFallback
    );

    const currentEpochBidAmount = await daiGoldAuction.depositors(
      wallet,
      currentEpoch
    );

    return fromAtto(currentEpochBidAmount);
  }, [wallet, getCurrentEpoch, providerWithReadOnlyFallback]);

  const getDailyVestedTgldReward = useCallback(async () => {
    if (!wallet || !providerWithReadOnlyFallback) {
      return 0;
    }

    try {
      const templeGoldStaking = TempleGoldStaking__factory.connect(
        env.contracts.spiceBazaar.templeGoldStaking,
        providerWithReadOnlyFallback
      );

      const rewardPerToken = await templeGoldStaking.rewardPerToken();
      const rewardPerTokenNumber = fromAtto(rewardPerToken);
      const balance = await templeGoldStaking.balanceOf(wallet);
      const balanceNumber = fromAtto(balance);

      const dailyVestedTgldReward = (rewardPerTokenNumber * balanceNumber) / 7;

      return dailyVestedTgldReward;
    } catch (err) {
      console.error('Error while getting daily vested tgld reward', {
        cause: err,
      });
      return 0;
    }
  }, [wallet, providerWithReadOnlyFallback]);

  const fetchCurrentUserMetrics = useCallback(async () => {
    setCurrentUserMetricsLoading(true);
    const dailyVestedTgldReward = await getDailyVestedTgldReward();
    const previousEpochRewards = await getPreviousEpochRewards();
    const currentEpochBidAmount = await getCurrentEpochBidAmount();
    setCurrentUserMetrics({
      dailyVestedTgldReward,
      previousEpochRewards,
      currentEpochBidAmount,
    });
    setCurrentUserMetricsLoading(false);
  }, [
    getDailyVestedTgldReward,
    getPreviousEpochRewards,
    getCurrentEpochBidAmount,
    setCurrentUserMetrics,
  ]);

  const getEpochInfo = useCallback(
    async (epoch: number) => {
      const daiGoldAuction = DaiGoldAuction__factory.connect(
        env.contracts.spiceBazaar.daiGoldAuction,
        providerWithReadOnlyFallback
      );

      return await daiGoldAuction.getEpochInfo(epoch);
    },
    [providerWithReadOnlyFallback]
  );

  const getAuctionConfig = useCallback(async () => {
    const daiGoldAuction = DaiGoldAuction__factory.connect(
      env.contracts.spiceBazaar.daiGoldAuction,
      providerWithReadOnlyFallback
    );

    return await daiGoldAuction.getAuctionConfig();
  }, [providerWithReadOnlyFallback]);

  const getTotalEpochRewards = useCallback(async () => {
    const stakingContract = TempleGoldStaking__factory.connect(
      env.contracts.spiceBazaar.templeGoldStaking,
      providerWithReadOnlyFallback
    );

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
  }, [providerWithReadOnlyFallback]);

  const getYourStake = useCallback(async () => {
    if (!wallet || !providerWithReadOnlyFallback) {
      return null;
    }

    try {
      const templeGoldStaking = TempleGoldStaking__factory.connect(
        env.contracts.spiceBazaar.templeGoldStaking,
        providerWithReadOnlyFallback
      );

      const balance = await templeGoldStaking.balanceOf(wallet);
      return fromAtto(balance);
    } catch (error) {
      console.error('Error fetching stake balance:', error);
      return null;
    }
  }, [providerWithReadOnlyFallback, wallet]);

  const getYourRewards = useCallback(async () => {
    if (!wallet || !providerWithReadOnlyFallback) {
      return null;
    }

    try {
      const templeGoldStaking = TempleGoldStaking__factory.connect(
        env.contracts.spiceBazaar.templeGoldStaking,
        providerWithReadOnlyFallback
      );

      const reward = await templeGoldStaking.earned(wallet);
      return fromAtto(reward);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      return null;
    }
  }, [providerWithReadOnlyFallback, wallet]);

  const fetchStakePageMetrics = useCallback(async () => {
    if (!providerWithReadOnlyFallback) {
      console.log('Provider not ready, skipping fetch');
      return;
    }

    setStakePageMetricsLoading(true);

    try {
      if (!wallet) {
        setStakePageMetrics(INITIAL_STATE.stakePageMetrics.data);
        return;
      }

      const allMetrics = await Promise.all([
        getStakedTemple(),
        getCirculatingSupply(),
        getTotalEpochRewards(),
        getYourStake(),
        getYourRewards(),
      ]);

      if (!allMetrics.some((metric) => metric === null)) {
        setStakePageMetrics({
          stakedTemple: allMetrics[0] || 0,
          circulatingSupply: allMetrics[1] || 0,
          totalEpochRewards: allMetrics[2] || 0,
          yourStake: allMetrics[3] || 0,
          yourRewards: allMetrics[4] || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching stake page metrics:', error);
    } finally {
      setStakePageMetricsLoading(false);
    }
  }, [
    wallet,
    getStakedTemple,
    getCirculatingSupply,
    getTotalEpochRewards,
    getYourStake,
    getYourRewards,
    providerWithReadOnlyFallback,
  ]);

  const stakeTemple = useCallback(
    async (amount: string) => {
      if (!wallet || !signer) {
        console.debug(
          'Missing wallet or signer when trying to use SpiceBazaar.'
        );
        return;
      }

      try {
        const templeAmount = getBigNumberFromString(
          amount,
          getTokenInfo(TICKER_SYMBOL.TEMPLE_TOKEN).decimals
        );

        const templeContract = new ERC20__factory(signer).attach(
          env.contracts.temple
        );

        await ensureAllowance(
          TICKER_SYMBOL.TEMPLE_TOKEN,
          templeContract,
          env.contracts.spiceBazaar.templeGoldStaking,
          templeAmount,
          true
        );

        const templeGoldStaking = new TempleGoldStaking__factory(signer).attach(
          env.contracts.spiceBazaar.templeGoldStaking
        );

        const populatedTransaction =
          await templeGoldStaking.populateTransaction.stake(templeAmount);

        const receipt = await estimateAndMine(signer, populatedTransaction);

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
      ensureAllowance,
      openNotification,
      fetchStakePageMetrics,
      updateBalance,
    ]
  );

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

      const templeGoldStaking = new TempleGoldStaking__factory(signer).attach(
        env.contracts.spiceBazaar.templeGoldStaking
      );

      const populatedTransaction =
        await templeGoldStaking.populateTransaction.withdraw(
          templeAmount,
          claimRewards
        );
      const receipt = await estimateAndMine(signer, populatedTransaction);

      openNotification({
        title: `Unstaked ${amount} TEMPLE`,
        hash: receipt.transactionHash,
      });

      fetchStakePageMetrics();
    },
    [wallet, signer, openNotification, fetchStakePageMetrics]
  );

  const claimRewards = useCallback(async () => {
    if (!wallet || !signer) {
      console.debug('Missing wallet or signer when trying to use SpiceBazaar.');
      return;
    }

    const templeGoldStaking = new TempleGoldStaking__factory(signer).attach(
      env.contracts.spiceBazaar.templeGoldStaking
    );

    const populatedTransaction =
      await templeGoldStaking.populateTransaction.getReward(wallet);
    const receipt = await estimateAndMine(signer, populatedTransaction);

    openNotification({
      title: `Claimed your TGLD`,
      hash: receipt.transactionHash,
    });

    fetchStakePageMetrics();
  }, [wallet, signer, openNotification, fetchStakePageMetrics]);

  const isCurrentEpochAuctionLive = useCallback(async () => {
    const daiGoldAuction = DaiGoldAuction__factory.connect(
      env.contracts.spiceBazaar.daiGoldAuction,
      providerWithReadOnlyFallback
    );

    const currentEpoch = await getCurrentEpoch();
    const info = await daiGoldAuction.getEpochInfo(Number(currentEpoch));
    const now = Date.now();

    const isActive =
      now >= info.startTime.toNumber() * 1000 &&
      now < info.endTime.toNumber() * 1000;

    return isActive;
  }, [providerWithReadOnlyFallback, getCurrentEpoch]);

  const fetchDaiGoldAuctionInfo = useCallback(
    async (silent?: boolean) => {
      if (!silent) {
        setDaiGoldAuctionInfoLoading(true);
      }

      try {
        const currentEpoch = await getCurrentEpoch();
        const epochInfo = await getEpochInfo(Number(currentEpoch));
        const currentEpochAuctionLive = await isCurrentEpochAuctionLive();
        const auctionConfig = await getAuctionConfig();

        if (!epochInfo) {
          setDaiGoldAuctionInfoLoading(false);
          return;
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

        const daiGoldAuction = DaiGoldAuction__factory.connect(
          env.contracts.spiceBazaar.daiGoldAuction,
          providerWithReadOnlyFallback
        );

        const auctionDuration = await daiGoldAuction.AUCTION_DURATION();
        const auctionDurationNumber = auctionDuration.toNumber() * 1000;

        setDaiGoldAuctionInfo({
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
        });
      } catch (err) {
        console.error('Error fetching auction info', err);
      } finally {
        setDaiGoldAuctionInfoLoading(false);
      }
    },
    [getCurrentEpoch, getEpochInfo, getAuctionConfig, isCurrentEpochAuctionLive]
  );

  const getUnstakeTime = useCallback(async () => {
    if (!wallet || !signer) {
      console.debug('Missing wallet or signer when trying to use SpiceBazaar.');
      return 0;
    }

    try {
      const templeGoldStaking = new TempleGoldStaking__factory(signer).attach(
        env.contracts.spiceBazaar.templeGoldStaking
      );

      const unstakeTime = await templeGoldStaking.getAccountUnstakeTime(wallet);
      return unstakeTime.toNumber();
    } catch (err) {
      console.error('Error while getting unstake time', {
        cause: err,
      });
      return 0;
    }
  }, [wallet, signer]);

  const daiGoldAuctionBid = useCallback(
    async (amount: string) => {
      if (!wallet || !signer) {
        console.debug(
          'Missing wallet or signer when trying to use SpiceBazaar.'
        );
        return;
      }

      try {
        const usdsAmount = getBigNumberFromString(
          amount,
          getTokenInfo(TICKER_SYMBOL.USDS).decimals
        );

        const usdsContract = new ERC20__factory(signer).attach(
          env.contracts.usds
        );

        await ensureAllowance(
          TICKER_SYMBOL.USDS,
          usdsContract,
          env.contracts.spiceBazaar.daiGoldAuction,
          usdsAmount,
          true
        );

        const daiGoldAuction = new DaiGoldAuction__factory(signer).attach(
          env.contracts.spiceBazaar.daiGoldAuction
        );

        const populatedTransaction =
          await daiGoldAuction.populateTransaction.bid(usdsAmount);
        const receipt = await estimateAndMine(signer, populatedTransaction);

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
      ensureAllowance,
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
        const daiGoldAuction = new DaiGoldAuction__factory(signer).attach(
          env.contracts.spiceBazaar.daiGoldAuction
        );

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
    [wallet, signer]
  );

  const daiGoldAuctionClaim = useCallback(
    async (epoch: number) => {
      if (!wallet || !signer) {
        console.debug(
          'Missing wallet or signer when trying to use SpiceBazaar.'
        );
        return;
      }

      const daiGoldAuction = new DaiGoldAuction__factory(signer).attach(
        env.contracts.spiceBazaar.daiGoldAuction
      );

      const populatedTransaction =
        await daiGoldAuction.populateTransaction.claim(epoch);
      const receipt = await estimateAndMine(signer, populatedTransaction);

      openNotification({
        title: `Claimed your TGLD`,
        hash: receipt.transactionHash,
      });

      fetchDaiGoldAuctionInfo();
      updateBalance();
    },
    [wallet, signer, openNotification, fetchDaiGoldAuctionInfo, updateBalance]
  );

  const value = useMemo(
    () => ({
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
      featureFlag: {
        isEnabled: isFeatureEnabled,
        toggle: toggleFeatureFlag,
      },
    }),
    [
      stakePageMetrics,
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
      getClaimableAtEpoch,
      daiGoldAuctionClaim,
      fetchCurrentUserMetrics,
      currentUserMetrics,
      currentUserMetricsLoading,
      isFeatureEnabled,
      toggleFeatureFlag,
    ]
  );

  return (
    <SpiceBazaarContext.Provider value={value}>
      {children}
    </SpiceBazaarContext.Provider>
  );
};

export const useSpiceBazaar = () => useContext(SpiceBazaarContext);
