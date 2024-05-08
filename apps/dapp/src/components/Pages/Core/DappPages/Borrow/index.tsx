import styled from 'styled-components';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ZERO, fromAtto, toAtto } from 'utils/bigNumber';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import {
  ERC20__factory,
  TempleCircuitBreakerAllUsersPerPeriod__factory,
  TempleLineOfCredit__factory,
  TreasuryReservesVault__factory,
} from 'types/typechain';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import { fetchGenericSubgraph } from 'utils/subgraph';
import { BigNumber, ethers } from 'ethers';
import daiImg from 'assets/images/newui-images/tokens/dai.png';
import templeImg from 'assets/images/newui-images/tokens/temple.png';
import { formatToken } from 'utils/formatter';
import { TradeButton } from '../../NewUI/Home';
import { Popover } from 'components/Popover';
import Repay from './TLC/Repay';
import Borrow from './TLC/Borrow';
import Withdraw from './TLC/Withdraw';
import Supply from './TLC/Supply';
import { getBigNumberFromString, getTokenInfo } from 'components/Vault/utils';
import { useNotification } from 'providers/NotificationProvider';
import { TlcChart } from './Chart';
import env from 'constants/env';
import { useConnectWallet } from '@web3-onboard/react';
import Tooltip from 'components/Tooltip/Tooltip';
import { estimateAndMine } from 'utils/ethers';

export type State = {
  supplyValue: string;
  withdrawValue: string;
  borrowValue: string;
  repayValue: string;
  inputToken: TICKER_SYMBOL;
  outputToken: TICKER_SYMBOL;
  inputTokenBalance: BigNumber;
  outputTokenBalance: BigNumber;
};

export type TlcInfo = {
  minBorrow: number;
  borrowRate: number;
  liquidationLtv: number;
  strategyBalance: number;
  debtCeiling: number;
  daiCircuitBreakerRemaining: BigNumber;
  templeCircuitBreakerRemaining: BigNumber;
};

export const MAX_LTV = 75;

export type Prices = { templePrice: number; daiPrice: number; tpi: number };

