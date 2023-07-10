import { Popover } from 'components/Popover';
import styled from 'styled-components';
import daiImg from 'assets/images/newui-images/tokens/dai.png';
import templeImg from 'assets/images/newui-images/tokens/temple.png';
import checkmark from 'assets/images/newui-images/check.svg';
import leftCaret from 'assets/images/newui-images/leftCaret.svg';
import { TradeButton } from './Home';
import { useEffect, useState } from 'react';
import { Input } from './HomeInput';
import { formatToken } from 'utils/formatter';
import { ZERO, fromAtto } from 'utils/bigNumber';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import { TempleLineOfCredit__factory } from 'types/typechain';
import env from 'constants/env';
import { getBigNumberFromString, getTokenInfo } from 'components/Vault/utils';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import { BigNumber } from 'ethers';
import { useNotification } from 'providers/NotificationProvider';
import { ERC20__factory } from 'types/typechain/typechain';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

type Screen = 'overview' | 'supply' | 'withdraw' | 'borrow' | 'repay';

export const TLCModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  const { balance, wallet, updateBalance, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();
  const [screen, setScreen] = useState<Screen>('overview');
  const [state, setState] = useState({
    supplyValue: '',
    withdrawValue: '',
    borrowValue: '1000',
    repayValue: '',
    inputToken: TICKER_SYMBOL.TEMPLE_TOKEN,
    outputToken: TICKER_SYMBOL.DAI,
    inputTokenBalance: ZERO,
    outputTokenBalance: ZERO,
  });
  const [checkbox, setCheckbox] = useState(false);
  const [progress, setProgress] = useState(0);
  const [accountPosition, setAccountPosition] = useState<ITlcDataTypes.AccountPositionStructOutput>();
  const [minBorrow, setMinBorrow] = useState<BigNumber>();
  const [borrowRate, setBorrowRate] = useState<BigNumber>();

  useEffect(() => {
    const onMount = async () => {
      await updateBalance();
      if (!signer || !wallet) return;
      const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
      const position = await tlcContract.accountPosition(wallet);
      const min = await tlcContract.MIN_BORROW_AMOUNT();
      const debtInfo = await tlcContract.totalDebtPosition();
      const rate = debtInfo.borrowRate;
      setAccountPosition(position);
      setMinBorrow(min);
      setBorrowRate(rate);
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

  const supply = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.supplyValue, getTokenInfo(state.inputToken).decimals);

    // Ensure allowance for TLC to spend TEMPLE
    const templeContract = new ERC20__factory(signer).attach(env.contracts.temple);
    await ensureAllowance(TICKER_SYMBOL.TEMPLE_TOKEN, templeContract, env.contracts.tlc, amount);

    const tx = await tlcContract.addCollateral(amount, wallet);
    const receipt = await tx.wait();
    openNotification({
      title: `Supplied ${state.supplyValue} TEMPLE`,
      hash: receipt.transactionHash,
    });
    updateBalance();
  };

  const withdraw = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.withdrawValue, getTokenInfo(state.inputToken).decimals);
    const tx = await tlcContract.removeCollateral(amount, wallet);
    const receipt = await tx.wait();
    openNotification({
      title: `Withdrew ${state.withdrawValue} TEMPLE`,
      hash: receipt.transactionHash,
    });
    updateBalance();
  };

  const borrow = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.borrowValue, getTokenInfo(state.outputToken).decimals);
    try {
      console.log(fromAtto(amount));

      const tx = await tlcContract.borrow(amount, wallet);
      const receipt = await tx.wait();
      openNotification({
        title: `Borrowed ${state.borrowValue} DAI`,
        hash: receipt.transactionHash,
      });
      updateBalance();
    } catch (e) {
      console.log(e);
    }
  };

  const repay = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.repayValue, getTokenInfo(state.outputToken).decimals);

    // Ensure allowance for TLC to spend DAI
    const daiContract = new ERC20__factory(signer).attach(env.contracts.dai);
    await ensureAllowance(TICKER_SYMBOL.DAI, daiContract, env.contracts.tlc, amount);

    const tx = await tlcContract.repay(amount, wallet);
    const receipt = await tx.wait();
    openNotification({
      title: `Repaid ${state.repayValue} DAI`,
      hash: receipt.transactionHash,
    });
    updateBalance();
  };

  const MAX_LTV = 75;
  const getEstimatedLTV = (): string => {
    return accountPosition
      ? (
          ((fromAtto(accountPosition.currentDebt) + Number(state.borrowValue)) /
            fromAtto(accountPosition?.collateral)) *
          100
        ).toFixed(2)
      : '0.00';
  };

  return (
    <>
      <Popover isOpen={isOpen} onClose={onClose} closeOnClickOutside showCloseButton>
        <ModalContainer>
          {screen === 'supply' ? (
            <>
              <RemoveMargin />
              <BackButton src={leftCaret} onClick={() => setScreen('overview')} />
              <Title>Supply TEMPLE</Title>
              {/* TODO: Make width 100% */}
              <Input
                crypto={{
                  kind: 'value',
                  value: 'TEMPLE',
                }}
                handleChange={(value: string) => setState({ ...state, supplyValue: value })}
                isNumber
                value={state.supplyValue}
                placeholder="0"
                onHintClick={() => {
                  setState({ ...state, supplyValue: formatToken(state.inputTokenBalance, state.inputToken) });
                }}
                min={0}
                hint={`Balance: ${formatToken(state.inputTokenBalance, state.inputToken)}`}
              />
              {/* Only display range slider if the user has borrows */}
              {accountPosition?.currentDebt.gt(0) && (
                <>
                  <MarginTop />
                  <RangeLabel>Estimated DAI LTV</RangeLabel>
                  {/* TODO: Change progress to progress / TokenBalance * 100 */}
                  <RangeSlider
                    onChange={(e) => setProgress(Number(e.target.value))}
                    value={progress}
                    progress={progress}
                  />
                  <FlexBetween>
                    <RangeLabel>0%</RangeLabel>
                    <RangeLabel>80%</RangeLabel>
                  </FlexBetween>
                  <GradientContainer>
                    <Warning>
                      <InfoCircle>
                        <p>i</p>
                      </InfoCircle>
                      <p>
                        If your DAI LTV reaches the liquidation threshold, your TEMPLE collateral will be liquidated.
                      </p>
                    </Warning>
                    <Copy style={{ textAlign: 'left' }}>
                      Given the current TPI price of <strong>$1.06</strong>, your TEMPLE collateral will be liquidated
                      on
                      <strong>10/02/2024</strong>.
                    </Copy>
                  </GradientContainer>
                </>
              )}
              <TradeButton onClick={() => supply()}>Supply</TradeButton>
            </>
          ) : screen === 'withdraw' ? (
            <>
              <RemoveMargin />
              <BackButton src={leftCaret} onClick={() => setScreen('overview')} />
              <Title>Withdraw TEMPLE</Title>
              {/* TODO: Make width 100% */}
              <Input
                crypto={{
                  kind: 'value',
                  value: 'TEMPLE',
                }}
                handleChange={(value: string) => setState({ ...state, withdrawValue: value })}
                isNumber
                value={state.withdrawValue}
                placeholder="0"
                onHintClick={() => {
                  setState({ ...state, withdrawValue: formatToken(accountPosition?.collateral, state.inputToken) });
                }}
                min={0}
                hint={`Supplies: ${formatToken(accountPosition?.collateral, state.inputToken)}`}
              />
              {/* Only display if user has borrows */}
              {accountPosition?.currentDebt.gt(0) && (
                <>
                  <Warning>
                    <InfoCircle>
                      <p>i</p>
                    </InfoCircle>
                    <p>
                      Since you have borrow positions, the max amount represents the amount of supplied TEMPLE that you
                      can withdraw without liquidation.
                    </p>
                  </Warning>
                  <MarginTop />
                  <RangeLabel>Estimated DAI LTV</RangeLabel>
                  {/* TODO: Change progress to progress / TokenBalance * 100 */}
                  <RangeSlider
                    onChange={(e) => setProgress(Number(e.target.value))}
                    value={progress}
                    progress={progress}
                  />
                  <FlexBetween>
                    <RangeLabel>0%</RangeLabel>
                    <RangeLabel>80%</RangeLabel>
                  </FlexBetween>
                  <GradientContainer>
                    <Copy style={{ textAlign: 'left' }}>
                      Given the current TPI price of <strong>$1.06</strong>, your TEMPLE collateral will be liquidated
                      on
                      <strong>10/02/2024</strong>.
                    </Copy>
                  </GradientContainer>
                </>
              )}
              <TradeButton onClick={() => withdraw()}>Withdraw</TradeButton>
            </>
          ) : screen === 'borrow' ? (
            <>
              <RemoveMargin />
              <BackButton src={leftCaret} onClick={() => setScreen('overview')} />
              <Title>Borrow DAI</Title>
              <Input
                crypto={{
                  kind: 'value',
                  value: 'DAI',
                }}
                handleChange={(value: string) => setState({ ...state, borrowValue: value })}
                isNumber
                value={state.borrowValue}
                placeholder="1000"
                onHintClick={() => {
                  setState({
                    ...state,
                    borrowValue: accountPosition
                      ? ((fromAtto(accountPosition.collateral) * MAX_LTV) / 100).toFixed(2)
                      : '0',
                  });
                }}
                min={1000}
                hint={`Max: ${
                  accountPosition ? ((fromAtto(accountPosition.collateral) * MAX_LTV) / 100).toFixed(2) : 0
                }`}
              />
              <Warning>
                <InfoCircle>
                  <p>i</p>
                </InfoCircle>
                <p>You must borrow at least {formatToken(minBorrow, TICKER_SYMBOL.DAI)} DAI</p>
              </Warning>
              <MarginTop />
              <RangeLabel>Estimated DAI LTV: {getEstimatedLTV()}%</RangeLabel>
              <RangeSlider
                onChange={(e) => {
                  if (!accountPosition) return;
                  let ltvPercent = ((Number(e.target.value) / 100) * MAX_LTV) / 100;
                  // Min LTV allowed is the current LTV
                  const minLtv = fromAtto(accountPosition.loanToValueRatio) * 100;
                  if (ltvPercent < minLtv) ltvPercent = minLtv;
                  // Compute the DAI value for the input element based on the LTV change
                  const daiValue = (fromAtto(accountPosition.collateral) * ltvPercent).toFixed(2);
                  setState({ ...state, borrowValue: `${daiValue}` });
                }}
                min={0}
                max={100}
                value={(Number(getEstimatedLTV()) / MAX_LTV) * 100}
                progress={(Number(getEstimatedLTV()) / MAX_LTV) * 100}
              />
              <FlexBetween>
                <RangeLabel>0%</RangeLabel>
                <RangeLabel>{MAX_LTV}%</RangeLabel>
              </FlexBetween>
              <GradientContainer>
                <Apy>
                  {borrowRate ? (fromAtto(borrowRate) * 100).toFixed(2) : 0}% <span>APR</span>
                </Apy>
                <Rule />
                <Copy style={{ textAlign: 'left' }}>
                  Given the current TPI price of <strong>$1.06</strong>, your TEMPLE collateral will be liquidated on
                  <strong>10/02/2024</strong>.
                </Copy>
              </GradientContainer>
              <RiskAcknowledgement>
                <Checkbox onClick={() => setCheckbox(!checkbox)} isChecked={checkbox} src={checkmark} />
                <div>
                  <p>I acknowledge the risks of borrowing including increased risk of liquidation.</p>
                  <a href="#">Find out more</a>
                </div>
              </RiskAcknowledgement>
              <TradeButton
                onClick={() => borrow()}
                disabled={
                  !checkbox || (accountPosition && fromAtto(accountPosition.maxBorrow) < Number(state.borrowValue))
                }
              >
                Borrow
              </TradeButton>
            </>
          ) : screen === 'repay' ? (
            <>
              <RemoveMargin />
              <BackButton src={leftCaret} onClick={() => setScreen('overview')} />
              <Title>Repay DAI</Title>
              <Input
                crypto={{
                  kind: 'value',
                  value: 'DAI',
                }}
                handleChange={(value: string) => setState({ ...state, repayValue: value })}
                isNumber
                value={state.repayValue}
                placeholder="0"
                onHintClick={() => {
                  setState({ ...state, repayValue: formatToken(state.outputTokenBalance, state.outputToken) });
                }}
                min={0}
                // TODO: Max should be either max DAI in wallet or the total DAI loans
                hint={`Max: ${formatToken(state.outputTokenBalance, state.outputToken)}`}
              />
              <MarginTop />
              <RangeLabel>Estimated DAI LTV</RangeLabel>
              {/* TODO: Change progress to progress / TokenBalance * 100 */}
              <RangeSlider onChange={(e) => setProgress(Number(e.target.value))} value={progress} progress={progress} />
              <FlexBetween>
                <RangeLabel>0%</RangeLabel>
                <RangeLabel>80%</RangeLabel>
              </FlexBetween>
              <TradeButton onClick={() => repay()}>Repay</TradeButton>
            </>
          ) : (
            <>
              <RemoveMargin />
              <Title>Supplies</Title>
              <ValueContainer>
                <TokenImg src={templeImg} />
                <NumContainer>
                  <LeadMetric>
                    {accountPosition?.collateral
                      ? formatToken(accountPosition?.collateral, TICKER_SYMBOL.TEMPLE_TOKEN)
                      : 0}{' '}
                    TEMPLE
                  </LeadMetric>
                  <USDMetric>$0 USD</USDMetric>
                </NumContainer>
              </ValueContainer>
              <Copy>Supply TEMPLE as collateral to borrow DAI</Copy>
              <Rule />
              <FlexRow>
                <TradeButton onClick={() => setScreen('supply')}>Supply</TradeButton>
                <TradeButton onClick={() => setScreen('withdraw')} disabled={accountPosition?.collateral.lte(0)}>
                  Withdraw
                </TradeButton>
              </FlexRow>
              <MarginTop />
              <Title>Borrows</Title>
              <ValueContainer>
                <TokenImg src={daiImg} />
                <NumContainer>
                  <LeadMetric>
                    {accountPosition?.currentDebt ? formatToken(accountPosition?.currentDebt, TICKER_SYMBOL.DAI) : 0}{' '}
                    DAI
                  </LeadMetric>
                  <USDMetric>$0 USD</USDMetric>
                </NumContainer>
              </ValueContainer>
              <FlexCol>
                <FlexBetween>
                  <p>LTV</p>
                  <BrandParagraph>
                    {accountPosition?.collateral.gt(0)
                      ? (fromAtto(accountPosition?.loanToValueRatio) * 100).toFixed(2)
                      : 0}
                    %
                  </BrandParagraph>
                </FlexBetween>
                <FlexBetween>
                  <p>
                    Liquidation
                    <br />
                    threshold
                  </p>
                  <BrandParagraph>{MAX_LTV}%</BrandParagraph>
                </FlexBetween>
                <FlexBetween>
                  <p>Borrow Rate</p>
                  <BrandParagraph>{borrowRate ? (fromAtto(borrowRate) * 100).toFixed(2) : 0}%</BrandParagraph>
                </FlexBetween>
              </FlexCol>
              <MarginTop />
              <Copy>
                Given the current TPI price of <strong>$1.06</strong>, your TEMPLE collateral will be liquidated on
                <strong>10/02/2024</strong>.
              </Copy>
              <Rule />
              <FlexRow>
                <TradeButton onClick={() => setScreen('borrow')} disabled={accountPosition?.collateral.lte(0)}>
                  Borrow
                </TradeButton>
                <TradeButton onClick={() => setScreen('repay')} disabled={accountPosition?.currentDebt.lte(0)}>
                  Repay
                </TradeButton>
              </FlexRow>
            </>
          )}
        </ModalContainer>
      </Popover>
    </>
  );
};

