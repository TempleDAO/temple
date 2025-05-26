import {
  createContext,
  useContext,
  PropsWithChildren,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { SpiceAuction, TempleGold } from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import { fromAtto, toAtto, ZERO } from 'utils/bigNumber';
import { useNotification } from 'providers/NotificationProvider';
import { estimateAndMine } from 'utils/ethers';
import { getBigNumberFromString, getTokenInfo } from 'components/Vault/utils';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber, Contract, ethers } from 'ethers';
import { asyncNoop } from 'utils/helpers';
import { useApiManager } from 'hooks/use-api-manager';
import { useQuery } from '@tanstack/react-query';
import { getAppConfig } from 'constants/newenv';
import { SpiceAuctionConfig } from 'constants/newenv/types';
import {
  subgraphQuery,
  spiceAuctionInfoQuery,
  SpiceAuctionInfoResp,
} from 'utils/subgraph';

const ENV = import.meta.env;

export type SpiceAuctionInfo = {
  currentEpoch: number;
  nextEpoch: number;
  currentEpochAuctionLive: boolean;
  auctionStartTime: number;
  auctionEndTime: number;
  totalBidTokenAmount: number;
  auctionTokenSymbol: string;
  totalAuctionTokenAmount: number;
  priceRatio: number;
  auctionDuration: number;
  nextAuctionStartTimestamp: number | undefined;
  name?: string;
  address?: string;
  staticConfig: SpiceAuctionConfig;
};

export type SpiceAuctionUserMetrics = {
  currentEpochBidAmount: number;
};

export enum BridgeTGLDSource {
  ETH_SOURCE = 'ethSource',
  ALTCHAIN_SOURCE = 'altchainSource',
}

interface SpiceAuctionContextValue {
  spiceAuctionInfo: {
    data: SpiceAuctionInfo;
    loading: boolean;
    fetch: (silent?: boolean) => Promise<void>;
  };
  spiceAuctions: {
    bid: (
      auctionStaticConfig: SpiceAuctionConfig,
      amount: string
    ) => Promise<void>;
    claim: (
      auctionStaticConfig: SpiceAuctionConfig,
      epoch: number
    ) => Promise<void>;
  };
  allSpiceAuctions: {
    data: SpiceAuctionInfo[];
    loading: boolean;
    fetch: (silent?: boolean) => Promise<void>;
  };
  currentUser: {
    data: {
      currentEpochBidAmount: number;
    };
    loading: boolean;
    fetch: (
      auctionStaticConfig?: SpiceAuctionConfig
    ) => Promise<SpiceAuctionUserMetrics>;
    getClaimableAtEpoch: (
      auction: SpiceAuctionInfo,
      epoch: number
    ) => Promise<number>;
  };
  bridgeTgld: (amount: string, source: BridgeTGLDSource) => Promise<void>;
}

const EMPTY_SPICE_AUCTION_CONFIG: SpiceAuctionConfig = {
  name: '',
  chainId: 0,
  auctionTokenSymbol: '',
  contractConfig: {
    address: '',
    contractFactory: {} as Contract,
    chainId: 0,
  },
  templeGoldToken: {
    address: '',
    decimals: 18,
    symbol: '',
    name: '',
    chainId: 0,
  },
  templeGoldTokenBalanceTickerSymbol: TICKER_SYMBOL.TEMPLE_GOLD_TOKEN,
  isActive: false,
  subgraphUrl: '',
};

const INITIAL_STATE: SpiceAuctionContextValue = {
  spiceAuctionInfo: {
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
      auctionTokenSymbol: '',
      staticConfig: EMPTY_SPICE_AUCTION_CONFIG,
    },
    loading: false,
    fetch: asyncNoop,
  },
  spiceAuctions: {
    bid: asyncNoop,
    claim: asyncNoop,
  },
  allSpiceAuctions: {
    data: [],
    loading: false,
    fetch: asyncNoop,
  },
  currentUser: {
    data: {
      currentEpochBidAmount: 0,
    },
    loading: false,
    fetch: async () => ({ currentEpochBidAmount: 0 }),
    getClaimableAtEpoch: async () => 0,
  },
  bridgeTgld: asyncNoop,
};