export const BorrowPage = () => {
  const [{}, connect] = useConnectWallet();
  const { balance, wallet, updateBalance, signer, ensureAllowance } =
    useWallet();
  const { openNotification } = useNotification();
  const [modal, setModal] = useState<
    'closed' | 'supply' | 'withdraw' | 'borrow' | 'repay'
  >('closed');
  const [state, setState] = useState<State>({
    supplyValue: '',
    withdrawValue: '',
    borrowValue: '',
    repayValue: '',
    inputToken: TICKER_SYMBOL.TEMPLE_TOKEN,
    outputToken: TICKER_SYMBOL.DAI,
    inputTokenBalance: ZERO,
    outputTokenBalance: ZERO,
  });
  const [activeScreen, setActiveScreen] = useState<'supply' | 'borrow'>(
    'supply'
  );
  const [accountPosition, setAccountPosition] =
    useState<ITlcDataTypes.AccountPositionStructOutput>();
  const [tlcInfo, setTlcInfo] = useState<TlcInfo>();
  const [prices, setPrices] = useState<Prices>({
    templePrice: 0,
    daiPrice: 0,
    tpi: 0,
  });
  const [metricsLoading, setMetricsLoading] = useState(false);

  const getPrices = useCallback(async () => {
    const { data } = await fetchGenericSubgraph<any>(
      env.subgraph.templeV2,
      `{
        tokens {
          price
          symbol
        }
        treasuryReservesVaults {
          treasuryPriceIndex
        }
      }`
    );
    setPrices({
      templePrice: data.tokens.filter((t: any) => t.symbol == 'TEMPLE')[0]
        .price,
      daiPrice: data.tokens.filter((t: any) => t.symbol == 'DAI')[0].price,
      tpi: data.treasuryReservesVaults[0].treasuryPriceIndex,
    });
  }, []);

  const getCircuitBreakers = useCallback(async () => {
    if (!signer) return;
    const daiCircuitBreakerContract =
      new TempleCircuitBreakerAllUsersPerPeriod__factory(signer).attach(
        env.contracts.daiCircuitBreaker
      );

    const templeCircuitBreakerContract =
      new TempleCircuitBreakerAllUsersPerPeriod__factory(signer).attach(
        env.contracts.templeCircuitBreaker
      );

    const daiCircuitBreakerCap = await daiCircuitBreakerContract.cap();
    const daiCircuitBreakerUtilisation =
      await daiCircuitBreakerContract.currentUtilisation();

    const templeCircuitBreakerCap = await templeCircuitBreakerContract.cap();
    const templeCircuitBreakerUtilisation =
      await templeCircuitBreakerContract.currentUtilisation();

    const daiCircuitBreakerRemaining = daiCircuitBreakerCap.sub(
      daiCircuitBreakerUtilisation
    );
    const templeCircuitBreakerRemaining = templeCircuitBreakerCap.sub(
      templeCircuitBreakerUtilisation
    );

    return {
      daiCircuitBreakerRemaining,
      templeCircuitBreakerRemaining,
    };
  }, [signer]);

  const getTlcInfoFromContracts = useCallback(async () => {
    if (!signer) return;

    const tlcContract = new TempleLineOfCredit__factory(signer).attach(
      env.contracts.tlc
    );
    const debtPosition = await tlcContract.totalDebtPosition();
    const totalUserDebt = debtPosition.totalDebt;
    const utilizationRatio = debtPosition.utilizationRatio;

    // NOTE: We are intentionally rounding here to nearest 1e18
    const debtCeiling = totalUserDebt
      .div(utilizationRatio)
      .mul(ethers.utils.parseEther('1'));

    const userAvailableToBorrowFromTlc = debtCeiling.sub(totalUserDebt);

    const trvContract = new TreasuryReservesVault__factory(signer).attach(
      env.contracts.treasuryReservesVault
    );
    const strategyAvailalableToBorrowFromTrv =
      await trvContract.availableForStrategyToBorrow(
        env.contracts.strategies.tlcStrategy,
        env.contracts.dai
      );

    // available to borrow
    // return the lesser of userAvailableToBorrowFromTlc and strategyAvailalableToBorrowFromTrv
    const maxAvailableToBorrow = userAvailableToBorrowFromTlc.gte(
      strategyAvailalableToBorrowFromTrv
    )
      ? strategyAvailalableToBorrowFromTrv
      : userAvailableToBorrowFromTlc;

    // Getting the max borrow LTV and interest rate
    const [debtTokenConfig, debtTokenData] =
      await tlcContract.debtTokenDetails();
    const maxLtv = debtTokenConfig.maxLtvRatio;

    // current borrow apy
    const currentBorrowInterestRate =
      Math.pow(1 + fromAtto(debtTokenData.interestRate) / 365, 365) - 1;

    const circuitBreakers = await getCircuitBreakers();

    return {
      debtCeiling: fromAtto(debtCeiling),
      strategyBalance: fromAtto(maxAvailableToBorrow),
      borrowRate: currentBorrowInterestRate,
      liquidationLtv: fromAtto(maxLtv),
      daiCircuitBreakerRemaining: circuitBreakers?.daiCircuitBreakerRemaining,
      templeCircuitBreakerRemaining:
        circuitBreakers?.templeCircuitBreakerRemaining,
    };
  }, [signer, getCircuitBreakers]);

  const getTlcInfo = useCallback(async () => {
    setMetricsLoading(true);
    const getAccountPosition = async () => {
      if (!signer || !wallet) {
        setAccountPosition(undefined);
        return;
      }
      const tlcContract = new TempleLineOfCredit__factory(signer).attach(
        env.contracts.tlc
      );
      const position = await tlcContract.accountPosition(wallet);
      setAccountPosition(position);
    };
    getAccountPosition();
    try {
      const { data } = await fetchGenericSubgraph<any>(
        env.subgraph.templeV2,
        `{
          tlcDailySnapshots(orderBy: timestamp, orderDirection: desc, first: 1) {
            minBorrowAmount
          }
        }`
      );

      const tlcInfoFromContracts = await getTlcInfoFromContracts();

      setMetricsLoading(false);

      // prevent showing 0s in UI if we don't have data from contracts
      if (!tlcInfoFromContracts) {
        setTlcInfo(undefined);
        return;
      }

      setTlcInfo({
        minBorrow: data.tlcDailySnapshots[0].minBorrowAmount,
        borrowRate: tlcInfoFromContracts?.borrowRate || 0,
        liquidationLtv: tlcInfoFromContracts?.liquidationLtv || 0,
        strategyBalance: tlcInfoFromContracts?.strategyBalance || 0,
        debtCeiling: tlcInfoFromContracts?.debtCeiling || 0,
        daiCircuitBreakerRemaining:
          tlcInfoFromContracts?.daiCircuitBreakerRemaining || ZERO,
        templeCircuitBreakerRemaining:
          tlcInfoFromContracts?.templeCircuitBreakerRemaining || ZERO,
      });
    } catch (e) {
      setMetricsLoading(false);
      console.log(e);
    }
  }, [getTlcInfoFromContracts, signer, wallet]);

  useEffect(() => {
    const onMount = async () => {
      await updateBalance();
      await getTlcInfo();
      await getPrices();
    };
    onMount();
  }, [getTlcInfo, updateBalance, getPrices]);

  // Update token balances
  useEffect(() => {
    setState((state) => ({
      ...state,
      inputTokenBalance: balance.TEMPLE,
      outputTokenBalance: balance.DAI,
    }));
  }, [balance]);

  const getLiquidationInfo = (additionalDebt?: number) => {
    if (!accountPosition || !tlcInfo) return <></>;
    const liquidationLtv = tlcInfo.liquidationLtv;
    const collateral = fromAtto(accountPosition.collateral);
    const debt = fromAtto(accountPosition.currentDebt) + (additionalDebt || 0);
    const liquidationTpi = debt / liquidationLtv / collateral;
    const liquidationDebt = collateral * prices.tpi * liquidationLtv;
    return (
      <>
        Given a {((debt / (collateral * prices.tpi)) * 100).toFixed(2)}% LTV
        ratio, your collateral will be liquidated if TPI falls to{' '}
        <strong>${liquidationTpi.toFixed(3)}</strong> or if your debt rises to{' '}
        <strong>${liquidationDebt.toFixed(2)}</strong>.
      </>
    );
  };

  const supply = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(
      env.contracts.tlc
    );
    const amount = getBigNumberFromString(
      state.supplyValue,
      getTokenInfo(state.inputToken).decimals
    );
    try {
      // Ensure allowance for TLC to spend TEMPLE
      const templeContract = new ERC20__factory(signer).attach(
        env.contracts.temple
      );
      await ensureAllowance(
        TICKER_SYMBOL.TEMPLE_TOKEN,
        templeContract,
        env.contracts.tlc,
        amount
      );

      const populatedTransaction =
        await tlcContract.populateTransaction.addCollateral(amount, wallet);
      const receipt = await estimateAndMine(signer, populatedTransaction);

      openNotification({
        title: `Supplied ${state.supplyValue} TEMPLE`,
        hash: receipt.transactionHash,
      });
      updateBalance();
      getTlcInfo();
      setModal('closed');
    } catch (e) {
      console.log(e);
      openNotification({
        title: `Error supplying TEMPLE`,
        hash: '',
      });
    }
  };

  const withdraw = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(
      env.contracts.tlc
    );
    const amount = getBigNumberFromString(
      state.withdrawValue,
      getTokenInfo(state.inputToken).decimals
    );
    try {
      const populatedTransaction =
        await tlcContract.populateTransaction.removeCollateral(amount, wallet);
      const receipt = await estimateAndMine(signer, populatedTransaction);

      openNotification({
        title: `Withdrew ${state.withdrawValue} TEMPLE`,
        hash: receipt.transactionHash,
      });
      updateBalance();
      getTlcInfo();
      setModal('closed');
    } catch (e) {
      console.log(e);
      openNotification({
        title: `Error withdrawing TEMPLE`,
        hash: '',
      });
    }
  };

  const borrow = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(
      env.contracts.tlc
    );
    const amount = getBigNumberFromString(
      state.borrowValue,
      getTokenInfo(state.outputToken).decimals
    );
    try {
      const populatedTransaction = await tlcContract.populateTransaction.borrow(
        amount,
        wallet
      );
      const receipt = await estimateAndMine(signer, populatedTransaction);

      openNotification({
        title: `Borrowed ${state.borrowValue} DAI`,
        hash: receipt.transactionHash,
      });
      updateBalance();
      getTlcInfo();
      setModal('closed');
    } catch (e) {
      console.log(e);
      openNotification({
        title: `Error borrowing DAI`,
        hash: '',
      });
    }
  };

  const repay = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(
      env.contracts.tlc
    );
    const amount = getBigNumberFromString(
      state.repayValue,
      getTokenInfo(state.outputToken).decimals
    );
    try {
      // Ensure allowance for TLC to spend DAI
      const daiContract = new ERC20__factory(signer).attach(env.contracts.dai);
      await ensureAllowance(
        TICKER_SYMBOL.DAI,
        daiContract,
        env.contracts.tlc,
        amount
      );

      // Note Repay vs RepayAll
      const populatedTransaction = await tlcContract.populateTransaction.repay(
        amount,
        wallet
      );
      const receipt = await estimateAndMine(signer, populatedTransaction);

      openNotification({
        title: `Repaid ${state.repayValue} DAI`,
        hash: receipt.transactionHash,
      });
      updateBalance();
      getTlcInfo();
      setModal('closed');
    } catch (e) {
      console.log(e);
      openNotification({
        title: `Error repaying DAI`,
        hash: '',
      });
    }
  };

  const repayAll = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(
      env.contracts.tlc
    );
    const amount = getBigNumberFromString(
      state.repayValue,
      getTokenInfo(state.outputToken).decimals
    );
    try {
      // Ensure allowance for TLC to spend DAI
      const daiContract = new ERC20__factory(signer).attach(env.contracts.dai);
      await ensureAllowance(
        TICKER_SYMBOL.DAI,
        daiContract,
        env.contracts.tlc,
        amount
      );

      // Note RepayAll vs Repay
      const populatedTransaction =
        await tlcContract.populateTransaction.repayAll(wallet);
      const receipt = await estimateAndMine(signer, populatedTransaction);

      openNotification({
        title: `Repaid ${
          accountPosition
            ? fromAtto(accountPosition.currentDebt).toFixed(2)
            : amount
        } DAI`,
        hash: receipt.transactionHash,
      });
      updateBalance();
      getTlcInfo();
      setModal('closed');
    } catch (e: any) {
      console.log(e);
      openNotification({
        title: `Error repaying DAI`,
        hash: e.hash || '',
      });
    }
  };

  const getBorrowRate = () =>
    tlcInfo ? (tlcInfo.borrowRate * 100).toFixed(2) : 0;

  const showLoading = useMemo(
    () => metricsLoading || !wallet,
    [metricsLoading, wallet]
  );

  const availableToBorrow = useMemo(() => {
    if (!tlcInfo) return '...';

    const availableAsBigNumber = toAtto(tlcInfo.strategyBalance);

    if (tlcInfo.daiCircuitBreakerRemaining.lt(availableAsBigNumber)) {
      return `$${Number(
        fromAtto(tlcInfo.daiCircuitBreakerRemaining)
      ).toLocaleString()}`;
    }

    return `$${Number(tlcInfo.strategyBalance).toLocaleString()}`;
  }, [tlcInfo]);

  return (
    <>
      <PageContainer>
        <TlcContainer>
          <TlcTabs>
            <TlcTab
              isActive={activeScreen == 'supply'}
              onClick={() => setActiveScreen('supply')}
            >
              <p>SUPPLY</p>
            </TlcTab>
            <TlcTab
              isActive={activeScreen == 'borrow'}
              onClick={() => setActiveScreen('borrow')}
            >
              <p>BORROW</p>
            </TlcTab>
          </TlcTabs>
          {activeScreen == 'supply' ? (
            <>
              <ValueContainer>
                <TokenImg src={templeImg} />
                <NumContainer>
                  <LeadMetric>
                    {accountPosition?.collateral
                      ? formatToken(
                          accountPosition?.collateral,
                          state.inputToken
                        )
                      : 0}{' '}
                    TEMPLE
                  </LeadMetric>
                  <USDMetric>
                    $
                    {accountPosition?.collateral
                      ? (
                          fromAtto(accountPosition.collateral) *
                          prices.templePrice
                        ).toLocaleString('en')
                      : 0}{' '}
                    USD
                  </USDMetric>
                </NumContainer>
              </ValueContainer>
              <BiggerCopy>Supply TEMPLE as collateral to borrow DAI</BiggerCopy>
              <FillSpace minHeight="110px" />
              <RuleContainer>
                <Rule />
              </RuleContainer>
              <JustifyCenterAndAlignButtonRow>
                {wallet ? (
                  <>
                    <TradeButton
                      disabled={!accountPosition}
                      onClick={() => {
                        setModal('supply');
                      }}
                      width="175px"
                    >
                      Supply
                    </TradeButton>
                    <TradeButton
                      onClick={() => setModal('withdraw')}
                      disabled={
                        !accountPosition || accountPosition?.collateral.lte(0)
                      }
                      width="175px"
                    >
                      Withdraw
                    </TradeButton>
                  </>
                ) : (
                  <TradeButton
                    onClick={() => {
                      connect();
                    }}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Connect Wallet
                  </TradeButton>
                )}
              </JustifyCenterAndAlignButtonRow>
              <MarginTop />
            </>
          ) : (
            <>
              <ValueContainer>
                <TokenImg src={daiImg} />
                <NumContainer>
                  <LeadMetric>
                    {accountPosition?.currentDebt
                      ? formatToken(
                          accountPosition?.currentDebt,
                          state.outputToken
                        )
                      : 0}{' '}
                    DAI
                  </LeadMetric>
                  <USDMetric>
                    $
                    {accountPosition?.currentDebt
                      ? (
                          fromAtto(accountPosition.currentDebt) *
                          prices.daiPrice
                        ).toLocaleString('en')
                      : 0}{' '}
                    USD
                  </USDMetric>
                </NumContainer>
              </ValueContainer>
              <BorrowMetricsCol>
                <BorrowMetricsRow>
                  <BorrowMetric>
                    <BrandParagraph>
                      Current <br /> LTV
                    </BrandParagraph>
                    <p>
                      {accountPosition?.collateral.gt(0)
                        ? (
                            fromAtto(accountPosition.loanToValueRatio) * 100
                          ).toFixed(2)
                        : 0}
                      %
                    </p>
                  </BorrowMetric>
                  <BorrowMetric>
                    <BrandParagraph>
                      Liquidation <br />
                      threshold
                    </BrandParagraph>
                    <p>{tlcInfo ? tlcInfo.liquidationLtv * 100 : 0}%</p>
                  </BorrowMetric>
                </BorrowMetricsRow>
                <BorrowMetricsRow>
                  <BorrowMetric>
                    <BrandParagraph>Max LTV</BrandParagraph>
                    <p>{MAX_LTV}%</p>
                  </BorrowMetric>
                  <BorrowMetric>
                    <BrandParagraph>APY</BrandParagraph>
                    <p>{getBorrowRate()}%</p>
                  </BorrowMetric>
                </BorrowMetricsRow>
                {accountPosition?.currentDebt.gt(0) && wallet ? (
                  <>
                    <Copy>{getLiquidationInfo()}</Copy>
                  </>
                ) : (
                  <FillSpace />
                )}
              </BorrowMetricsCol>
              <RuleContainer>
                <Rule />
              </RuleContainer>
              <JustifyCenterRow>
                {wallet ? (
                  <>
                    <TradeButton
                      onClick={() => setModal('borrow')}
                      disabled={
                        !accountPosition || accountPosition?.collateral.lte(0)
                      }
                      width="175px"
                    >
                      Borrow
                    </TradeButton>
                    <TradeButton
                      onClick={() => setModal('repay')}
                      disabled={
                        !accountPosition || accountPosition?.currentDebt.lte(0)
                      }
                      width="175px"
                    >
                      Repay
                    </TradeButton>
                  </>
                ) : (
                  <TradeButton
                    onClick={() => {
                      connect();
                    }}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Connect Wallet
                  </TradeButton>
                )}
              </JustifyCenterRow>
              <MarginTop />
            </>
          )}
        </TlcContainer>
        <FlexCol>
          <Metrics>
            <MetricContainer>
              <LeadMetric>
                {showLoading
                  ? '...'
                  : tlcInfo &&
                    `$${Number(tlcInfo.debtCeiling).toLocaleString()}`}
              </LeadMetric>
              <BrandParagraph>Total Debt Ceiling</BrandParagraph>
            </MetricContainer>
            <MetricContainer>
              <LeadMetric>
                {showLoading ? '...' : tlcInfo && `${availableToBorrow}`}
              </LeadMetric>
              <BrandParagraph>
                Available to Borrow
                <Tooltip
                  content={` The maximum borrow amount is subject to the supplied collateral and the Daily Borrow Limit across all
            users.`}
                  inline
                >
                  <InfoCircle inline>
                    <p>i</p>
                  </InfoCircle>
                </Tooltip>
              </BrandParagraph>
            </MetricContainer>
            <MetricContainer>
              <LeadMetric>
                {showLoading ? '...' : `${getBorrowRate()}%`}
              </LeadMetric>
              <BrandParagraph>Current Borrow APY </BrandParagraph>
            </MetricContainer>
            <MetricContainer>
              <LeadMetric>{showLoading ? '...' : prices.tpi}</LeadMetric>
              <BrandParagraph>Current TPI</BrandParagraph>
            </MetricContainer>
          </Metrics>
          <ChartContainer>
            <TlcChart />
          </ChartContainer>
        </FlexCol>
      </PageContainer>

      {/* Modal for executing supply/withdraw/borrow/repay */}
      <Popover
        isOpen={modal != 'closed'}
        onClose={() => setModal('closed')}
        closeOnClickOutside
        showCloseButton
      >
        <ModalContainer>
          {modal === 'supply' ? (
            <Supply
              accountPosition={accountPosition}
              state={state}
              minBorrow={tlcInfo?.minBorrow}
              setState={setState}
              supply={supply}
              prices={prices}
            />
          ) : modal === 'withdraw' ? (
            <Withdraw
              accountPosition={accountPosition}
              state={state}
              setState={setState}
              withdraw={withdraw}
              prices={prices}
              tlcInfo={tlcInfo}
            />
          ) : modal === 'borrow' ? (
            <Borrow
              accountPosition={accountPosition}
              state={state}
              tlcInfo={tlcInfo}
              prices={prices}
              liquidationInfo={getLiquidationInfo}
              setState={setState}
              borrow={borrow}
            />
          ) : (
            <Repay
              accountPosition={accountPosition}
              state={state}
              setState={setState}
              repay={repay}
              repayAll={repayAll}
              prices={prices}
            />
          )}
        </ModalContainer>
      </Popover>
    </>
  );
};

