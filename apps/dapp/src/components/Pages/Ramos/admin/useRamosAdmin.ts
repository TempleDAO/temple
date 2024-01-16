import { useEffect, useState } from 'react';
import { BigNumber, ethers, Signer } from 'ethers';

import environmentConfig from 'constants/env';
import { useWallet } from 'providers/WalletProvider';

import {
  Ramos,
  Ramos__factory,
  IBalancerHelpers,
  IBalancerHelpers__factory,
  IBalancerVault,
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
  decodeUserData,
  formatExitRequestTuple,
  formatJoinRequestTuple,
  getBpsPercentageFromTpf,
  isTemple,
  makeExitRequest,
  makeJoinRequest,
  WeightedPoolExitKind,
} from './helpers';
import { ZERO } from 'utils/bigNumber';
import {
  DBN_TEN_THOUSAND,
  DBN_ZERO,
  DecimalBigNumber,
} from 'utils/DecimalBigNumber';

interface ContractInstances {
  ramos: Ramos;
  ramosPoolHelper: BalancerPoolHelper;
  ramosStrategy: RamosStrategy;
  balancerHelpers: IBalancerHelpers;
  trv: TreasuryReservesVault;
  bptToken: ERC20;
  balancerVault: IBalancerVault;
}
interface RamosAdmin {
  balPooltokensOrdered: Array<string>;
  contracts: ContractInstances;
  maxRebalanceAmountsStable: DecimalBigNumber;
  maxRebalanceAmountsTemple: DecimalBigNumber;
  percentageOfGapToClose: number;
  percentageBounds: { up: DecimalBigNumber; down: DecimalBigNumber };
  poolId: string;
  ramosStrategyVersion: string | undefined;
  templePrice: DecimalBigNumber;
  totalAvailableDaiTrv: DecimalBigNumber | undefined;
  totalAvailableTempleTrv: DecimalBigNumber | undefined;
  tpf: DecimalBigNumber;
}

async function connectToContracts(signer: Signer): Promise<ContractInstances> {
  const {
    ramos: RAMOS_ADDRESS,
    ramosPoolHelper: RAMOS_POOL_HELPER_ADDRESS,
    strategies: STRATEGIES,
    balancerHelpers: BALANCER_HELPERS_ADDRESS,
    treasuryReservesVault: TRV_ADDRESS,
  } = environmentConfig.contracts;

  const ramos = Ramos__factory.connect(RAMOS_ADDRESS, signer);
  const ramosPoolHelper = BalancerPoolHelper__factory.connect(
    RAMOS_POOL_HELPER_ADDRESS,
    signer
  );
  const ramosStrategy = RamosStrategy__factory.connect(
    STRATEGIES.ramosStrategy,
    signer
  );
  const balancerHelpers = IBalancerHelpers__factory.connect(
    BALANCER_HELPERS_ADDRESS,
    signer
  );
  const trv = TreasuryReservesVault__factory.connect(TRV_ADDRESS, signer);

  const balancerVaultAddress = await ramos.balancerVault();
  const bptTokenAddress = await ramos.bptToken();
  const bptToken = ERC20__factory.connect(bptTokenAddress, signer);
  const balancerVault = IBalancerVault__factory.connect(
    balancerVaultAddress,
    signer
  );

  return {
    balancerHelpers,
    balancerVault,
    bptToken,
    ramos,
    ramosPoolHelper,
    ramosStrategy,
    trv,
  };
}