const SpiceAuctionContext =
  createContext<SpiceAuctionContextValue>(INITIAL_STATE);

export const SpiceAuctionProvider = ({ children }: PropsWithChildren) => {
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

  const getCurrentEpoch = useCallback(
    async (auctionStaticConfig: SpiceAuctionConfig) => {
      const spiceAuctionContract = (await papi.getContract(
        auctionStaticConfig.contractConfig
      )) as SpiceAuction;

      return BigNumber.from(await spiceAuctionContract.currentEpoch());
    },
    [papi]
  );

  const getCurrentEpochBidAmount = useCallback(
    async (auctionStaticConfig: SpiceAuctionConfig) => {
      if (!wallet) {
        return 0;
      }

      const currentEpoch = await getCurrentEpoch(auctionStaticConfig);

      if (!currentEpoch) {
        return 0;
      }

      const spiceAuctionContract = (await papi.getContract(
        auctionStaticConfig.contractConfig
      )) as SpiceAuction;

      const currentEpochBidAmount = await spiceAuctionContract.depositors(
        wallet,
        currentEpoch
      );

      return fromAtto(currentEpochBidAmount);
    },
    [wallet, getCurrentEpoch, papi]
  );

  const fetchUserMetrics = useCallback(
    async (auctionStaticConfig: SpiceAuctionConfig) => {
      const currentEpochBidAmount = await getCurrentEpochBidAmount(
        auctionStaticConfig
      );
      return { currentEpochBidAmount };
    },
    [getCurrentEpochBidAmount]
  );

  const useUserMetrics = (
    auctionStaticConfig: SpiceAuctionConfig | undefined
  ) => {
    return useQuery<SpiceAuctionUserMetrics>({
      queryKey: [
        'currentUserMetrics',
        wallet ? wallet : 'no-wallet',
        auctionStaticConfig?.contractConfig.address,
      ],
      queryFn: async () => {
        if (!auctionStaticConfig) {
          throw new Error('No auction config provided');
        }
        return fetchUserMetrics(auctionStaticConfig);
      },
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      enabled: !!auctionStaticConfig, // only enable if we have an auction config
    });
  };

  // Use the hook with the first auction for now
  const {
    data: currentUserMetricsData,
    isLoading: currentUserMetricsLoading,
    refetch: refetchCurrentUserMetrics,
  } = useUserMetrics(getAppConfig().spiceBazaar.spiceAuctions[0]);

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
    async (auctionStaticConfig: SpiceAuctionConfig, epoch: number) => {
      const spiceAuctionContract = (await papi.getContract(
        auctionStaticConfig.contractConfig
      )) as SpiceAuction;

      return await spiceAuctionContract.getEpochInfo(epoch);
    },
    [papi]
  );

  const getAuctionConfig = useCallback(
    async (auctionStaticConfig: SpiceAuctionConfig) => {
      const spiceAuctionContract = (await papi.getContract(
        auctionStaticConfig.contractConfig
      )) as SpiceAuction;

      const currentEpoch = await getCurrentEpoch(auctionStaticConfig);
      return spiceAuctionContract.getAuctionConfig(currentEpoch);
    },
    [papi, getCurrentEpoch]
  );

  const isCurrentEpochAuctionLive = useCallback(
    async (auctionStaticConfig: SpiceAuctionConfig) => {
      const spiceAuctionContract = (await papi.getContract(
        auctionStaticConfig.contractConfig
      )) as SpiceAuction;

      const currentEpoch = await getCurrentEpoch(auctionStaticConfig);
      const info = await spiceAuctionContract.getEpochInfo(
        Number(currentEpoch)
      );
      const now = Date.now();

      const isActive =
        now >= info.startTime.toNumber() * 1000 &&
        now < info.endTime.toNumber() * 1000;

      return isActive;
    },
    [getCurrentEpoch, papi]
  );

  // TODO: Probably remove this.
  const fetchAuctionInfo = useCallback(async () => {
    try {
      // just use the first auction, for MVP
      const auctionStaticConfig = getAppConfig().spiceBazaar.spiceAuctions[0];

      if (!auctionStaticConfig) {
        throw new Error('No spice auctions found in config');
      }

      const currentEpoch = await getCurrentEpoch(auctionStaticConfig);
      const epochInfo = await getEpochInfo(
        auctionStaticConfig,
        Number(currentEpoch)
      );
      const currentEpochAuctionLive = await isCurrentEpochAuctionLive(
        auctionStaticConfig
      );
      const auctionConfig = await getAuctionConfig(auctionStaticConfig);

      if (!epochInfo) {
        return INITIAL_STATE.spiceAuctionInfo.data;
      }

      const totalBidTokenAmountNumber = fromAtto(epochInfo.totalBidTokenAmount);
      const totalAuctionTokenAmountNumber = fromAtto(
        epochInfo.totalAuctionTokenAmount
      );

      const priceRatio =
        totalBidTokenAmountNumber / totalAuctionTokenAmountNumber;

      const nextAuctionStartTimestamp = auctionConfig?.waitPeriod
        ? auctionConfig?.waitPeriod + fromAtto(epochInfo.endTime)
        : undefined;

      // const spiceAuctionContract = (await papi.getContract(
      //   auctionStaticConfig.contractConfig
      // )) as SpiceAuction;

      // TODO: Update to get from the auction config (duration)
      // TODO: Should not be needed.
      // const auctionDuration =
      //   await spiceAuctionContract.MAXIMUM_AUCTION_DURATION();
      // const auctionDurationNumber = auctionDuration * 1000;

      return {
        currentEpoch: Number(currentEpoch),
        name: 'Spice Auction',
        nextEpoch: Number(currentEpoch) + 1,
        currentEpochAuctionLive: currentEpochAuctionLive || false,
        auctionStartTime: new Date(
          epochInfo.startTime.toNumber() * 1000
        ).getTime(),
        auctionEndTime: new Date(epochInfo.endTime.toNumber() * 1000).getTime(),
        totalAuctionTokenAmount: fromAtto(epochInfo.totalAuctionTokenAmount),
        totalBidTokenAmount: fromAtto(epochInfo.totalBidTokenAmount),
        priceRatio: priceRatio,
        auctionDuration: 0, // TODO: Remove. Should not be needed.
        nextAuctionStartTimestamp,
        auctionTokenSymbol: auctionStaticConfig.auctionTokenSymbol,
        staticConfig: auctionStaticConfig,
      };
    } catch (err) {
      console.error('Error fetching auction info', err);
      return INITIAL_STATE.spiceAuctionInfo.data;
    }
  }, [
    getCurrentEpoch,
    getEpochInfo,
    isCurrentEpochAuctionLive,
    getAuctionConfig,
  ]);

  const {
    data: spiceAuctionInfo = INITIAL_STATE.spiceAuctionInfo.data,
    isLoading: spiceAuctionInfoLoading,
    refetch: refetchSpiceAuctionInfo,
  } = useQuery({
    queryKey: ['spiceAuctionInfo', wallet ? wallet : 'no-wallet'],
    queryFn: () => fetchAuctionInfo(),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    enabled: false, // automatic fetching disabled
  });

  useEffect(() => {
    refetchSpiceAuctionInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  // Create a wrapper for the refetch function to match the existing API
  const fetchSpiceAuctionInfo = useCallback(async (): Promise<void> => {
    await refetchSpiceAuctionInfo();
    return;
  }, [refetchSpiceAuctionInfo]);

  const spiceAuctionBid = useCallback(
    async (auctionStaticConfig: SpiceAuctionConfig, amount: string) => {
      if (!wallet || !signer) {
        console.debug(
          'Missing wallet or signer when trying to use SpiceAuction.'
        );
        return;
      }

      await switchNetwork(auctionStaticConfig.chainId);

      try {
        const tgldAmount = getBigNumberFromString(
          amount,
          getTokenInfo(TICKER_SYMBOL.TEMPLE_GOLD_TOKEN).decimals
        );

        const connectedSigner = getConnectedSigner();

        const templeGoldAddress = auctionStaticConfig.templeGoldToken.address;

        if (!templeGoldAddress) {
          throw new Error('Temple Gold address is not set');
        }

        console.log('setting allowance for');

        await ensureAllowanceWithSigner(
          TICKER_SYMBOL.TEMPLE_GOLD_TOKEN,
          templeGoldAddress,
          auctionStaticConfig.contractConfig.address,
          tgldAmount,
          true,
          connectedSigner
        );

        console.log('SET allowance for');

        const spiceAuctionContract = (await papi.getConnectedContract(
          auctionStaticConfig.contractConfig,
          connectedSigner
        )) as SpiceAuction;

        const populatedTransaction =
          await spiceAuctionContract.populateTransaction.bid(tgldAmount);

        const receipt = await estimateAndMine(
          connectedSigner,
          populatedTransaction
        );

        openNotification({
          title: `Bid ${amount} TGLD`,
          hash: receipt.transactionHash,
        });

        fetchSpiceAuctionInfo();
        updateBalance();
      } catch (err) {
        console.error('Error while bidding TGLD', {
          cause: err,
        });
        openNotification({
          title: 'Error bidding TGLD',
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
      fetchSpiceAuctionInfo,
      updateBalance,
    ]
  );

  const spiceAuctionClaim = useCallback(
    async (auctionStaticConfig: SpiceAuctionConfig, epoch: number) => {
      if (!wallet || !signer) {
        console.debug(
          'Missing wallet or signer when trying to use SpiceAuction.'
        );
        return;
      }

      await switchNetwork(auctionStaticConfig.chainId);

      try {
        const connectedSigner = getConnectedSigner();
        const spiceAuctionContract = (await papi.getConnectedContract(
          auctionStaticConfig.contractConfig,
          connectedSigner
        )) as SpiceAuction;

        const populatedTransaction =
          await spiceAuctionContract.populateTransaction.claim(epoch);
        const receipt = await estimateAndMine(
          connectedSigner,
          populatedTransaction
        );

        openNotification({
          title: `Claimed rewards from epoch ${epoch}`,
          hash: receipt.transactionHash,
        });

        fetchSpiceAuctionInfo();
        updateBalance();
      } catch (err) {
        console.error('Error while claiming rewards', {
          cause: err,
        });
        openNotification({
          title: 'Error claiming rewards',
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
      papi,
      openNotification,
      fetchSpiceAuctionInfo,
      updateBalance,
    ]
  );

  const fetchAuctionInfoFromSubgraph = useCallback(
    async (auctionStaticConfig: SpiceAuctionConfig) => {
      try {
        const response = await subgraphQuery(
          auctionStaticConfig.subgraphUrl,
          spiceAuctionInfoQuery(auctionStaticConfig.contractConfig.address)
        );

        return response;
      } catch (err) {
        console.error('Error fetching auction info from subgraph', err);
        return null;
      }
    },
    []
  );

  const getLatestAuctionFromSubgraphResponse = useCallback(
    (response: SpiceAuctionInfoResp) =>
      response.spiceAuction.auctionInstances.sort(
        (a, b) => Number(b.epoch) - Number(a.epoch)
      )[0],
    []
  );

  const fetchAuctionInfoForAuction = useCallback(
    async (auctionStaticConfig: SpiceAuctionConfig) => {
      try {
        const spiceAuctionDataFromSubgraph = await fetchAuctionInfoFromSubgraph(
          auctionStaticConfig
        );

        if (!spiceAuctionDataFromSubgraph) {
          return null;
        }

        const latestAuction = getLatestAuctionFromSubgraphResponse(
          spiceAuctionDataFromSubgraph
        );

        const spiceAuctionContract = (await papi.getContract(
          auctionStaticConfig.contractConfig
        )) as SpiceAuction;

        const currentEpoch = await BigNumber.from(
          await spiceAuctionContract.currentEpoch()
        );
        const epochInfo = await spiceAuctionContract.getEpochInfo(
          Number(currentEpoch)
        );

        // Check if auction is live
        const now = Date.now();
        const isActive =
          now >= epochInfo.startTime.toNumber() * 1000 &&
          now < epochInfo.endTime.toNumber() * 1000;

        if (!epochInfo) {
          return null;
        }

        const totalBidTokenAmountNumber = fromAtto(
          epochInfo.totalBidTokenAmount
        );
        const totalAuctionTokenAmountNumber = fromAtto(
          epochInfo.totalAuctionTokenAmount
        );

        const priceRatio =
          totalBidTokenAmountNumber / totalAuctionTokenAmountNumber;

        return {
          currentEpoch: Number(currentEpoch),
          name: auctionStaticConfig.name,
          address: auctionStaticConfig.contractConfig.address,
          nextEpoch: Number(currentEpoch) + 1,
          currentEpochAuctionLive: isActive,
          auctionStartTime: new Date(
            Number(latestAuction.startTime) * 1000
          ).getTime(),
          auctionEndTime: new Date(
            Number(latestAuction.endTime) * 1000
          ).getTime(),
          totalAuctionTokenAmount: fromAtto(epochInfo.totalAuctionTokenAmount),
          auctionTokenSymbol: auctionStaticConfig.auctionTokenSymbol,
          totalBidTokenAmount: fromAtto(epochInfo.totalBidTokenAmount),
          priceRatio: priceRatio,
          auctionDuration: 0, // TODO: Remove. Should not be needed.
          nextAuctionStartTimestamp: 0, // TODO: Remove. Should not be needed.
          staticConfig: auctionStaticConfig,
        };
      } catch (err) {
        console.error(
          `Error fetching auction info for ${auctionStaticConfig.name}:`,
          err
        );
        return null;
      }
    },
    [papi]
  );

  // Function to fetch all spice auctions
  const fetchAllSpiceAuctions = useCallback(async () => {
    try {
      const appConfig = getAppConfig();
      const spiceAuctionsConfig = appConfig.spiceBazaar?.spiceAuctions || [];

      if (!spiceAuctionsConfig || spiceAuctionsConfig.length === 0) {
        console.warn('No spice auctions found in config');
        return [];
      }

      // Fetch info for each auction in parallel
      const auctionPromises = spiceAuctionsConfig.map((auction) => {
        return fetchAuctionInfoForAuction(auction);
      });

      const results = await Promise.all(auctionPromises);

      // Filter out any failed fetches (nulls)
      return results.filter((result) => result !== null) as SpiceAuctionInfo[];
    } catch (err) {
      console.error('Error fetching all spice auctions:', err);
      return [];
    }
  }, [fetchAuctionInfoForAuction]);

  const {
    data: allSpiceAuctionsData = [],
    isLoading: allSpiceAuctionsLoading,
    refetch: refetchAllSpiceAuctions,
  } = useQuery({
    queryKey: ['allSpiceAuctions', wallet ? wallet : 'no-wallet'],
    queryFn: fetchAllSpiceAuctions,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    enabled: false, // automatic fetching disabled
  });

  useEffect(() => {
    refetchAllSpiceAuctions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  // Create a wrapper for the refetch function
  const fetchAllSpiceAuctionsInfo = useCallback(
    async (silent?: boolean): Promise<void> => {
      await refetchAllSpiceAuctions();
      return;
    },
    [refetchAllSpiceAuctions]
  );

  const getClaimableAtEpoch = useCallback(
    async (auctionInfo: SpiceAuctionInfo, epochId: number) => {
      if (
        !wallet ||
        !signer ||
        !auctionInfo.staticConfig.contractConfig.address
      ) {
        console.debug(
          'Missing wallet, signer, or auction config when trying to use Spice Auction.'
        );
        return 0;
      }

      try {
        const spiceAuction = (await papi.getContract(
          auctionInfo.staticConfig.contractConfig
        )) as SpiceAuction;

        const claimable = await spiceAuction.getClaimableForEpochs(wallet, [
          epochId,
        ]);
        return fromAtto(claimable[0].amount);
      } catch (error) {
        console.error('Error fetching claimable value:', error);
        throw error;
      }
    },
    [wallet, signer, papi]
  );

  const bridgeTgld = useCallback(
    async (
      amount: string,
      source: BridgeTGLDSource // TODO: Possible flexibility needed for other chains?
    ) => {
      try {
        if (!wallet || !signer) {
          console.debug(
            'Missing wallet or signer when trying to use Spice Auction.'
          );
          return;
        }

        const connectedSigner = getConnectedSigner();

        let sourceTgldContract = (await papi.getConnectedContract(
          getAppConfig().contracts.templeGold,
          connectedSigner
        )) as TempleGold;

        if (source === BridgeTGLDSource.ALTCHAIN_SOURCE) {
          sourceTgldContract = (await papi.getConnectedContract(
            getAppConfig().spiceBazaar.tgldBridge.altchainTgldTokenContract,
            connectedSigner
          )) as TempleGold;
        }

        let destinationChainId =
          getAppConfig().spiceBazaar.tgldBridge.altchainLayer0EndpointId;

        if (source === BridgeTGLDSource.ALTCHAIN_SOURCE) {
          destinationChainId =
            getAppConfig().spiceBazaar.tgldBridge.sourceLayer0EndpointId;
        }

        console.log('amount', amount);
        console.log('source', source);

        const tgldAmount = getBigNumberFromString(
          amount,
          getTokenInfo(TICKER_SYMBOL.TEMPLE_GOLD_TOKEN).decimals
        );

        console.log('tgldAmount', tgldAmount);
        console.log('destinationChainId', destinationChainId);

        const sendParam = {
          dstEid: destinationChainId,
          to: ethers.utils.hexZeroPad(wallet, 32),
          amountLD: tgldAmount,
          minAmountLD: ZERO,
          extraOptions: '0x',
          composeMsg: '0x',
          oftCmd: '0x',
        };

        console.log('sendParam', sendParam);

        const payInLzToken = false; // Paying in native token (e.g., ETH)

        const [nativeFee, lzTokenFee] = await sourceTgldContract.quoteSend(
          sendParam,
          payInLzToken
        );

        console.log('nativeFee', nativeFee);
        console.log('lzTokenFee', lzTokenFee);

        const refundAddress = wallet;
        console.log('refundAddress', refundAddress);

        const tx = await sourceTgldContract.send(
          sendParam,
          {
            nativeFee,
            lzTokenFee,
          },
          refundAddress,
          { value: nativeFee } // Sending the native fee
        );

        console.log(`Transaction hash: ${tx.hash}`);
        await tx.wait();

        openNotification({
          title: `Bridged ${amount} TGLD`,
          hash: '',
        });

        updateBalance();
      } catch (error) {
        openNotification({
          title: `Error bridging TGLD`,
          hash: '',
        });

        console.error('Error bridging TGLD:', error);
        throw error;
      }
    },
    [wallet, signer, getConnectedSigner, papi, openNotification, updateBalance]
  );

  const contextValue = useMemo(() => {
    const currentUserMetrics = currentUserMetricsData || {
      currentEpochBidAmount: 0,
    };

    return {
      spiceAuctionInfo: {
        data: spiceAuctionInfo,
        loading: spiceAuctionInfoLoading,
        fetch: fetchSpiceAuctionInfo,
      },
      spiceAuctions: {
        bid: spiceAuctionBid,
        claim: spiceAuctionClaim,
      },
      allSpiceAuctions: {
        data: allSpiceAuctionsData,
        loading: allSpiceAuctionsLoading,
        fetch: fetchAllSpiceAuctionsInfo,
      },
      currentUser: {
        data: currentUserMetrics,
        loading: currentUserMetricsLoading,
        fetch: (auctionStaticConfig?: SpiceAuctionConfig) => {
          if (!auctionStaticConfig) {
            return Promise.resolve({ currentEpochBidAmount: 0 });
          }
          return fetchUserMetrics(auctionStaticConfig);
        },
        getClaimableAtEpoch,
      },
      bridgeTgld,
    };
  }, [
    currentUserMetricsData,
    spiceAuctionInfo,
    spiceAuctionInfoLoading,
    fetchSpiceAuctionInfo,
    spiceAuctionBid,
    spiceAuctionClaim,
    allSpiceAuctionsData,
    allSpiceAuctionsLoading,
    fetchAllSpiceAuctionsInfo,
    currentUserMetricsLoading,
    getClaimableAtEpoch,
    bridgeTgld,
    fetchUserMetrics,
  ]);

  return (
    <SpiceAuctionContext.Provider value={contextValue}>
      {children}
    </SpiceAuctionContext.Provider>
  );
};

export const useSpiceAuction = () => useContext(SpiceAuctionContext);
