import styled from 'styled-components';
import { useEffect, useState } from 'react';
import { ZERO, fromAtto } from 'utils/bigNumber';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import { ERC20__factory, TempleLineOfCredit__factory, TreasuryReservesVault__factory } from 'types/typechain';
import env from 'constants/env';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import { fetchGenericSubgraph } from 'utils/subgraph';
import { BigNumber } from 'ethers';
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
import { TemplePriceChart } from './Chart';

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
};

export const MAX_LTV = 75;

export type Prices = { templePrice: number; daiPrice: number; tpi: number };

export const BorrowPage = () => {
  const { balance, wallet, updateBalance, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();
  const [modal, setModal] = useState<'closed' | 'supply' | 'withdraw' | 'borrow' | 'repay'>('closed');
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
  const [activeScreen, setActiveScreen] = useState<'supply' | 'borrow'>('supply');
  const [accountPosition, setAccountPosition] = useState<ITlcDataTypes.AccountPositionStructOutput>();
  const [tlcInfo, setTlcInfo] = useState<TlcInfo>();
  const [prices, setPrices] = useState<Prices>({ templePrice: 0, daiPrice: 0, tpi: 0 });

  const getPrices = async () => {
    const { data } = await fetchGenericSubgraph(
      'https://api.thegraph.com/subgraphs/name/templedao/templedao-ramos',
      `{
        metrics {
          treasuryPriceIndexUSD
          templePriceUSD
        }
      }`
    );
    setPrices({
      templePrice: parseFloat(data.metrics[0].templePriceUSD),
      daiPrice: 1,
      tpi: parseFloat(data.metrics[0].treasuryPriceIndexUSD),
    });
  };

  useEffect(() => {
    const onMount = async () => {
      await updateBalance();
      await getTlcInfo();
      await getPrices();
    };
    onMount();
  }, [signer]);

  // Update token balances
  useEffect(() => {
    setState({
      ...state,
      inputTokenBalance: balance.TEMPLE,
      outputTokenBalance: balance.DAI,
    });
  }, [balance]);

  const getTlcInfo = async () => {
    if (!signer || !wallet) return;
    try {
      const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
      const position = await tlcContract.accountPosition(wallet);
      setAccountPosition(position);

      const min = await tlcContract.minBorrowAmount();
      const debtInfo = await tlcContract.debtTokenDetails();

      // Get strategy balance
      const trvContract = new TreasuryReservesVault__factory(signer).attach(env.contracts.treasuryReservesVault);
      const tlcStrategy = await tlcContract.tlcStrategy();
      const daiToken = await tlcContract.daiToken();
      // Amount configured to borrow based on the current utilisation
      const availableForStrategy = await trvContract.availableForStrategyToBorrow(tlcStrategy, daiToken);
      // DAI left in TRV for all strategies (including what's in DSR base strategy)
      const availableDai = await trvContract.totalAvailable(daiToken);
      const debtCeiling = await trvContract.strategyDebtCeiling(tlcStrategy, daiToken);

      setTlcInfo({
        minBorrow: fromAtto(min),
        borrowRate: fromAtto(debtInfo[1].interestRate),
        liquidationLtv: fromAtto(debtInfo[0].maxLtvRatio),
        strategyBalance: Math.min(fromAtto(availableForStrategy), fromAtto(availableDai)),
        debtCeiling: fromAtto(debtCeiling),
      });
    } catch (e) {
      console.log(e);
    }
  };

  const getLiquidationInfo = (additionalDebt?: number) => {
    if (!accountPosition || !tlcInfo) return <></>;
    const liquidationLtv = tlcInfo.liquidationLtv;
    const collateral = fromAtto(accountPosition.collateral);
    const debt = fromAtto(accountPosition.currentDebt) + (additionalDebt || 0);
    const liquidationTpi = debt / liquidationLtv / collateral;
    const liquidationDebt = collateral * liquidationLtv;
    return (
      <>
        Given a {((debt / collateral) * 100).toFixed(2)}% LTV ratio, your collateral will be liquidated if TPI falls to{' '}
        <strong>${liquidationTpi.toFixed(3)}</strong> or if your debt rises to{' '}
        <strong>${liquidationDebt.toFixed(2)}</strong>.
      </>
    );
  };

  const supply = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.supplyValue, getTokenInfo(state.inputToken).decimals);
    try {
      // Ensure allowance for TLC to spend TEMPLE
      const templeContract = new ERC20__factory(signer).attach(env.contracts.temple);
      await ensureAllowance(TICKER_SYMBOL.TEMPLE_TOKEN, templeContract, env.contracts.tlc, amount);
      // Add collateral
      const tx = await tlcContract.addCollateral(amount, wallet);
      const receipt = await tx.wait();
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
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.withdrawValue, getTokenInfo(state.inputToken).decimals);
    try {
      const tx = await tlcContract.removeCollateral(amount, wallet, { gasLimit: 160000 });
      const receipt = await tx.wait();
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
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.borrowValue, getTokenInfo(state.outputToken).decimals);
    try {
      const tx = await tlcContract.borrow(amount, wallet, { gasLimit: 350000 });
      const receipt = await tx.wait();
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
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.repayValue, getTokenInfo(state.outputToken).decimals);
    try {
      // Ensure allowance for TLC to spend DAI
      const daiContract = new ERC20__factory(signer).attach(env.contracts.dai);
      await ensureAllowance(TICKER_SYMBOL.DAI, daiContract, env.contracts.tlc, amount);
      // Repay DAI
      const tx = await tlcContract.repay(amount, wallet, { gasLimit: 250000 });
      const receipt = await tx.wait();
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
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.repayValue, getTokenInfo(state.outputToken).decimals);
    try {
      // Ensure allowance for TLC to spend DAI
      const daiContract = new ERC20__factory(signer).attach(env.contracts.dai);
      await ensureAllowance(TICKER_SYMBOL.DAI, daiContract, env.contracts.tlc, amount);
      // Repay DAI
      const tx = await tlcContract.repayAll(wallet, { gasLimit: 350000 });
      const receipt = await tx.wait();
      openNotification({
        title: `Repaid ${accountPosition ? fromAtto(accountPosition.currentDebt).toFixed(2) : amount} DAI`,
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

  const getBorrowRate = () => (tlcInfo ? (tlcInfo.borrowRate * 100).toFixed(2) : 0);

  return (
    <>
      <FlexRow>
        <FlexCol>
          <MinWidth>
            <FlexBetween>
              <MetricContainer>
                <LeadMetric>${tlcInfo && tlcInfo.debtCeiling.toLocaleString()}</LeadMetric>
                <BrandParagraph>Total Debt Ceiling</BrandParagraph>
              </MetricContainer>
              <MetricContainer>
                <LeadMetric>${tlcInfo && tlcInfo.strategyBalance.toLocaleString()}</LeadMetric>
                <BrandParagraph>Available to Borrow</BrandParagraph>
              </MetricContainer>
              <MetricContainer>
                <LeadMetric>{getBorrowRate()}%</LeadMetric>
                <BrandParagraph>Current Borrow APY</BrandParagraph>
              </MetricContainer>
            </FlexBetween>
            <TemplePriceChart />
          </MinWidth>
        </FlexCol>

        <TlcContainer>
          <TlcTabs>
            <TlcTab isActive={activeScreen == 'supply'} onClick={() => setActiveScreen('supply')}>
              <p>Supplies</p>
            </TlcTab>
            <TlcTab isActive={activeScreen == 'borrow'} onClick={() => setActiveScreen('borrow')}>
              <p>Borrows</p>
            </TlcTab>
          </TlcTabs>
          {activeScreen == 'supply' ? (
            <>
              <ValueContainer>
                <TokenImg src={templeImg} />
                <NumContainer>
                  <LeadMetric>
                    {accountPosition?.collateral ? formatToken(accountPosition?.collateral, state.inputToken) : 0}{' '}
                    TEMPLE
                  </LeadMetric>
                  <USDMetric>
                    $
                    {accountPosition?.collateral
                      ? (fromAtto(accountPosition.collateral) * prices.templePrice).toLocaleString('en')
                      : 0}{' '}
                    USD
                  </USDMetric>
                </NumContainer>
              </ValueContainer>
              <Copy>Supply TEMPLE as collateral to borrow DAI</Copy>
              <Rule />
              <JustifyEvenlyRow>
                <TradeButton onClick={() => setModal('supply')} disabled={!accountPosition}>
                  Supply
                </TradeButton>
                <TradeButton
                  onClick={() => setModal('withdraw')}
                  disabled={!accountPosition || accountPosition?.collateral.lte(0)}
                >
                  Withdraw
                </TradeButton>
              </JustifyEvenlyRow>
              <MarginTop />
            </>
          ) : (
            <>
              <ValueContainer>
                <TokenImg src={daiImg} />
                <NumContainer>
                  <LeadMetric>
                    {accountPosition?.currentDebt ? formatToken(accountPosition?.currentDebt, state.outputToken) : 0}{' '}
                    DAI
                  </LeadMetric>
                  <USDMetric>
                    $
                    {accountPosition?.currentDebt
                      ? (fromAtto(accountPosition.currentDebt) * prices.daiPrice).toLocaleString('en')
                      : 0}{' '}
                    USD
                  </USDMetric>
                </NumContainer>
              </ValueContainer>
              <BorrowMetricsCol>
                <FlexBetween>
                  <BrandParagraph>Your LTV</BrandParagraph>
                  <p>
                    {accountPosition?.collateral.gt(0)
                      ? (fromAtto(accountPosition.loanToValueRatio) * 100).toFixed(2)
                      : 0}
                    %
                  </p>
                </FlexBetween>
                <FlexBetween>
                  <BrandParagraph>Liquidation LTV</BrandParagraph>
                  <p>{tlcInfo ? tlcInfo.liquidationLtv * 100 : 0}%</p>
                </FlexBetween>
                <FlexBetween>
                  <BrandParagraph>Interest Rate</BrandParagraph>
                  <p>{getBorrowRate()}%</p>
                </FlexBetween>
                {accountPosition?.currentDebt.gt(0) && (
                  <>
                    <Rule />
                    <Copy>{getLiquidationInfo()}</Copy>
                  </>
                )}
              </BorrowMetricsCol>
              <MarginTop />
              {accountPosition?.currentDebt.gt(0) && <Copy>{getLiquidationInfo()}</Copy>}
              <Rule />
              <JustifyEvenlyRow>
                <TradeButton
                  onClick={() => setModal('borrow')}
                  disabled={!accountPosition || accountPosition?.collateral.lte(0)}
                >
                  Borrow
                </TradeButton>
                <TradeButton
                  onClick={() => setModal('repay')}
                  disabled={!accountPosition || accountPosition?.currentDebt.lte(0)}
                >
                  Repay
                </TradeButton>
              </JustifyEvenlyRow>
              <MarginTop />
            </>
          )}
        </TlcContainer>
      </FlexRow>

      {/* Modal for executing supply/withdraw/borrow/repay */}
      <Popover isOpen={modal != 'closed'} onClose={() => setModal('closed')} closeOnClickOutside showCloseButton>
        <ModalContainer>
          {modal === 'supply' ? (
            <Supply
              accountPosition={accountPosition}
              state={state}
              minBorrow={tlcInfo?.minBorrow}
              setState={setState}
              supply={supply}
              back={() => setModal('closed')}
            />
          ) : modal === 'withdraw' ? (
            <Withdraw
              accountPosition={accountPosition}
              state={state}
              setState={setState}
              withdraw={withdraw}
              back={() => setModal('closed')}
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
              back={() => setModal('closed')}
            />
          ) : (
            <Repay
              accountPosition={accountPosition}
              state={state}
              setState={setState}
              repay={repay}
              repayAll={repayAll}
              back={() => setModal('closed')}
            />
          )}
        </ModalContainer>
      </Popover>
    </>
  );
};

const FlexRow = styled.div`
  display: flex;
  flex-direction: row;
  @media (max-width: 1240px) {
    flex-direction: column;
    gap: 3rem;
    align-items: center;
  }
`;

const FlexCol = styled.div`
  display: flex;
  flex-direction: column;
`;

const MinWidth = styled.div`
  width: 750px;
  margin-right: 3rem;
  @media (max-width: 768px) {
    width: 90%;
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
  width: 350px;
  height: min-content;
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
  background: ${({ isActive, theme }) => (isActive ? theme.palette.gradients.dark : 'transparent')};
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

const MarginTop = styled.div`
  margin-top: 1rem;
`;

const LeadMetric = styled.div`
  font-size: 1.5rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const USDMetric = styled.div`
  font-size: 0.9rem;
`;

const Copy = styled.p`
  color: ${({ theme }) => theme.palette.brandLight};
  letter-spacing: 0.05rem;
  font-size: 0.9rem;
`;

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  color: ${({ theme }) => theme.palette.brand};
  width: 350px;
`;

const Rule = styled.hr`
  border: 0;
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  margin: 0.5rem 0 0 0;
`;

const BrandParagraph = styled.p`
  color: ${({ theme }) => theme.palette.brand};
`;

const FlexBetween = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${({ theme }) => theme.palette.brandLight};

  p {
    font-size: 1rem;
    margin: 0.5rem 0;
  }
`;

const BorrowMetricsCol = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0 2rem;
`;

const JustifyEvenlyRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
`;

const MetricContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
`;