// Overview Styles
const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  color: ${({ theme }) => theme.palette.brand};
  width: 350px;
`;

const RemoveMargin = styled.div`
  margin-top: -25px;
`;

const BackButton = styled.img`
  width: 0.75rem;
  cursor: pointer;
  position: absolute;
  top: 1.25rem;
  left: 1rem;
`;

const Title = styled.div`
  font-size: 1.5rem;
  padding-bottom: 1rem;
  padding-top: 1rem;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
  background: linear-gradient(
    90deg,
    rgba(196, 196, 196, 0) 0.49%,
    rgba(89, 89, 89, 0.48) 50.04%,
    rgba(196, 196, 196, 0) 100%
  );
`;

const Copy = styled.p`
  color: ${({ theme }) => theme.palette.brandLight};
  letter-spacing: 0.05rem;
  font-size: 0.9rem;
`;

const MarginTop = styled.div`
  margin-top: 1rem;
`;

const Rule = styled.hr`
  border: 0;
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  margin: 0.5rem 0 0 0;
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

const LeadMetric = styled.div`
  font-size: 1.5rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const USDMetric = styled.div`
  font-size: 0.9rem;
`;

const FlexRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const FlexCol = styled.div`
  display: flex;
  flex-direction: column;
  margin: auto;
  text-align: left;
  min-width: 200px;
