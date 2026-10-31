import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import {
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { useConnectWallet } from '@web3-onboard/react';
import { useWallet } from 'providers/WalletProvider';
import { useNotification } from 'providers/NotificationProvider';
import { useApiManager } from 'hooks/use-api-manager';
import { getAppConfig } from 'constants/newenv';
import type {
  Auction,
  Balances,
  IndexerStatus,
  Pair,
  Position,
  SetWishRequest,
  StakingSummary,
  Token,
  TxReceipt,
  Wish,
} from 'components/Pages/Core/DappPages/Granary/data/types';
import {
  GranaryDataSource,
  GranaryError,
  GranaryErrorCode,
} from 'components/Pages/Core/DappPages/Granary/data/source';
import {
  createLiveSource,
  GranaryWallet,
} from 'components/Pages/Core/DappPages/Granary/data/liveSource';
import {
  auctionName,
  fmt,
} from 'components/Pages/Core/DappPages/Granary/data/derive';

// State and actions for the Temple Granary: FixedPriceAuction deposits and
// claims, and WishingWell wishes. Screens read it through the hooks in
// Granary/data/hooks.ts.
//
// All data comes from a GranaryDataSource: today liveSource.ts, reading the
// contracts in getAppConfig().granary (Sepolia on test, mainnet on prod).

export type GranaryQuery<T> = {
  data: T;
  // first load only; background refetches keep showing the last data
  isLoading: boolean;
  isError: boolean;
};

export type GranaryActions = {
  // Each resolves true once the transaction is mined, false if it failed or
  // needed a wallet first. Failures are shown as a notification.
  deposit: (auction: Auction, amount: string) => Promise<boolean>;
  withdrawDeposit: (
    auction: Auction,
    amount: string | 'all'
  ) => Promise<boolean>;
  claim: (auction: Auction) => Promise<boolean>;
  withdrawExcluded: (auction: Auction) => Promise<boolean>;
  setWish: (req: SetWishRequest) => Promise<boolean>;
  revokeWish: (wish: Wish) => Promise<boolean>;
};

type GranaryContextValue = {
  source: GranaryDataSource;
  account: string | undefined;
  connect: () => void;
  auctions: GranaryQuery<Auction[]>;
  pairs: GranaryQuery<Pair[]>;
  wishTokens: GranaryQuery<Token[]>;
  indexerStatus: GranaryQuery<IndexerStatus | undefined>;
  positions: GranaryQuery<Position[]>;
  wishes: GranaryQuery<Wish[]>;
  balances: GranaryQuery<Balances>;
  staking: GranaryQuery<StakingSummary | undefined>;
  actions: GranaryActions;
};

const GranaryContext = createContext<GranaryContextValue | null>(null);

export const granaryKeys = {
  all: ['granary'] as const,
  auctions: () => ['granary', 'auctions'] as const,
  pairs: () => ['granary', 'pairs'] as const,
  wishTokens: () => ['granary', 'wishTokens'] as const,
  indexerStatus: () => ['granary', 'indexerStatus'] as const,
  account: (account?: string) => ['granary', 'account', account] as const,
  positions: (account?: string) =>
    [...granaryKeys.account(account), 'positions'] as const,
  wishes: (account?: string) =>
    [...granaryKeys.account(account), 'wishes'] as const,
  balances: (account?: string) =>
    [...granaryKeys.account(account), 'balances'] as const,
  staking: (account?: string) =>
    [...granaryKeys.account(account), 'staking'] as const,
  claimable: (account: string | undefined, auctionId: string) =>
    [...granaryKeys.account(account), 'claimable', auctionId] as const,
};

const INDEXER_POLL_MS = 60_000;

const ERROR_TEXT: Record<GranaryErrorCode, string> = {
  InvalidPhase: 'The auction has moved to another phase',
  IsPaused: 'The auction is paused',
  FlaggedAccount: 'This wallet cannot take part',
  DepositBelowMinimum: 'Below the minimum deposit',
  InsufficientBalance: 'Not enough balance',
  AlreadyClaimed: 'Already claimed',
  NothingToClaim: 'Nothing to claim',
  ExpectedNonZero: 'Enter an amount',
  InvalidAmount: 'Check the amount',
  NotDeployed: 'Not deployed on this network yet',
  WrongNetwork: 'Switch your wallet to the Granary network',
  UserRejected: 'Transaction rejected',
};

const toQuery = <T,>(q: UseQueryResult<T>, fallback: T): GranaryQuery<T> => ({
  data: q.data ?? fallback,
  isLoading: q.isInitialLoading,
  isError: q.isError,
});

const EMPTY: never[] = [];

export const GranaryProvider = ({ children }: PropsWithChildren) => {
  const {
    wallet: account,
    switchNetwork,
    getConnectedSigner,
    ensureAllowanceWithSigner,
  } = useWallet();
  const { papi } = useApiManager();

  // The source asks for the wallet when it sends; keep the latest callbacks.
  const config = getAppConfig();
  const wallet = useRef<GranaryWallet>();
  wallet.current = {
    getSigner: async () => {
      await switchNetwork(config.granary.chainId);
      const signer = getConnectedSigner();
      if ((await signer.getChainId()) !== config.granary.chainId)
        throw new GranaryError('WrongNetwork');
      return signer;
    },
    ensureAllowance: (symbol, token, spender, amount, signer) =>
      ensureAllowanceWithSigner(symbol, token, spender, amount, true, signer),
  };
  const source = useMemo(
    () =>
      createLiveSource({
        papi,
        config: config.granary,
        tokens: Object.values(config.tokens).filter(
          (t): t is NonNullable<typeof t> => !!t
        ),
        staking: config.contracts.templeGoldStaking,
        getWallet: () => {
          if (!wallet.current) throw new Error('No wallet');
          return wallet.current;
        },
      }),
    // the config is static per build
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [papi]
  );
  const [, connectWallet] = useConnectWallet();
  const { openNotification } = useNotification();
  const queryClient = useQueryClient();
  const connect = useCallback(() => {
    connectWallet();
  }, [connectWallet]);

  /* ---------- reads ---------- */

  const indexerOpts = {
    staleTime: 30_000,
    refetchInterval: INDEXER_POLL_MS,
    refetchOnWindowFocus: false,
  };
  const accountOpts = {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: !!account,
  };

  const auctions = useQuery({
    queryKey: granaryKeys.auctions(),
    queryFn: () => source.getAuctions(),
    ...indexerOpts,
  });
  const pairs = useQuery({
    queryKey: granaryKeys.pairs(),
    queryFn: () => source.getPairs(),
    ...indexerOpts,
  });
  const wishTokens = useQuery({
    queryKey: granaryKeys.wishTokens(),
    queryFn: () => source.getWishTokens(),
    ...indexerOpts,
  });
  const indexerStatus = useQuery({
    queryKey: granaryKeys.indexerStatus(),
    queryFn: () => source.getIndexerStatus(),
    ...indexerOpts,
  });
  const positions = useQuery({
    queryKey: granaryKeys.positions(account),
    queryFn: () => source.getPositions(account as string),
    ...accountOpts,
  });
  const wishes = useQuery({
    queryKey: granaryKeys.wishes(account),
    queryFn: () => source.getWishes(account as string),
    ...accountOpts,
  });
  const balances = useQuery({
    queryKey: granaryKeys.balances(account),
    queryFn: () => source.getBalances(account as string),
    ...accountOpts,
  });
  const staking = useQuery({
    queryKey: granaryKeys.staking(account),
    queryFn: () => source.getStaking(account as string),
    ...accountOpts,
  });

  /* ---------- writes ---------- */

  // Runs one write: wallet check, the transaction, a notification, then a refetch.
  const run = useCallback(
    async (
      label: { ok: string; fail: string },
      send: (account: string) => Promise<TxReceipt>
    ) => {
      if (!account) {
        connect();
        return false;
      }
      try {
        const { hash } = await send(account);
        openNotification({ title: label.ok, hash });
        return true;
      } catch (err) {
        console.error(label.fail, err);
        const reason =
          err instanceof GranaryError ? ERROR_TEXT[err.code] : undefined;
        openNotification({
          title: reason ? `${label.fail}: ${reason}` : label.fail,
          hash: `error-${Date.now()}`,
          isError: true,
        });
        return false;
      } finally {
        await queryClient.invalidateQueries(granaryKeys.all);
      }
    },
    [account, connect, openNotification, queryClient]
  );

  const actions = useMemo<GranaryActions>(
    () => ({
      deposit: (a, amount) =>
        run(
          {
            ok: `Deposited ${fmt(Number(amount))} ${
              a.bidToken
            } into ${auctionName(a)}`,
            fail: `Error depositing into ${auctionName(a)}`,
          },
          (acc) => source.deposit(acc, a, amount)
        ),
      withdrawDeposit: (a, amount) =>
        run(
          {
            ok:
              amount === 'all'
                ? `Withdrew your deposit from ${auctionName(a)}`
                : `Withdrew ${fmt(Number(amount))} ${
                    a.bidToken
                  } from ${auctionName(a)}`,
            fail: `Error withdrawing from ${auctionName(a)}`,
          },
          (acc) => source.withdrawDeposit(acc, a, amount)
        ),
      claim: (a) =>
        run(
          {
            ok: `Claimed from ${auctionName(a)}`,
            fail: `Error claiming from ${auctionName(a)}`,
          },
          (acc) => source.claim(acc, a)
        ),
      withdrawExcluded: (a) =>
        run(
          {
            ok: `Withdrew your excluded deposit from ${auctionName(a)}`,
            fail: `Error withdrawing from ${auctionName(a)}`,
          },
          (acc) => source.withdrawExcluded(acc, a)
        ),
      setWish: (req) =>
        run(
          {
            ok: `Wish made: ${fmt(Number(req.amount))} ${req.give} → ${
              req.get
            }`,
            fail: 'Error making wish',
          },
          (acc) => source.setWish(acc, req)
        ),
      revokeWish: (w) =>
        run(
          {
            ok: `Wish removed: ${w.give} → ${w.get}`,
            fail: 'Error removing wish',
          },
          (acc) => source.revokeWish(acc, w)
        ),
    }),
    [run, source]
  );

  const value: GranaryContextValue = {
    source,
    account,
    connect,
    auctions: toQuery(auctions, EMPTY),
    pairs: toQuery(pairs, EMPTY),
    wishTokens: toQuery(wishTokens, EMPTY),
    indexerStatus: toQuery(indexerStatus, undefined),
    positions: toQuery(positions, EMPTY),
    wishes: toQuery(wishes, EMPTY),
    balances: toQuery(balances, {}),
    staking: toQuery(staking, undefined),
    actions,
  };

  return (
    <GranaryContext.Provider value={value}>{children}</GranaryContext.Provider>
  );
};

export const useGranary = () => {
  const ctx = useContext(GranaryContext);
  if (!ctx) throw new Error('useGranary must be used inside GranaryProvider');
  return ctx;
};
