import {
  createContext,
  useContext,
  useState,
  PropsWithChildren,
  useCallback,
  useMemo,
} from 'react';
import {
  DaiGoldAuction__factory,
  TempleGoldStaking__factory,
  ERC20__factory,
} from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import env from 'constants/env';
import { fromAtto } from 'utils/bigNumber';
import { useNotification } from 'providers/NotificationProvider';
import { estimateAndMine } from 'utils/ethers';
import { getBigNumberFromString, getTokenInfo } from 'components/Vault/utils';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber } from 'ethers';
import { asyncNoop } from 'utils/helpers';

export type StakePageMetrics = {
  stakedTemple: number;
  totalEpochRewards: number;
  yourStake: number;
  yourRewards: number;
};

export type DaiGoldAuctionInfo = {
  currentEpoch: number;
  auctionLive: boolean;
  totalAuctionTokenAmount: number;
  auctionEndTime: number;
  totalBidTokenAmount: number;
  priceRatio: number;
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
    fetch: () => Promise<void>;
  };
  daiGoldAuctions: {
    bid: () => Promise<Record<string, never>>;
  };
}

const INITIAL_STATE: SpiceBazaarContextValue = {
  stakePageMetrics: {
    data: {
      stakedTemple: 0,
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
      auctionLive: false,
      totalAuctionTokenAmount: 0,
      auctionEndTime: 0,
      totalBidTokenAmount: 0,
      priceRatio: 0,
    },
    loading: false,
    fetch: asyncNoop,
  },
  daiGoldAuctions: {
    bid: async () => ({}),
  },
};

const SpiceBazaarContext =
  createContext<SpiceBazaarContextValue>(INITIAL_STATE);