type FillSpaceProps = {
  minHeight?: string;
};

const FillSpace = styled.div<FillSpaceProps>`
  min-height: ${({ minHeight }) => minHeight || '70px'};
`;

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  @media (max-width: 1240px) {
    padding: 1rem 0rem;
  }
`;

const FlexCol = styled.div`
  display: flex;
  flex-direction: column;
  padding-top: 2rem;
  padding-bottom: 2rem;
`;

const ChartContainer = styled.div`
  width: 1150px;
  @media (max-width: 1350px) {
    width: 800px;
    margin-right: 0;
  }
  @media (max-width: 768px) {
    width: 500px;
    margin-right: 0;
  }
  @media (max-width: 500px) {
    width: 350px;
  }
`;

const TlcContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: start;
  text-align: center;
  border: 1px solid ${({ theme }) => theme.palette.brand};

  border-radius: 10px;
  color: ${({ theme }) => theme.palette.brand};
  width: 560px;
  height: 405px;
`;

const TlcTabs = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  width: 100%;
  min-height: 50px;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};

  div:nth-child(1) {
    border-right: 1px solid ${({ theme }) => theme.palette.brand};
    border-top-left-radius: 10px;
  }
  div:nth-child(2) {
    border-top-right-radius: 10px;
  }
`;

const TlcTab = styled.div<{ isActive: boolean }>`
  width: 50%;
  height: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  cursor: pointer;
  font-weight: bold;
  letter-spacing: 1px;
  background: ${({ isActive, theme }) =>
    isActive ? theme.palette.gradients.dark : 'transparent'};