`;

const FlexBetween = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${({ theme }) => theme.palette.brandLight};

  p {
    font-size: 1rem;
    margin: 0.5rem 0;
  }
`;

const BrandParagraph = styled.p`
  color: ${({ theme }) => theme.palette.brand};
`;

// Supply styles
const RangeLabel = styled.div`
  margin-bottom: 0.6rem;
  text-align: left;
  font-size: 0.8rem;
  letter-spacing: 0.075rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const RangeSlider = styled.input.attrs({ type: 'range' })<{ progress: number }>`
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

const GradientContainer = styled.div`
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

const Warning = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  text-align: left;
  gap: 0.5rem;
  p {
    font-size: 0.8rem;
  }
  margin-bottom: -1rem;
`;

const InfoCircle = styled.div`
  margin: 0.25rem;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.palette.brand};
`;

const Apy = styled.p`
  font-size: 1.75rem;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0.75rem 0;
  span {
    font-size: 0.9rem;
  }
`;

const RiskAcknowledgement = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
  background: #24272c;
  border-radius: 0.375rem;
  padding: 0.5rem;
  text-align: left;
  font-size: 0.85rem;
  line-height: 1.1rem;
  p {
    font-size: 0.85rem;
    color: ${({ theme }) => theme.palette.brandLight};
    margin: 0;
    margin-bottom: 0.5rem;
  }
  a {
    color: ${({ theme }) => theme.palette.brand};
    text-decoration: underline;
    &:hover {
      text-decoration: none;
    }
  }
`;

const Checkbox = styled.div<{ src: string; isChecked: boolean }>`
  display: block;
  padding: 0.88rem;
  margin: 0.25rem;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.palette.brand};
  cursor: pointer;
  background: ${({ src, isChecked }) => (isChecked ? `url('${src}')` : 'transparent')};
  background-repeat: no-repeat;
  background-position: center;
  background-size: 1.1rem;
`;

export default TLCModal;