export const SpiceBazaarProvider = ({ children }: PropsWithChildren) => {
  const { wallet, signer, ensureAllowance, updateBalance } = useWallet();
  const { openNotification } = useNotification();

  const [stakePageMetricsLoading, setStakePageMetricsLoading] = useState(false);
  const [stakePageMetrics, setStakePageMetrics] = useState<StakePageMetrics>(
    INITIAL_STATE.stakePageMetrics.data
  );

  const [daiGoldAuctionInfoLoading, setDaiGoldAuctionInfoLoading] =
    useState(false);
  const [daiGoldAuctionInfo, setDaiGoldAuctionInfo] =
    useState<DaiGoldAuctionInfo>(INITIAL_STATE.daiGoldAuctionInfo.data);

  const getStakedTemple = useCallback(async () => {
    if (!wallet || !signer) {
      console.debug('Missing wallet or signer when trying to use SpiceBazaar.');
      return;
    }

    try {
      const templeGoldStaking = new TempleGoldStaking__factory(signer).attach(
        env.contracts.spiceBazaar.templeGoldStaking
      );

      const totalSupply = await templeGoldStaking.totalSupply();
      return fromAtto(totalSupply);
    } catch (err) {
      console.error('Error while getting staked temple', {
        cause: err,
      });
      return 0;
    }
  }, [wallet, signer]);

  const getTotalEpochRewards = useCallback(async () => {
    if (!wallet || !signer) {
      console.debug('Missing wallet or signer when trying to use SpiceBazaar.');
      return;
    }
    // TODO: Implement
    return 0;
  }, [wallet, signer]);

  const getYourStake = useCallback(async () => {
    if (!wallet || !signer) {
      console.debug('Missing wallet or signer when trying to use SpiceBazaar.');
      return;
    }

    const templeGoldStaking = new TempleGoldStaking__factory(signer).attach(
      env.contracts.spiceBazaar.templeGoldStaking
    );

    try {
      const balance = await templeGoldStaking.balanceOf(wallet);
      return fromAtto(balance);
    } catch (err) {
      console.error('Error while getting your stake', {
        cause: err,
      });
      return 0;
    }
  }, [wallet, signer]);

  const getYourRewards = useCallback(async () => {
    if (!wallet || !signer) {
      console.debug('Missing wallet or signer when trying to use SpiceBazaar.');
      return;
    }

    const templeGoldStaking = new TempleGoldStaking__factory(signer).attach(
      env.contracts.spiceBazaar.templeGoldStaking
    );

    try {
      const reward = await templeGoldStaking.earned(wallet);
      return fromAtto(reward);
    } catch (err) {
      console.error('Error while getting your rewards', {
        cause: err,
      });
      return 0;
    }
  }, [wallet, signer]);

  const fetchStakePageMetrics = useCallback(async () => {
    setStakePageMetricsLoading(true);

    const allMetrics = await Promise.all([
      getStakedTemple(),
      getTotalEpochRewards(),
      getYourStake(),
      getYourRewards(),
    ]);

    setStakePageMetrics({
      stakedTemple: allMetrics[0] || 0,
      totalEpochRewards: allMetrics[1] || 0,
      yourStake: allMetrics[2] || 0,
      yourRewards: allMetrics[3] || 0,
    });

    setStakePageMetricsLoading(false);
  }, [getStakedTemple, getTotalEpochRewards, getYourStake, getYourRewards]);

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

  const getCurrentEpoch = useCallback(async () => {
    if (!signer) {
      console.debug('Missing signer when trying to use SpiceBazaar.');
      return;
    }

    const daiGoldAuction = new DaiGoldAuction__factory(signer).attach(
      env.contracts.spiceBazaar.daiGoldAuction
    );

    return BigNumber.from(await daiGoldAuction.currentEpoch());
  }, [signer]);

  const getEpochInfo = useCallback(
    async (epoch: number) => {
      if (!signer) {
        console.debug('Missing signer when trying to use SpiceBazaar.');
        return;
      }

      const daiGoldAuction = new DaiGoldAuction__factory(signer).attach(
        env.contracts.spiceBazaar.daiGoldAuction
      );

      return await daiGoldAuction.getEpochInfo(epoch);
    },
    [signer]
  );

  // TODO: possibly move to useMemo
  const isAuctionLive = useCallback(async () => {
    if (!signer) {
      console.debug('Missing signer when trying to use SpiceBazaar.');
      return;
    }

    const daiGoldAuction = new DaiGoldAuction__factory(signer).attach(
      env.contracts.spiceBazaar.daiGoldAuction
    );

    return await daiGoldAuction.canDeposit();
  }, [signer]);

  const fetchDaiGoldAuctionInfo = useCallback(async () => {
    if (!wallet || !signer) {
      console.debug('Missing wallet or signer when trying to use SpiceBazaar.');
      return;
    }

    setDaiGoldAuctionInfoLoading(true);

    const currentEpoch = await getCurrentEpoch();
    const epochInfo = await getEpochInfo(Number(currentEpoch));
    const auctionLive = await isAuctionLive();

    if (!epochInfo) {
      setDaiGoldAuctionInfoLoading(false);
      return;
    }

    const priceRatioBigNumber = epochInfo.totalAuctionTokenAmount.isZero()
      ? BigNumber.from(0)
      : epochInfo.totalBidTokenAmount.div(epochInfo.totalAuctionTokenAmount);

    setDaiGoldAuctionInfo({
      currentEpoch: Number(currentEpoch),
      auctionLive: auctionLive || false,
      totalAuctionTokenAmount: fromAtto(epochInfo.totalAuctionTokenAmount),
      auctionEndTime: new Date(epochInfo.endTime.toNumber() * 1000).getTime(),
      totalBidTokenAmount: fromAtto(epochInfo.totalBidTokenAmount),
      priceRatio: priceRatioBigNumber.toNumber(),
    });

    setDaiGoldAuctionInfoLoading(false);
  }, [getCurrentEpoch, getEpochInfo, isAuctionLive, signer, wallet]);

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
        bid: async () => ({}),
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
    ]
  );

  return (
    <SpiceBazaarContext.Provider value={value}>
      {children}
    </SpiceBazaarContext.Provider>
  );
};

export const useSpiceBazaar = () => useContext(SpiceBazaarContext);