`;

const ValueContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
`;

const TokenImg = styled.img`
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  width: 3rem;
`;

const NumContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  margin-left: 1rem;
  text-align: left;
`;

export const MarginTop = styled.div`
  margin-top: 1rem;
`;

const LeadMetric = styled.div`
  font-size: 1.5rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const USDMetric = styled.div`
  font-size: 0.9rem;
`;

export const Copy = styled.p`
  color: ${({ theme }) => theme.palette.brandLight};
  letter-spacing: 0.05rem;
  font-size: 0.9rem;
`;

const BiggerCopy = styled.p`
  color: ${({ theme }) => theme.palette.brandLight};
  letter-spacing: 0.05rem;
  font-size: 1rem;
`;

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  color: ${({ theme }) => theme.palette.brand};
  width: 350px;
`;

const RuleContainer = styled.div`
  width: 50%;
  align-self: center;
`;

export const Rule = styled.hr`
  border: 0;
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  margin: 0.5rem 0 0 0;
`;

const BrandParagraph = styled.p`
  text-align: left;
  color: ${({ theme }) => theme.palette.brand};
`;

export const FlexBetween = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${({ theme }) => theme.palette.brandLight};

  p {
    font-size: 1rem;
    margin: 0.5rem 0;
  }
`;

const BorrowMetric = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: ${({ theme }) => theme.palette.brandLight};

  p {
    font-size: 1rem;
    margin: 0.5rem 0;
  }
  width: 100%;
  padding-left: 2rem;
  padding-right: 2rem;
