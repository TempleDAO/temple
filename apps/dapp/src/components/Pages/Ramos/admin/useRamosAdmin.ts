import { useEffect, useState, useCallback } from 'react';
import { BigNumber, ethers, Signer } from 'ethers';

import environmentConfig from 'constants/env';
import { useWallet } from 'providers/WalletProvider';

import {
  Ramos,
  Ramos__factory,
  IBalancerHelpers,
  IBalancerHelpers__factory,
  IBalancerVault__factory,
  ERC20__factory,
  ERC20,
  TreasuryReservesVault,
  TreasuryReservesVault__factory,
  RamosStrategy,
  RamosStrategy__factory,
  BalancerPoolHelper,
  BalancerPoolHelper__factory,
} from 'types/typechain';

import {
  applySlippage,
  calculateTargetPriceDown,
  calculateTargetPriceUp,
  formatExitRequestTuple,
  formatJoinRequestTuple,
  getBpsPercentageFromTpf,
  isTemple,
  makeExitRequest,
  makeJoinRequest,
  WeightedPoolExitKind,
} from './helpers';
import { ZERO } from 'utils/bigNumber';
import { DBN_TEN_THOUSAND, DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';

export function useRamosAdmin() {
  const {
    ramos: RAMOS_ADDRESS,
    ramosStrategy: RAMOS_STRATEGY_ADDRESS,
    ramosPoolHelper: RAMOS_POOL_HELPER_ADDRESS,
    balancerHelpers: BALANCER_HELPERS_ADDRESS,
    treasuryReservesVault: TRV_ADDRESS,
  } = environmentConfig.contracts;

  //internal state
  const { signer } = useWallet();
  const [tokens, setTokens] = useState({
    temple: { address: '', balance: DBN_ZERO },
    stable: { address: '', balance: DBN_ZERO },
  });
  const [bptToken, setBptToken] = useState<ERC20>();
  const [ramos, setRamos] = useState<Ramos>();
  const [ramosPoolHelper, setRamosPoolHelper] = useState<BalancerPoolHelper>();
  const [balPooltokensOrdered, setBalPooltokensOrdered] = useState<Array<string> | undefined>(undefined);
  const [ramosStrategy, setRamosStrategy] = useState<RamosStrategy>();
  const [trv, setTrv] = useState<TreasuryReservesVault>();
  const [balancerHelpers, setBalancerHelpers] = useState<IBalancerHelpers>();
  const [poolId, setPoolId] = useState<string>();
  const [tpf, setTpf] = useState<DecimalBigNumber>();
  const [templePrice, setTemplePrice] = useState<DecimalBigNumber>();
  const [totalAvailableDaiTrv, setTotalAvailableDaiTrv] = useState<DecimalBigNumber>();
  const [totalAvailableTempleTrv, setTotalAvailableTempleTrv] = useState<DecimalBigNumber>();
  const [ramosStrategyVersion, setRamosStrategyVersion] = useState<string>();
  const [percentageOfGapToClose, setPercentageOfGapToClose] = useState(100);
  const [maxRebalanceAmounts, setMaxRebalanceAmounts] = useState<{
    bpt: DecimalBigNumber;
    stable: DecimalBigNumber;
    temple: DecimalBigNumber;
  }>();
  const [percentageBounds, setPercentageBounds] = useState<{ up: DecimalBigNumber; down: DecimalBigNumber }>();
  const [slippageTolerance, setSlippageTolerance] = useState(0.1);

  const isConnected =
    ramos !== undefined &&
    ramosPoolHelper !== undefined &&
    ramosStrategy !== undefined &&
    trv !== undefined &&
    tokens.stable.balance.gt(DBN_ZERO) &&
    tokens.temple.balance.gt(DBN_ZERO) &&
    tokens.temple.address !== '' &&
    tokens.stable.address !== '' &&
    maxRebalanceAmounts !== undefined &&
    signer !== undefined &&
    poolId !== undefined &&
    balancerHelpers !== undefined &&
    tpf &&
    templePrice &&
    templePrice.gt(DBN_ZERO) &&
    percentageBounds &&
    bptToken !== undefined;


  // outputs
  const [rebalanceUpAmounts, setRebalanceUpAmounts] = useState<{ bptIn: BigNumber; amountOut: BigNumber }>();
  const [rebalanceDownAmounts, setRebalanceDownAmounts] = useState<{ amountIn: BigNumber; bptOut: BigNumber }>();
  const [depositStableAmounts, setDepositStableAmounts] = useState<{ amountIn: BigNumber; bptOut: BigNumber }>();
  const [withdrawStableAmounts, setWithdrawStableAmounts] = useState<{ amountOut: BigNumber; bptIn: BigNumber }>();

  const setContracts = useCallback(async (signer: Signer) => {
    const RAMOS_CONTRACT = new Ramos__factory(signer).attach(RAMOS_ADDRESS);
    const RAMOS_POOL_HELPER_CONTRACT = new BalancerPoolHelper__factory(signer).attach(RAMOS_POOL_HELPER_ADDRESS);
    const RAMOS_STRATEGY_CONTRACT = new RamosStrategy__factory(signer).attach(RAMOS_STRATEGY_ADDRESS);
    const TRV_CONTRACT = new TreasuryReservesVault__factory(signer).attach(TRV_ADDRESS);
    const POOL_ID = await RAMOS_CONTRACT.balancerPoolId();
    const BALANCER_VAULT_ADDRESS = await RAMOS_CONTRACT.balancerVault();
    const BALANCER_VAULT_CONTRACT = IBalancerVault__factory.connect(BALANCER_VAULT_ADDRESS, signer);
    const BALANCER_HELPERS_CONTRACT = IBalancerHelpers__factory.connect(BALANCER_HELPERS_ADDRESS, signer);
    const [tokenAddresses, balances] = await BALANCER_VAULT_CONTRACT.getPoolTokens(POOL_ID);
    const BPT_TOKEN_ADDRESS = await RAMOS_CONTRACT.bptToken();
    const BPT_TOKEN_CONTRACT = new ERC20__factory(signer).attach(BPT_TOKEN_ADDRESS);
    const TPF = await RAMOS_CONTRACT.treasuryPriceIndex(); // should be TPF, not TPI
    const MAX_REBALANCE_AMOUNTS = await RAMOS_CONTRACT.maxRebalanceAmounts();
    const PERCENTAGE_BOUND_LOW = await RAMOS_CONTRACT.rebalancePercentageBoundLow();
    const PERCENTAGE_BOUND_UP = await RAMOS_CONTRACT.rebalancePercentageBoundUp();

    setMaxRebalanceAmounts({
      temple: DecimalBigNumber.fromBN(MAX_REBALANCE_AMOUNTS.protocolToken, 18),
      stable: DecimalBigNumber.fromBN(MAX_REBALANCE_AMOUNTS.quoteToken, 18),
      bpt: DecimalBigNumber.fromBN(MAX_REBALANCE_AMOUNTS.bpt, 18),
    });
    setPercentageBounds({
      down: DecimalBigNumber.fromBN(PERCENTAGE_BOUND_LOW, 0),
      up: DecimalBigNumber.fromBN(PERCENTAGE_BOUND_UP, 0),
    });
    setRamos(RAMOS_CONTRACT);
    setRamosPoolHelper(RAMOS_POOL_HELPER_CONTRACT);
    setRamosStrategy(RAMOS_STRATEGY_CONTRACT);
    setTrv(TRV_CONTRACT);
    setPoolId(POOL_ID);
    setBalancerHelpers(BALANCER_HELPERS_CONTRACT);
    setTpf(DecimalBigNumber.fromBN(TPF, 18));

    setTokens(prev => {
      tokenAddresses.forEach((tokenAddr, index) => {
        if (isTemple(tokenAddr)) {
          prev.temple = { address: tokenAddr, balance: DecimalBigNumber.fromBN(balances[index], 18) };
        } else {
          prev.stable = { address: tokenAddr, balance: DecimalBigNumber.fromBN(balances[index], 18) };
        }
      });
      return {...prev};
    });
    setBptToken(BPT_TOKEN_CONTRACT);
  },[BALANCER_HELPERS_ADDRESS, RAMOS_ADDRESS, RAMOS_POOL_HELPER_ADDRESS, RAMOS_STRATEGY_ADDRESS, TRV_ADDRESS]);

  const calculateRebalanceUp = useCallback(async (bps: DecimalBigNumber) => {
    if (isConnected && balPooltokensOrdered && bps.gt(DBN_ZERO)) {
      const targetPrice = await calculateTargetPriceUp(templePrice, bps, ramos, percentageOfGapToClose);

      const templeBalanceAtTargetPrice = tokens.stable.balance.div(targetPrice, targetPrice.getDecimals());
      let templeAmountOut = tokens.temple.balance.sub(templeBalanceAtTargetPrice);

      if (templeAmountOut.gt(maxRebalanceAmounts.temple)) templeAmountOut = maxRebalanceAmounts.temple;

      const amountsOut = [templeAmountOut.toBN(18), ZERO];
      const exitRequest = makeExitRequest(
        balPooltokensOrdered,
        amountsOut,
        ethers.constants.MaxInt256,
        WeightedPoolExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT
      );

      const [bptIn, amounts] = await balancerHelpers.queryExit(poolId, ramos.address, ramos.address, exitRequest);
      return { bptIn, amountOut: applySlippage(amounts[0], slippageTolerance) };
    }
  },[balPooltokensOrdered, balancerHelpers, isConnected, maxRebalanceAmounts, percentageOfGapToClose, poolId, ramos, slippageTolerance, templePrice, tokens]);

  const calculateDepositStable = useCallback(async (bps: DecimalBigNumber) => {
    if (isConnected && balPooltokensOrdered && bps.gt(DBN_ZERO)) {
      const targetPrice = await calculateTargetPriceUp(templePrice, bps, ramos, percentageOfGapToClose);
      const stableAmountAtTargetPrice = tokens.temple.balance.mul(targetPrice);
      let stableAmount = stableAmountAtTargetPrice.sub(tokens.stable.balance);

      if (stableAmount.gt(maxRebalanceAmounts.stable)) stableAmount = maxRebalanceAmounts.stable;
      const amountsIn = [ZERO, stableAmount.toBN(18)];
      const joinPoolRequest = makeJoinRequest(balPooltokensOrdered, amountsIn);
      const amounts = await balancerHelpers.queryJoin(poolId, ramos.address, ramos.address, joinPoolRequest);
      return {
        amountIn: amounts.amountsIn[1],
        bptOut: applySlippage(amounts.bptOut, slippageTolerance),
      };
    }
  },[balPooltokensOrdered, balancerHelpers, isConnected, maxRebalanceAmounts, percentageOfGapToClose, poolId, ramos, slippageTolerance, templePrice, tokens]);

  const calculateRebalanceDown = useCallback(async (bps: DecimalBigNumber) => {
    if (!isConnected || !balPooltokensOrdered) return;
    const targetPrice = await calculateTargetPriceDown(templePrice, bps, ramos, percentageOfGapToClose);

    const templeBalanceAtTargetPrice = tokens.stable.balance.div(targetPrice, 18);
    let templeAmount = templeBalanceAtTargetPrice.sub(tokens.temple.balance);

    if (templeAmount.gt(maxRebalanceAmounts.temple)) templeAmount = maxRebalanceAmounts.temple;

    const initAmountsIn: BigNumber[] = [templeAmount.toBN(18), ZERO];
    const joinPoolRequest = makeJoinRequest(balPooltokensOrdered, initAmountsIn);
    const { amountsIn, bptOut } = await balancerHelpers.queryJoin(
      poolId,
      ramos.address,
      ramos.address,
      joinPoolRequest
    );

    return {
      amountIn: amountsIn[0],
      bptOut: applySlippage(bptOut, slippageTolerance),
    };
  },[balPooltokensOrdered, balancerHelpers, isConnected, maxRebalanceAmounts, percentageOfGapToClose, poolId, ramos, slippageTolerance, templePrice, tokens]);

  const calculateWithdrawStable = useCallback(async (bps: DecimalBigNumber) => {
    if (!isConnected || !balPooltokensOrdered) return;
    const targetPrice = await calculateTargetPriceDown(templePrice, bps, ramos, percentageOfGapToClose);

    const stableBalanceAtTargetPrice = tokens.temple.balance.mul(targetPrice);
    let stableAmount = tokens.stable.balance.sub(stableBalanceAtTargetPrice);

    if (stableAmount.gt(maxRebalanceAmounts.stable)) stableAmount = maxRebalanceAmounts.stable;

    const amountsOut = [ZERO, stableAmount.toBN(18)];
    const exitRequest = makeExitRequest(
      balPooltokensOrdered,
      amountsOut,
      ethers.constants.MaxInt256,
      WeightedPoolExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT
    );
    const amounts = await balancerHelpers.queryExit(poolId, ramos.address, ramos.address, exitRequest);

    return {
      amountOut: applySlippage(amounts.amountsOut[1], slippageTolerance),
      bptIn: amounts.bptIn,
    };
  },[balPooltokensOrdered, balancerHelpers, isConnected, maxRebalanceAmounts, percentageOfGapToClose, poolId, ramos, slippageTolerance, templePrice, tokens]);

  const calculateRecommendedAmounts = useCallback(async () => {
    if (!isConnected || !balPooltokensOrdered) return;
    if (templePrice.gt(tpf)) {
      setRebalanceUpAmounts({ amountOut: ZERO, bptIn: ZERO });
      setDepositStableAmounts({ amountIn: ZERO, bptOut: ZERO });
      // account for percentage bounds
      const tpfRangeAdjusted = tpf.add(tpf.mul(percentageBounds.up).div(DBN_TEN_THOUSAND, tpf.getDecimals()));
      if (templePrice.gt(tpfRangeAdjusted)) {
        const basisPointsDiff = getBpsPercentageFromTpf(tpfRangeAdjusted, templePrice);
        const withdrawStable = await calculateWithdrawStable(basisPointsDiff);
        const rebalanceDown = await calculateRebalanceDown(basisPointsDiff);
        withdrawStable && setWithdrawStableAmounts(withdrawStable);
        rebalanceDown && setRebalanceDownAmounts(rebalanceDown);
      } else {
        setWithdrawStableAmounts({ amountOut: ZERO, bptIn: ZERO });
        setRebalanceDownAmounts({ amountIn: ZERO, bptOut: ZERO });
      }
    } else if (tpf.gt(templePrice)) {
      setWithdrawStableAmounts({ amountOut: ZERO, bptIn: ZERO });
      setRebalanceDownAmounts({ amountIn: ZERO, bptOut: ZERO });
      // account for percentage bounds
      const tpfRangeAdjusted = tpf.sub(tpf.mul(percentageBounds.down).div(DBN_TEN_THOUSAND, tpf.getDecimals()));
      if (tpfRangeAdjusted.gt(templePrice)) {
        const basisPointsDiff = getBpsPercentageFromTpf(tpfRangeAdjusted, templePrice);
        const rebalanceUp = await calculateRebalanceUp(basisPointsDiff);
        const depositStable = await calculateDepositStable(basisPointsDiff);

        depositStable && setDepositStableAmounts(depositStable);
        rebalanceUp && setRebalanceUpAmounts(rebalanceUp);
      } else {
        setRebalanceUpAmounts({ amountOut: ZERO, bptIn: ZERO });
        setDepositStableAmounts({ amountIn: ZERO, bptOut: ZERO });
      }
    }
  },[balPooltokensOrdered, calculateDepositStable, calculateRebalanceDown, calculateRebalanceUp, calculateWithdrawStable, isConnected, percentageBounds, templePrice, tpf]);

  const setTrvTotalAvailable = useCallback(async () => {
    if (!isConnected) return;
    const tDai = await trv.totalAvailable(tokens.stable.address);
    const tTemple = await trv.totalAvailable(tokens.temple.address);
    setTotalAvailableDaiTrv(DecimalBigNumber.fromBN(tDai, 18));
    setTotalAvailableTempleTrv(DecimalBigNumber.fromBN(tTemple, 18));
  },[isConnected, tokens, trv]);

  useEffect(() => {
    if (!signer) return;
    setContracts(signer);
  }, [signer, setContracts]);

  useEffect(() => {
    if (tokens.temple.balance.gt(DBN_ZERO) && tokens.stable.balance.gt(DBN_ZERO)) {
      setTemplePrice(tokens.stable.balance.div(tokens.temple.balance, 18));
    }
  },[tokens]);

  useEffect(() => {
    if (!isConnected) return;
    const initProtocolTokenIndex = async () => {
      const protIndexBal = await ramosPoolHelper.protocolTokenIndexInBalancerPool();
      setBalPooltokensOrdered(
        protIndexBal.toNumber() == 1
          ? [tokens.stable.address, tokens.temple.address]
          : [tokens.temple.address, tokens.stable.address]
      );
    };
    const initRamosStrategyVersion = async () => { 
      const rsVersion = await ramosStrategy.strategyVersion();
      setRamosStrategyVersion(rsVersion);
    }
    initProtocolTokenIndex();
    setTrvTotalAvailable();
    initRamosStrategyVersion();
  }, [isConnected, ramosPoolHelper, tokens, setTrvTotalAvailable, ramosStrategy]);

  useEffect(() => {
    if(!balPooltokensOrdered) return;
    (async ()=> await calculateRecommendedAmounts())();
  }, [balPooltokensOrdered, calculateRecommendedAmounts])

  const handleAddLiquidityInput = async (stableAmount: DecimalBigNumber) => {
    let templeAmount = DBN_ZERO;
    if (isConnected) {
      templeAmount = stableAmount.div(templePrice, stableAmount.getDecimals());
    }
    return { templeAmount: templeAmount, stableAmount: stableAmount };
  };

  const createJoinPoolRequest = async (templeAmount: BigNumber, stableAmount: BigNumber) => {
    if (isConnected) {
      const proportionalAddLiquidityQuote = await ramosStrategy.callStatic.proportionalAddLiquidityQuote(
        stableAmount,
        slippageTolerance
      );
      const reqDataQuote = proportionalAddLiquidityQuote.requestData;
      const tokenAddrs = reqDataQuote.assets;

      const initJoinReq = makeJoinRequest(tokenAddrs, reqDataQuote.maxAmountsIn);
      const { amountsIn, bptOut } = await balancerHelpers.queryJoin(poolId, ramos.address, ramos.address, initJoinReq);
      const joinPoolRequest = makeJoinRequest(tokenAddrs, amountsIn);
      return {
        joinPoolRequest: formatJoinRequestTuple(joinPoolRequest),
        minBptOut: applySlippage(bptOut, slippageTolerance).toString(),
      };
    }
  };

  const createExitPoolRequest = async (exitAmountBpt: BigNumber) => {
    if (!isConnected || !balPooltokensOrdered) return;
    const initExitReq = makeExitRequest(
      balPooltokensOrdered,
      [ZERO, ZERO],
      exitAmountBpt,
      WeightedPoolExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT
    );
    const { bptIn, amountsOut } = await balancerHelpers.queryExit(poolId, ramos.address, ramos.address, initExitReq);

    const minAmountsOut = [
      applySlippage(amountsOut[0], slippageTolerance),
      applySlippage(amountsOut[1], slippageTolerance),
    ];

    const exitRequest = makeExitRequest(
      balPooltokensOrdered,
      minAmountsOut,
      bptIn,
      WeightedPoolExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT
    );
    return formatExitRequestTuple(exitRequest);
  };

  const createDepositAndStakeRequest = async (bptAmountIn: DecimalBigNumber) => {
    if (isConnected) {
      const amountInContract = await bptToken.balanceOf(ramos.address);
      const bnAmount = bptAmountIn.toBN(bptAmountIn.getDecimals());
      return {
        bptAmountIn: bnAmount,
        useContractBalance: bnAmount.lte(amountInContract),
      };
    }
  };

  return {
    tpf,
    templePrice,
    percentageOfGapToClose,
    rebalanceUpAmounts,
    rebalanceDownAmounts,
    depositStableAmounts,
    withdrawStableAmounts,
    totalAvailableDaiTrv,
    totalAvailableTempleTrv,
    ramosStrategyVersion,
    slippageTolerance,
    createJoinPoolRequest,
    handleAddLiquidityInput,
    createExitPoolRequest,
    createDepositAndStakeRequest,
    setPercentageOfGapToClose,
    setSlippageTolerance,
    calculateRecommendedAmounts,
  };
}