export function useRamosAdmin() {
  const { signer } = useWallet();
  const [ramosAdmin, setRamosAdmin] = useState<RamosAdmin>();
  const tokens = {
    temple: { address: '', balance: DBN_ZERO },
    stable: { address: '', balance: DBN_ZERO },
  };

  const [slippageTolerance, setSlippageTolerance] = useState(0.1);
  const [rebalanceUpAmounts, setRebalanceUpAmounts] = useState<{
    bptIn: BigNumber;
    amountOut: BigNumber;
  }>();
  const [rebalanceDownAmounts, setRebalanceDownAmounts] = useState<{
    amountIn: BigNumber;
    bptOut: BigNumber;
  }>();
  const [depositStableAmounts, setDepositStableAmounts] = useState<{
    amountIn: BigNumber;
    bptOut: BigNumber;
  }>();
  const [withdrawStableAmounts, setWithdrawStableAmounts] = useState<{
    amountOut: BigNumber;
    bptIn: BigNumber;
  }>();

  async function loadRamosAdmin(
    contracts: ContractInstances,
    signer: Signer
  ): Promise<RamosAdmin> {
    const poolId = await contracts.ramos.balancerPoolId();
    const [tokenAddresses, balances] =
      await contracts.balancerVault.getPoolTokens(poolId);
    const tpf = DecimalBigNumber.fromBN(
      await contracts.ramos.treasuryPriceIndex(),
      18
    ); // should be tpf, not tpi
    const maxRebalanceAmounts = await contracts.ramos.maxRebalanceAmounts();
    const percentageBoundDown =
      await contracts.ramos.rebalancePercentageBoundLow();
    const percentageBoundUp =
      await contracts.ramos.rebalancePercentageBoundUp();
    const protIndexBal =
      await contracts.ramosPoolHelper.protocolTokenIndexInBalancerPool();
    const percentageBounds = {
      down: DecimalBigNumber.fromBN(percentageBoundDown, 0),
      up: DecimalBigNumber.fromBN(percentageBoundUp, 0),
    };
    const maxRebalanceAmountsTemple = DecimalBigNumber.fromBN(
      maxRebalanceAmounts.protocolToken,
      18
    );
    const maxRebalanceAmountsStable = DecimalBigNumber.fromBN(
      maxRebalanceAmounts.quoteToken,
      18
    );
    const percentageOfGapToClose = 100;

    tokenAddresses.forEach((tokenAddr, index) => {
      if (isTemple(tokenAddr)) {
        tokens.temple = {
          address: tokenAddr,
          balance: DecimalBigNumber.fromBN(balances[index], 18),
        };
      } else {
        tokens.stable = {
          address: tokenAddr,
          balance: DecimalBigNumber.fromBN(balances[index], 18),
        };
      }
    });

    const balPooltokensOrdered =
      protIndexBal.toNumber() == 1
        ? [tokens.stable.address, tokens.temple.address]
        : [tokens.temple.address, tokens.stable.address];

    const templePrice = tokens.stable.balance.div(tokens.temple.balance, 18);
    const tDai = await contracts.trv.totalAvailable(tokens.stable.address);
    const tTemple = await contracts.trv.totalAvailable(tokens.temple.address);

    const res: RamosAdmin = {
      balPooltokensOrdered,
      maxRebalanceAmountsStable,
      maxRebalanceAmountsTemple,
      contracts,
      percentageOfGapToClose,
      percentageBounds,
      poolId,
      ramosStrategyVersion: await contracts.ramosStrategy.strategyVersion(),
      templePrice,
      totalAvailableDaiTrv: DecimalBigNumber.fromBN(tDai, 18),
      totalAvailableTempleTrv: DecimalBigNumber.fromBN(tTemple, 18),
      tpf,
    };
    return res;
  }

  useEffect(() => {
    async function load() {
      if (!signer) return;
      const contracts = await connectToContracts(signer);
      setRamosAdmin(await loadRamosAdmin(contracts, signer));
    }
    load();
  }, [signer]);

  useEffect(() => {
    async function initialCalcs() {
      if (!ramosAdmin) return;
      await calculateRecommendedAmounts();
    }
    initialCalcs();
  }, [ramosAdmin]);

  const createJoinPoolRequest = async (
    templeAmount: BigNumber,
    stableAmount: BigNumber
  ) => {
    if (!ramosAdmin) return;
    const { contracts } = ramosAdmin;
    const proportionalAddLiquidityQuote =
      await contracts.ramosStrategy.callStatic.proportionalAddLiquidityQuote(
        stableAmount,
        slippageTolerance * 100
      );
    const reqDataQuote = proportionalAddLiquidityQuote.requestData;
    const { bptOut } = decodeUserData(reqDataQuote.userData);
    return {
      joinPoolRequest: formatJoinRequestTuple(reqDataQuote),
      minBptOut: bptOut,
    };
  };

  const calculateRebalanceUp = async (bps: DecimalBigNumber) => {
    if (bps.lt(DBN_ZERO) || !ramosAdmin) return;
    const {
      contracts,
      templePrice,
      percentageOfGapToClose,
      balPooltokensOrdered,
      poolId,
      maxRebalanceAmountsTemple,
    } = ramosAdmin;
    const targetPrice = await calculateTargetPriceUp(
      templePrice,
      bps,
      contracts.ramos,
      percentageOfGapToClose
    );
    const templeBalanceAtTargetPrice = tokens.stable.balance.div(
      targetPrice,
      targetPrice.getDecimals()
    );
    let templeAmountOut = tokens.temple.balance.sub(templeBalanceAtTargetPrice);
    if (templeAmountOut.gt(maxRebalanceAmountsTemple))
      templeAmountOut = maxRebalanceAmountsTemple;

    const amountsOut = [templeAmountOut.toBN(18), ZERO];
    const exitRequest = makeExitRequest(
      balPooltokensOrdered,
      amountsOut,
      ethers.constants.MaxInt256,
      WeightedPoolExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT
    );

    const [bptIn, amounts] = await contracts.balancerHelpers.queryExit(
      poolId,
      contracts.ramos.address,
      contracts.ramos.address,
      exitRequest
    );
    return { bptIn, amountOut: applySlippage(amounts[0], slippageTolerance) };
  };

  const calculateDepositStable = async (bps: DecimalBigNumber) => {
    if (bps.lt(DBN_ZERO) || !ramosAdmin) return;
    const {
      contracts,
      templePrice,
      percentageOfGapToClose,
      balPooltokensOrdered,
      poolId,
      maxRebalanceAmountsStable,
    } = ramosAdmin;
    const targetPrice = await calculateTargetPriceUp(
      templePrice,
      bps,
      contracts.ramos,
      percentageOfGapToClose
    );
    const stableAmountAtTargetPrice = tokens.temple.balance.mul(targetPrice);
    let stableAmount = stableAmountAtTargetPrice.sub(tokens.stable.balance);

    if (stableAmount.gt(maxRebalanceAmountsStable))
      stableAmount = maxRebalanceAmountsStable;
    const amountsIn = [ZERO, stableAmount.toBN(18)];
    const joinPoolRequest = makeJoinRequest(balPooltokensOrdered, amountsIn);
    const amounts = await contracts.balancerHelpers.queryJoin(
      poolId,
      contracts.ramos.address,
      contracts.ramos.address,
      joinPoolRequest
    );
    return {
      amountIn: amounts.amountsIn[1],
      bptOut: applySlippage(amounts.bptOut, slippageTolerance),
    };
  };

  const calculateRebalanceDown = async (bps: DecimalBigNumber) => {
    if (!ramosAdmin) return;
    const {
      contracts,
      templePrice,
      percentageOfGapToClose,
      balPooltokensOrdered,
      poolId,
      maxRebalanceAmountsTemple,
    } = ramosAdmin;
    const targetPrice = await calculateTargetPriceDown(
      templePrice,
      bps,
      contracts.ramos,
      percentageOfGapToClose
    );
    const templeBalanceAtTargetPrice = tokens.stable.balance.div(
      targetPrice,
      18
    );
    let templeAmount = templeBalanceAtTargetPrice.sub(tokens.temple.balance);
    if (templeAmount.gt(maxRebalanceAmountsTemple))
      templeAmount = maxRebalanceAmountsTemple;
    const initAmountsIn: BigNumber[] = [templeAmount.toBN(18), ZERO];
    const joinPoolRequest = makeJoinRequest(
      balPooltokensOrdered,
      initAmountsIn
    );
    const { amountsIn, bptOut } = await contracts.balancerHelpers.queryJoin(
      poolId,
      contracts.ramos.address,
      contracts.ramos.address,
      joinPoolRequest
    );

    return {
      amountIn: amountsIn[0],
      bptOut: applySlippage(bptOut, slippageTolerance),
    };
  };

  const calculateWithdrawStable = async (bps: DecimalBigNumber) => {
    if (!ramosAdmin) return;
    const {
      contracts,
      templePrice,
      percentageOfGapToClose,
      balPooltokensOrdered,
      poolId,
      maxRebalanceAmountsStable,
    } = ramosAdmin;
    const targetPrice = await calculateTargetPriceDown(
      templePrice,
      bps,
      contracts.ramos,
      percentageOfGapToClose
    );
    const stableBalanceAtTargetPrice = tokens.temple.balance.mul(targetPrice);
    let stableAmount = tokens.stable.balance.sub(stableBalanceAtTargetPrice);

    if (stableAmount.gt(maxRebalanceAmountsStable))
      stableAmount = maxRebalanceAmountsStable;

    const amountsOut = [ZERO, stableAmount.toBN(18)];
    const exitRequest = makeExitRequest(
      balPooltokensOrdered,
      amountsOut,
      ethers.constants.MaxInt256,
      WeightedPoolExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT
    );
    const amounts = await contracts.balancerHelpers.queryExit(
      poolId,
      contracts.ramos.address,
      contracts.ramos.address,
      exitRequest
    );

    return {
      amountOut: applySlippage(amounts.amountsOut[1], slippageTolerance),
      bptIn: amounts.bptIn,
    };
  };

  const calculateRecommendedAmounts = async () => {
    if (!ramosAdmin) return;
    const { tpf, templePrice, percentageBounds } = ramosAdmin;
    if (templePrice.gt(tpf)) {
      setRebalanceUpAmounts({ amountOut: ZERO, bptIn: ZERO });
      setDepositStableAmounts({ amountIn: ZERO, bptOut: ZERO });
      // account for percentage bounds
      const tpfRangeAdjusted = tpf.add(
        tpf.mul(percentageBounds.up).div(DBN_TEN_THOUSAND, tpf.getDecimals())
      );
      if (templePrice.gt(tpfRangeAdjusted)) {
        const basisPointsDiff = getBpsPercentageFromTpf(
          tpfRangeAdjusted,
          templePrice
        );
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
      const tpfRangeAdjusted = tpf.sub(
        tpf.mul(percentageBounds.down).div(DBN_TEN_THOUSAND, tpf.getDecimals())
      );
      if (tpfRangeAdjusted.gt(templePrice)) {
        const basisPointsDiff = getBpsPercentageFromTpf(
          tpfRangeAdjusted,
          templePrice
        );
        const rebalanceUp = await calculateRebalanceUp(basisPointsDiff);
        const depositStable = await calculateDepositStable(basisPointsDiff);

        depositStable && setDepositStableAmounts(depositStable);
        rebalanceUp && setRebalanceUpAmounts(rebalanceUp);
      } else {
        setRebalanceUpAmounts({ amountOut: ZERO, bptIn: ZERO });
        setDepositStableAmounts({ amountIn: ZERO, bptOut: ZERO });
      }
    }
  };

  const handleAddLiquidityInput = async (stableAmount: DecimalBigNumber) => {
    let templeAmount = DBN_ZERO;
    if (ramosAdmin) {
      const { templePrice } = ramosAdmin;
      templeAmount = stableAmount.div(templePrice, stableAmount.getDecimals());
    }
    return { templeAmount, stableAmount };
  };

  const createExitPoolRequest = async (exitAmountBpt: BigNumber) => {
    if (!ramosAdmin) return;
    const { contracts } = ramosAdmin;
    const proportionalRemoveLiquidityQuote =
      await contracts.ramosStrategy.callStatic.proportionalRemoveLiquidityQuote(
        exitAmountBpt,
        slippageTolerance * 100
      );
    const reqDataQuote = proportionalRemoveLiquidityQuote.requestData;
    return formatExitRequestTuple(reqDataQuote);
  };

  const createDepositAndStakeRequest = async (
    bptAmountIn: DecimalBigNumber
  ) => {
    if (!ramosAdmin) return;
    const { contracts } = ramosAdmin;
    const amountInContract = await contracts.bptToken.balanceOf(
      contracts.ramos.address
    );
    const bnAmount = bptAmountIn.toBN(bptAmountIn.getDecimals());
    return {
      bptAmountIn: bnAmount,
      useContractBalance: bnAmount.lte(amountInContract),
    };
  };

  return {
    ...ramosAdmin,
    depositStableAmounts,
    rebalanceDownAmounts,
    rebalanceUpAmounts,
    slippageTolerance,
    withdrawStableAmounts,
    calculateDepositStable,
    calculateRebalanceDown,
    calculateRebalanceUp,
    calculateRecommendedAmounts,
    createDepositAndStakeRequest,
    createExitPoolRequest,
    createJoinPoolRequest,
    handleAddLiquidityInput,
    setSlippageTolerance,
  };
}
