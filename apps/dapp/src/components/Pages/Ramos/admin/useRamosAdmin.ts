import { useEffect, useState } from 'react';
import { BigNumber, ethers } from 'ethers';

import environmentConfig from 'constants/env';
import { useWallet } from 'providers/WalletProvider';

import {
  RAMOS,
  RAMOS__factory,
  IBalancerHelpers,
  IBalancerHelpers__factory,
  AMO__IBalancerVault__factory,
  ERC20__factory,
  ERC20,
} from 'types/typechain';

import {
  calculateTargetPriceDown,
  calculateTargetPriceUp,
  formatExitRequestTuple,
  formatJoinRequestTuple,
  getBpsPercentageFromTpf,
  isTemple,
  makeExitRequest,
  makeJoinRequest,
  randomize,
} from './helpers';
import { ZERO } from 'utils/bigNumber';
import { DBN_TEN_THOUSAND, DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';

export function useRamosAdmin() {
  const { ramos: RAMOS_ADDRESS, balancerHelpers: BALANCER_HELPERS_ADDRESS } = environmentConfig.contracts;

  //internal state
  const { signer } = useWallet();
  const [tokens, setTokens] = useState({
    temple: { address: '', balance: DBN_ZERO },
    stable: { address: '', balance: DBN_ZERO },
  });
  const [bptToken, setBptToken] = useState<ERC20>();
  const [ramos, setRamos] = useState<RAMOS>();
  const [balancerHelpers, setBalancerHelpers] = useState<IBalancerHelpers>();
  const [poolId, setPoolId] = useState<string>();
  const [tpf, setTpf] = useState<DecimalBigNumber>();
  const [templePrice, setTemplePrice] = useState<DecimalBigNumber>();
  const [randomPercent, setRandomPercent] = useState<number>(50);
  const [maxRebalanceAmounts, setMaxRebalanceAmounts] =
    useState<{ bpt: DecimalBigNumber; stable: DecimalBigNumber; temple: DecimalBigNumber }>();
  const [percentageBounds, setPercentageBounds] = useState<{ up: DecimalBigNumber; down: DecimalBigNumber }>();

  const isConnected =
    ramos &&
    tokens.stable.balance.gt(DBN_ZERO) &&
    tokens.temple.balance.gt(DBN_ZERO) &&
    tokens.temple.address !== '' &&
    tokens.stable.address !== '' &&
    maxRebalanceAmounts &&
    signer &&
    poolId &&
    balancerHelpers &&
    tpf &&
    templePrice &&
    templePrice.gt(DBN_ZERO) &&
    percentageBounds &&
    bptToken;

  // outputs
  const [rebalanceUpToTpf, setRebalanceUpToTpf] = useState<{ bptIn: BigNumber; amountOut: BigNumber }>();
  const [rebalanceDownToTpf, setRebalanceDownToTpf] = useState<{ amountIn: BigNumber; bptOut: BigNumber }>();
  const [depositStableUpToTpf, setDepositStableUpToTpf] = useState<{ amountIn: BigNumber; bptOut: BigNumber }>();
  const [withdrawStableToTpf, setWithdrawStableToTpf] = useState<{ amountOut: BigNumber; bptIn: BigNumber }>();

  useEffect(() => {
    async function setContracts() {
      if (signer) {
        const RAMOS_CONTRACT = new RAMOS__factory(signer).attach(RAMOS_ADDRESS);
        const POOL_ID = await RAMOS_CONTRACT.balancerPoolId();
        const BALANCER_VAULT_ADDRESS = await RAMOS_CONTRACT.balancerVault();
        const BALANCER_VAULT_CONTRACT = AMO__IBalancerVault__factory.connect(BALANCER_VAULT_ADDRESS, signer);
        const BALANCER_HELPERS_CONTRACT = IBalancerHelpers__factory.connect(BALANCER_HELPERS_ADDRESS, signer);
        const [tokenAddresses, balances] = await BALANCER_VAULT_CONTRACT.getPoolTokens(POOL_ID);
        const BPT_TOKEN_ADDRESS = await RAMOS_CONTRACT.bptToken();
        const BPT_TOKEN_CONTRACT = new ERC20__factory(signer).attach(BPT_TOKEN_ADDRESS);
        const TPF = await RAMOS_CONTRACT.templePriceFloorNumerator();
        const MAX_REBALANCE_AMOUNTS = await RAMOS_CONTRACT.maxRebalanceAmounts();
        const PERCENTAGE_BOUND_LOW = await RAMOS_CONTRACT.rebalancePercentageBoundLow();
        const PERCENTAGE_BOUND_UP = await RAMOS_CONTRACT.rebalancePercentageBoundUp();

        setMaxRebalanceAmounts({
          temple: DecimalBigNumber.fromBN(MAX_REBALANCE_AMOUNTS.temple, 18),
          stable: DecimalBigNumber.fromBN(MAX_REBALANCE_AMOUNTS.stable, 18),
          bpt: DecimalBigNumber.fromBN(MAX_REBALANCE_AMOUNTS.bpt, 18),
        });
        setPercentageBounds({
          down: DecimalBigNumber.fromBN(PERCENTAGE_BOUND_LOW, 0),
          up: DecimalBigNumber.fromBN(PERCENTAGE_BOUND_UP, 0),
        });
        setRamos(RAMOS_CONTRACT);
        setPoolId(POOL_ID);
        setBalancerHelpers(BALANCER_HELPERS_CONTRACT);
        setTpf(DecimalBigNumber.fromBN(TPF, 4));
        const tempTokens = { ...tokens };
        tokenAddresses.forEach((tokenAddr, index) => {
          if (isTemple(tokenAddr)) {
            tempTokens.temple = { address: tokenAddr, balance: DecimalBigNumber.fromBN(balances[index], 18) };
          } else {
            tempTokens.stable = { address: tokenAddr, balance: DecimalBigNumber.fromBN(balances[index], 18) };
          }
        });
        setTokens(tempTokens);
        setBptToken(BPT_TOKEN_CONTRACT);
      }
    }
    setContracts();
  }, [signer]);

  useEffect(() => {
    if (tokens.temple.balance.gt(DBN_ZERO) && tokens.stable.balance.gt(DBN_ZERO)) {
      setTemplePrice(tokens.stable.balance.div(tokens.temple.balance, 18));
    }
  }, [tokens]);

  useEffect(() => {
    const setInitAmounts = async () => await calculateRecommendedAmounts();
    setInitAmounts();
  }, [isConnected]);

  const createJoinPoolRequest = async (templeAmount: BigNumber, stableAmount: BigNumber) => {
    if (isConnected) {
      const tokenAddrs = [tokens.temple.address, tokens.stable.address];
      const initJoinReq = makeJoinRequest(tokenAddrs, [templeAmount, stableAmount]);
      const { amountsIn, bptOut } = await balancerHelpers.queryJoin(poolId, ramos.address, ramos.address, initJoinReq);
      const joinPoolRequest = makeJoinRequest(tokenAddrs, amountsIn);
      return {
        joinPoolRequest: formatJoinRequestTuple(joinPoolRequest),
        minBptOut: bptOut.toString(),
      };
    }
  };

  const createExitPoolRequest = async (exitAmountBpt: BigNumber) => {
    if (isConnected) {
      const tokenAddrs = [tokens.temple.address, tokens.stable.address];
      const initExitReq = makeExitRequest(tokenAddrs, [ZERO, ZERO], exitAmountBpt);
      const { bptIn, amountsOut } = await balancerHelpers.queryExit(poolId, ramos.address, ramos.address, initExitReq);
      const exitRequest = makeExitRequest(tokenAddrs, amountsOut, bptIn);
      return formatExitRequestTuple(exitRequest);
    }
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

  const calculateRebalanceUp = async (bps: DecimalBigNumber) => {
    if (isConnected && bps.gt(DBN_ZERO)) {
      const targetPrice = calculateTargetPriceUp(templePrice, bps);

      const stableBalanceAtTargetPrice = tokens.stable.balance
        .mul(DBN_TEN_THOUSAND)
        .div(targetPrice.mul(DBN_TEN_THOUSAND), targetPrice.getDecimals());

      let templeAmountOut = tokens.temple.balance.sub(stableBalanceAtTargetPrice);
      if (templeAmountOut.gt(maxRebalanceAmounts.temple)) templeAmountOut = maxRebalanceAmounts.temple;
      templeAmountOut = randomize(templeAmountOut, randomPercent);

      const amountsOut = [templeAmountOut.toBN(18), ZERO];

      const exitRequest = makeExitRequest(
        [tokens.temple.address, tokens.stable.address],
        amountsOut,
        ethers.constants.MaxInt256,
        2
      );

      const [bptIn, amounts] = await balancerHelpers.queryExit(poolId, ramos.address, ramos.address, exitRequest);
      return { bptIn, amountOut: amounts[0] };
    }
  };

  const calculateDepositStable = async (bps: DecimalBigNumber) => {
    if (isConnected && bps.gt(DBN_ZERO)) {
      const targetPrice = calculateTargetPriceUp(templePrice, bps);
      let stableAmount = tokens.temple.balance
        .mul(targetPrice.mul(DBN_TEN_THOUSAND))
        .div(DBN_TEN_THOUSAND, targetPrice.getDecimals())
        .sub(tokens.stable.balance);

      if (stableAmount.gt(maxRebalanceAmounts.stable)) stableAmount = maxRebalanceAmounts.stable;
      stableAmount = randomize(stableAmount, randomPercent);
      const amountsIn = [ZERO, stableAmount.toBN(18)];
      const joinPoolRequest = makeJoinRequest([tokens.temple.address, tokens.stable.address], amountsIn);
      const amounts = await balancerHelpers.queryJoin(poolId, ramos.address, ramos.address, joinPoolRequest);
      return {
        amountIn: amounts.amountsIn[1],
        bptOut: amounts.bptOut,
      };
    }
  };

  const calculateRebalanceDown = async (bps: DecimalBigNumber) => {
    if (isConnected) {
      const targetPrice = calculateTargetPriceDown(templePrice, bps);
      const stableBalanceAtTargetPrice = tokens.stable.balance.div(targetPrice, 18);
      let templeAmount = stableBalanceAtTargetPrice.sub(tokens.temple.balance);
      if (templeAmount.gt(maxRebalanceAmounts.temple)) templeAmount = maxRebalanceAmounts.temple;
      templeAmount = randomize(templeAmount, randomPercent);
      const initAmountsIn: BigNumber[] = [templeAmount.toBN(18), ZERO];
      const joinPoolRequest = makeJoinRequest([tokens.temple.address, tokens.stable.address], initAmountsIn);
      const { amountsIn, bptOut } = await balancerHelpers.queryJoin(
        poolId,
        ramos.address,
        ramos.address,
        joinPoolRequest
      );

      return {
        amountIn: amountsIn[0],
        bptOut: bptOut,
      };
    }
  };

  const calculateWithdrawStable = async (bps: DecimalBigNumber) => {
    if (isConnected) {
      const targetPrice = calculateTargetPriceDown(templePrice, bps);
      let stableAmount = tokens.stable.balance.sub(
        tokens.temple.balance.mul(targetPrice.mul(DBN_TEN_THOUSAND)).div(DBN_TEN_THOUSAND, 18)
      );
      if (stableAmount.gt(maxRebalanceAmounts.stable)) stableAmount = maxRebalanceAmounts.stable;
      stableAmount = randomize(stableAmount, randomPercent);
      const amountsOut = [ZERO, stableAmount.toBN(18).abs()];
      const exitRequest = makeExitRequest(
        [tokens.temple.address, tokens.stable.address],
        amountsOut,
        ethers.constants.MaxInt256,
        2
      );
      const amounts = await balancerHelpers.queryExit(poolId, ramos.address, ramos.address, exitRequest);

      return {
        amountOut: amounts.amountsOut[1],
        bptIn: amounts.bptIn,
      };
    }
  };

  const calculateRecommendedAmounts = async () => {
    if (isConnected) {
      if (templePrice.gt(tpf)) {
        setRebalanceUpToTpf({ amountOut: ZERO, bptIn: ZERO });
        setDepositStableUpToTpf({ amountIn: ZERO, bptOut: ZERO });
        // account for percentage bounds
        const tpfRangeAdjusted = tpf.add(tpf.mul(percentageBounds.up).div(DBN_TEN_THOUSAND, tpf.getDecimals()));
        if (templePrice.gt(tpfRangeAdjusted)) {
          const basisPointsDiff = getBpsPercentageFromTpf(tpfRangeAdjusted, templePrice);
          const withdrawStable = await calculateWithdrawStable(basisPointsDiff);
          const rebalanceDown = await calculateRebalanceDown(basisPointsDiff);
          withdrawStable && setWithdrawStableToTpf(withdrawStable);
          rebalanceDown && setRebalanceDownToTpf(rebalanceDown);
        } else {
          setWithdrawStableToTpf({ amountOut: ZERO, bptIn: ZERO });
          setRebalanceDownToTpf({ amountIn: ZERO, bptOut: ZERO });
        }
      } else if (tpf.gt(templePrice)) {
        setWithdrawStableToTpf({ amountOut: ZERO, bptIn: ZERO });
        setRebalanceDownToTpf({ amountIn: ZERO, bptOut: ZERO });
        // account for percentage bounds
        const tpfRangeAdjusted = tpf.sub(tpf.mul(percentageBounds.down).div(DBN_TEN_THOUSAND, tpf.getDecimals()));
        if (tpfRangeAdjusted.gt(templePrice)) {
          const basisPointsDiff = getBpsPercentageFromTpf(tpfRangeAdjusted, templePrice);
          const depositStable = await calculateDepositStable(basisPointsDiff);
          const rebalanceUp = await calculateRebalanceUp(basisPointsDiff);
          depositStable && setDepositStableUpToTpf(depositStable);
          rebalanceUp && setRebalanceUpToTpf(rebalanceUp);
        } else {
          setRebalanceUpToTpf({ amountOut: ZERO, bptIn: ZERO });
          setDepositStableUpToTpf({ amountIn: ZERO, bptOut: ZERO });
        }
      }
    }
  };

  return {
    tpf,
    templePrice,
    calculateRebalanceUp,
    rebalanceUpToTpf,
    calculateRebalanceDown,
    rebalanceDownToTpf,
    calculateDepositStable,
    calculateRecommendedAmounts,
    depositStableUpToTpf,
    calculateWithdrawStable,
    withdrawStableToTpf,
    createJoinPoolRequest,
    createExitPoolRequest,
    tokens,
    randomPercent,
    setRandomPercent,
    createDepositAndStakeRequest,
  };
}