`;

const BorrowMetricsRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  padding-left: 2rem;
  padding-right: 2rem;
`;

const BorrowMetricsCol = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0 2rem;
`;

const JustifyCenterAndAlignButtonRow = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 1rem;
`;

const JustifyCenterRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 1rem;
`;

const Metrics = styled.div`
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  color: ${({ theme }) => theme.palette.brandLight};
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const MetricContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
`;

export const RemoveMargin = styled.div`
  margin-top: -25px;
`;

export const BackButton = styled.img`
  width: 0.75rem;
  cursor: pointer;
  position: absolute;
  top: 1.25rem;
  left: 1rem;
`;

export const Title = styled.div`
  font-size: 1.5rem;
  padding-bottom: 1rem;
  padding-top: 1.25rem;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
  background: linear-gradient(
    90deg,
    rgba(196, 196, 196, 0) 0.49%,
    rgba(89, 89, 89, 0.48) 50.04%,
    rgba(196, 196, 196, 0) 100%
  );
`;

export const RangeLabel = styled.div`
  margin-bottom: 0.6rem;
  text-align: left;
  font-size: 0.8rem;
  letter-spacing: 0.075rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

export const RangeSlider = styled.input.attrs({ type: 'range' })<{
  progress: number;
}>`
  -webkit-appearance: none;
  width: 100%;
  height: 0.5rem;
  background: ${({ theme }) => theme.palette.brandLight};
  outline: none;
  border-radius: 1rem;
  margin-bottom: 0.4rem;

  // Progress style with brand and brandLight
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.palette.brand} ${({ progress }) => progress}%,
    ${({ theme }) => theme.palette.brandLight} ${({ progress }) => progress}%
  );
  transition: background 0.2s ease-in-out;

  // Thumb styles
  ::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.palette.brand};
    cursor: pointer;
  }
  ::-moz-range-thumb {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.palette.brand};
    cursor: pointer;
  }
`;

export const GradientContainer = styled.div`
  background: linear-gradient(
    90deg,
    rgba(196, 196, 196, 0) 0.49%,
    rgba(89, 89, 89, 0.48) 50.04%,
    rgba(196, 196, 196, 0) 100%
  );
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
  padding: 0.5rem 0;
  margin: 1rem 0;
`;

export const Warning = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: left;
  text-align: left;
  gap: 0.5rem;
  p {
    font-size: 0.8rem;
  }
  margin-bottom: -0.5rem;
`;

type InfoCircleProps = {
  inline?: boolean;
};

export const InfoCircle = styled.div<InfoCircleProps>`
  margin: 0.25rem;
  padding: 0.5rem;
  display: ${({ inline }) => (inline ? 'inline-flex' : 'flex')};
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.palette.brand};
`;

export const FlexColCenter = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;
