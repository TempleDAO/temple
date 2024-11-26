import {
  DaiGoldAuction__factory,
  ERC20__factory,
  TempleGoldStaking__factory,
} from 'types/typechain';

import { useWallet } from 'providers/WalletProvider';
import env from 'constants/env';
import { useCallback, useState } from 'react';
import { fromAtto, ZERO } from 'utils/bigNumber';
import { useNotification } from 'providers/NotificationProvider';
import { estimateAndMine } from 'utils/ethers';
import { getBigNumberFromString, getTokenInfo } from 'components/Vault/utils';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber } from 'ethers';

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

export const useSpiceBazaar = () => {
  const { wallet, signer, ensureAllowance, updateBalance } = useWallet();
  const { openNotification } = useNotification();

  const [stakePageMetricsLoading, setStakePageMetricsLoading] = useState(false);
  const [stakePageMetrics, setStakePageMetrics] = useState<StakePageMetrics>({
    stakedTemple: 0,
    totalEpochRewards: 0,
    yourStake: 0,
    yourRewards: 0,
  });

  const [daiGoldAuctionInfoLoading, setDaiGoldAuctionInfoLoading] =
    useState(false);
  const [daiGoldAuctionInfo, setDaiGoldAuctionInfo] =
    useState<DaiGoldAuctionInfo>({
      currentEpoch: 0,
      auctionLive: false,
      totalAuctionTokenAmount: 0,
      auctionEndTime: 0,
      totalBidTokenAmount: 0,
      priceRatio: 0,
    });

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

    // TODO: Implement,
    // rewardData.rewardRate * rewardDuration??
    return 0;
  }, [signer, wallet]);

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
  }, [signer, wallet]);

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
  }, [signer, wallet]);

  const fetchStakePageMetrics = useCallback(async (): Promise<void> => {
    console.log('--- updating stake page metrics');
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
    console.log('--- DONE updating stake page metrics');
  }, [getStakedTemple, getTotalEpochRewards, getYourRewards, getYourStake]);

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
          templeAmount
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
    [wallet, signer, ensureAllowance, openNotification, fetchStakePageMetrics]
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

      // TODO: Once on mainnet we need to ensure allowance
      // await ensureAllowance(
      //   TICKER_SYMBOL.TEMPLE_TOKEN,
      //   env.contracts.spiceBazaar.tokens.temple, // I think that here should be the same obs like in stakeTemple
      //   env.contracts.spiceBazaar.templeGoldStaking,
      //   templeAmount
      // );

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

    setDaiGoldAuctionInfo({
      currentEpoch: Number(currentEpoch),
      auctionLive: auctionLive || false,
      totalAuctionTokenAmount: fromAtto(epochInfo.totalAuctionTokenAmount),
      auctionEndTime: new Date(epochInfo.endTime.toNumber() * 1000).getTime(),
      totalBidTokenAmount: fromAtto(epochInfo.totalBidTokenAmount),
      priceRatio: fromAtto(
        epochInfo.totalBidTokenAmount.div(epochInfo.totalAuctionTokenAmount)
      ),
    });

    setDaiGoldAuctionInfoLoading(false);
  }, [wallet, signer, getCurrentEpoch, getEpochInfo, isAuctionLive]);

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
    },
    daiGoldAuctionInfo: {
      data: daiGoldAuctionInfo,
      loading: daiGoldAuctionInfoLoading,
      fetch: fetchDaiGoldAuctionInfo,
    },
    daiGoldAuctions: {
      bid: async () => ({}),
    },
  };
};
