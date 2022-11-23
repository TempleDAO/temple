import { useEffect, useState } from 'react';
import { BigNumber, ethers } from 'ethers';

import environmentConfig from 'constants/env';
import { useWallet } from 'providers/WalletProvider';

import { RAMOSGoerli, RAMOSGoerli__factory } from 'types/typechain';
import { IBalancerHelpers__factory } from 'types/typechain/factories/IBalancerHelpers__factory';
import { AMO__IBalancerVault__factory } from 'types/typechain/factories/AMO__IBalancerVault__factory';

import type { IBalancerHelpers } from 'types/typechain/IBalancerHelpers';
import type { AMO__IBalancerVault } from 'types/typechain/AMO__IBalancerVault';

import {
  calculateTargetPriceDown,
  calculateTargetPriceUp,
  formatExitRequestTuple,
  formatJoinRequestTuple,
  getPricePercentageFromTpf,
  isTemple,
  randomize,
} from './helpers';
import { ZERO } from 'utils/bigNumber';
import { DBN_ONE_HUNDRED, DBN_TEN_THOUSAND, DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';

export function useRamosAdmin(randomise?: number) {
  const { ramos: RAMOS_ADDRESS, balancerHelpers: BALANCER_HELPERS_ADDRESS } = environmentConfig.contracts;

  //internal state
  const { signer } = useWallet();
  const [walletAddress, setWalletAddress] = useState<string>();
  const [tokens, setTokens] = useState({
    temple: { address: '', balance: DBN_ZERO },
    stable: { address: '', balance: DBN_ZERO },
  });
  const [ramos, setRamos] = useState<RAMOSGoerli>();
  const [balancerHelpers, setBalancerHelpers] = useState<IBalancerHelpers>();
  const [poolId, setPoolId] = useState<string>();
  const [tpf, setTpf] = useState<DecimalBigNumber>();
  const [templePrice, setTemplePrice] = useState<DecimalBigNumber>();
  const [randomPercent, setRandomPercent] = useState<number>(50);
  const [maxRebalanceAmounts, setMaxRebalanceAmounts] =
    useState<{ bpt: DecimalBigNumber; stable: DecimalBigNumber; temple: DecimalBigNumber }>();
  const isConnected =
    ramos &&
    tokens.stable.balance.gt(DBN_ZERO) &&
    tokens.temple.balance.gt(DBN_ZERO) &&
    tokens.temple.address !== '' &&
    tokens.stable.address !== '' &&
    maxRebalanceAmounts &&
    walletAddress &&
    signer &&
    poolId &&
    balancerHelpers &&
    tpf &&
    templePrice &&
    templePrice.gt(DBN_ZERO);

  // outputs
  const [rebalanceUpToTpf, setRebalanceUpToTpf] = useState<{ bptIn: BigNumber; amountOut: BigNumber }>();
  const [rebalanceDownToTpf, setRebalanceDownToTpf] = useState<{ amountIn: BigNumber; bptOut: BigNumber }>();
  const [depositStableUpToTpf, setDepositStableUpToTpf] = useState<{ amountIn: BigNumber; bptOut: BigNumber }>();
  const [withdrawStableToTpf, setWithdrawStableToTpf] = useState<{ amountOut: BigNumber; bptIn: BigNumber }>();

  useEffect(() => {
    async function setContracts() {
      if (signer) {
        const WALLET_ADDRESS = await signer.getAddress();
        const RAMOS_CONTRACT = new RAMOSGoerli__factory(signer).attach(RAMOS_ADDRESS);
        const POOL_ID = await RAMOS_CONTRACT.balancerPoolId();
        const BALANCER_VAULT_ADDRESS = await RAMOS_CONTRACT.balancerVault();
        const BALANCER_VAULT_CONTRACT = AMO__IBalancerVault__factory.connect(BALANCER_VAULT_ADDRESS, signer);
        const BALANCER_HELPERS_CONTRACT = IBalancerHelpers__factory.connect(BALANCER_HELPERS_ADDRESS, signer);
        const [tokenAddresses, balances] = await BALANCER_VAULT_CONTRACT.getPoolTokens(POOL_ID);
        const TPF = await RAMOS_CONTRACT.templePriceFloorNumerator();
        const MAX_REBALANCE_AMOUNTS = await RAMOS_CONTRACT.maxRebalanceAmounts();

        setMaxRebalanceAmounts({
          temple: DecimalBigNumber.fromBN(MAX_REBALANCE_AMOUNTS.temple, 18),
          stable: DecimalBigNumber.fromBN(MAX_REBALANCE_AMOUNTS.stable, 18),
          bpt: DecimalBigNumber.fromBN(MAX_REBALANCE_AMOUNTS.bpt, 18),
        });
        setRamos(RAMOS_CONTRACT);
        setWalletAddress(WALLET_ADDRESS);
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
      const queryUserData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256[]', 'uint256'],
        [1, [templeAmount, stableAmount], 0]
      );
      const queryJoinRequest: AMO__IBalancerVault.JoinPoolRequestStruct = {
        assets: [tokens.temple.address, tokens.stable.address],
        maxAmountsIn: [templeAmount, stableAmount],
        userData: queryUserData,
        fromInternalBalance: false,
      };

      const { amountsIn, bptOut } = await balancerHelpers.queryJoin(
        poolId,
        ramos.address,
        ramos.address,
        queryJoinRequest
      );

      const userData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'uint256'], [1, amountsIn, bptOut]);
      const finalRequest: AMO__IBalancerVault.JoinPoolRequestStruct = {
        assets: [tokens.temple.address, tokens.stable.address],
        maxAmountsIn: amountsIn,
        userData: userData,
        fromInternalBalance: false,
      };

      return {
        joinPoolRequest: formatJoinRequestTuple(finalRequest),
        minBptOut: bptOut.toString(),
      };
    }
  };

  const createExitPoolRequest = async (exitAmountBpt: BigNumber) => {
    if (isConnected) {
      const queryUserData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [1, exitAmountBpt]);

      const queryExitReq: AMO__IBalancerVault.ExitPoolRequestStruct = {
        assets: [tokens.temple.address, tokens.stable.address],
        minAmountsOut: [0, 0],
        userData: queryUserData,
        toInternalBalance: false,
      };
      const { bptIn, amountsOut } = await balancerHelpers.queryExit(poolId, walletAddress, walletAddress, queryExitReq);

      const userData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [1, bptIn]);

      const finalRequest: AMO__IBalancerVault.ExitPoolRequestStruct = {
        assets: [tokens.temple.address, tokens.stable.address],
        minAmountsOut: amountsOut,
        userData: userData,
        toInternalBalance: false,
      };

      return formatExitRequestTuple(finalRequest);
    }
  };

  const calculateRebalanceUp = async (bps: DecimalBigNumber) => {
    if (isConnected && bps.gt(DBN_ZERO)) {
      const targetPrice = calculateTargetPriceUp(templePrice, bps);

      const stableBalFeeAdjusted = tokens.stable.balance
        .mul(DBN_TEN_THOUSAND)
        .div(targetPrice.mul(DBN_TEN_THOUSAND), targetPrice.getDecimals());

      let templeAmountOut = tokens.temple.balance.sub(stableBalFeeAdjusted);
      if (templeAmountOut.gt(maxRebalanceAmounts.temple)) templeAmountOut = maxRebalanceAmounts.temple;
      templeAmountOut = randomize(templeAmountOut, randomPercent);

      const amountsOut = [templeAmountOut.toBN(18).abs(), BigNumber.from(0)];

      const maxBPTAmountIn = ethers.utils.parseUnits('100000000');
      const tempUserdata = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256[]', 'uint256'],
        [2, amountsOut, maxBPTAmountIn]
      );

      const exitRequest = {
        assets: [tokens.temple.address, tokens.stable.address],
        minAmountsOut: amountsOut,
        userData: tempUserdata,
        toInternalBalance: false,
      };

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

      const amountsIn = [BigNumber.from(0), stableAmount.toBN(18)];

      const tempUserdata = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'uint256'], [1, amountsIn, 0]);

      const joinPoolRequest: IBalancerHelpers.JoinPoolRequestStruct = {
        assets: [tokens.temple.address, tokens.stable.address],
        maxAmountsIn: amountsIn,
        userData: tempUserdata,
        fromInternalBalance: false,
      };

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

      const initAmountsIn: BigNumber[] = [BigNumber.from(0), BigNumber.from(0)];
      initAmountsIn[0] = templeAmount.toBN(18);

      const queryUserData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256[]', 'uint256'],
        [1, initAmountsIn, 0]
      );
      const queryJoinRequest: AMO__IBalancerVault.JoinPoolRequestStruct = {
        assets: [tokens.temple.address, tokens.stable.address],
        maxAmountsIn: initAmountsIn,
        userData: queryUserData,
        fromInternalBalance: false,
      };

      const { amountsIn, bptOut } = await balancerHelpers.queryJoin(
        poolId,
        ramos.address,
        ramos.address,
        queryJoinRequest
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

      const amountsOut = [BigNumber.from(0), stableAmount.toBN(18).abs()];

      const maxBPTAmountIn = ethers.utils.parseUnits('100000000', 18);

      const tempUserdata = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256[]', 'uint256'],
        [2, amountsOut, maxBPTAmountIn]
      );

      const exitRequest = {
        assets: [tokens.temple.address, tokens.stable.address],
        minAmountsOut: amountsOut,
        userData: tempUserdata,
        toInternalBalance: false,
      };

      const amounts = await balancerHelpers.queryExit(poolId, ramos.address, ramos.address, exitRequest);

      return {
        amountOut: amounts.amountsOut[1],
        bptIn: amounts.bptIn,
      };
    }
  };

  const calculateRecommendedAmounts = async () => {
    if (isConnected) {
      const percentageDiff = getPricePercentageFromTpf(tpf, templePrice);
      const basisPointsDiff = percentageDiff.mul(DBN_ONE_HUNDRED);
      if (templePrice.gt(tpf)) {
        const withdrawStable = await calculateWithdrawStable(basisPointsDiff);
        const rebalanceDown = await calculateRebalanceDown(basisPointsDiff);
        if (withdrawStable) setWithdrawStableToTpf(withdrawStable);
        if (rebalanceDown) setRebalanceDownToTpf(rebalanceDown);
        setRebalanceUpToTpf({ amountOut: ZERO, bptIn: ZERO });
        setDepositStableUpToTpf({ amountIn: ZERO, bptOut: ZERO });
      } else if (tpf.gt(templePrice)) {
        const depositStable = await calculateDepositStable(basisPointsDiff);
        const rebalanceUp = await calculateRebalanceUp(basisPointsDiff);
        if (depositStable) setDepositStableUpToTpf(depositStable);
        if (rebalanceUp) setRebalanceUpToTpf(rebalanceUp);
        setWithdrawStableToTpf({ amountOut: ZERO, bptIn: ZERO });
        setRebalanceDownToTpf({ amountIn: ZERO, bptOut: ZERO });
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
  };
}
