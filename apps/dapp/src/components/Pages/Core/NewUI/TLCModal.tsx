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
import { ZERO } from 'utils/bigNumber';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import { TempleLineOfCredit__factory } from 'types/typechain';
import env from 'constants/env';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

type Screen = 'overview' | 'supply' | 'withdraw' | 'borrow' | 'repay';

export const TLCModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  const [screen, setScreen] = useState<Screen>('overview');
  const [state, setState] = useState({
    inputValue: '',
    outputValue: '',
    inputToken: TICKER_SYMBOL.TEMPLE_TOKEN,
    outputToken: TICKER_SYMBOL.DAI,
    inputTokenBalance: ZERO,
    outputTokenBalance: ZERO,
  });
  const [checkbox, setCheckbox] = useState(false);
  const [progress, setProgress] = useState(0);
  const { balance, wallet, updateBalance, signer } = useWallet();

  // Update token balances on mount
  useEffect(() => {
    const onMount = async () => {
      await updateBalance();
      setState({
        ...state,
        inputTokenBalance: balance.TEMPLE,
        outputTokenBalance: balance.DAI,
      });
      console.log(env.contracts.tlc);

      if (!signer || !wallet) return;
      const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
      const accountData = await tlcContract.accountData(wallet);
      console.log(accountData);
      const accountPosition = await tlcContract.accountPosition(wallet);
      console.log(accountPosition);
    };
    onMount();
  }, [wallet]);

  const supply = () => {
    console.log('supply');
  };

  const withdraw = () => {
    console.log('withdraw');
  };

  const borrow = () => {
    console.log('borrow');
  };

  const repay = () => {
    console.log('repay');
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
                handleChange={(value: string) => setState({ ...state, inputValue: value })}
                isNumber
                value={state.inputValue}
                placeholder="0"
                onHintClick={() => {
                  setState({ ...state, inputValue: formatToken(state.inputTokenBalance, state.inputToken) });
                }}
                min={0}
                hint={`Balance: ${formatToken(state.inputTokenBalance, state.inputToken)}`}
              />
              <MarginTop />
              <RangeLabel>Estimated DAI LTV</RangeLabel>
              {/* TODO: Change progress to progress / TokenBalance * 100 */}
              <RangeSlider onChange={(e) => setProgress(Number(e.target.value))} value={progress} progress={progress} />
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
                    If the DAI LTV reaches the liquidation threshold of 80%, your TEMPLE collateral will be liquidated.
                  </p>
                </Warning>
                <Copy style={{ textAlign: 'left' }}>
                  Given the current TPI price of <strong>$1.06</strong>, your TEMPLE collateral will be liquidated on
                  <strong>10/02/2024</strong>.
                </Copy>
              </GradientContainer>
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
                handleChange={(value: string) => setState({ ...state, inputValue: value })}
                isNumber
                value={state.inputValue}
                placeholder="0"
                onHintClick={() => {
                  setState({ ...state, inputValue: formatToken(state.inputTokenBalance, state.inputToken) });
                }}
                min={0}
                hint={`Balance: ${formatToken(state.inputTokenBalance, state.inputToken)}`}
              />
              <Warning>
                <InfoCircle>
                  <p>i</p>
                </InfoCircle>
                <p>
                  Since you have borrow positions, the max amount represents the amount of supplied TEMPLE that you can
                  withdraw without liquidation.
                </p>
              </Warning>
              <MarginTop />
              <RangeLabel>Estimated DAI LTV</RangeLabel>
              {/* TODO: Change progress to progress / TokenBalance * 100 */}
              <RangeSlider onChange={(e) => setProgress(Number(e.target.value))} value={progress} progress={progress} />
              <FlexBetween>
                <RangeLabel>0%</RangeLabel>
                <RangeLabel>80%</RangeLabel>
              </FlexBetween>
              <GradientContainer>
                <Copy style={{ textAlign: 'left' }}>
                  Given the current TPI price of <strong>$1.06</strong>, your TEMPLE collateral will be liquidated on
                  <strong>10/02/2024</strong>.
                </Copy>
              </GradientContainer>
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
                handleChange={(value: string) => setState({ ...state, outputValue: value })}
                isNumber
                value={state.outputValue}
                placeholder="0"
                onHintClick={() => {
                  setState({ ...state, outputValue: formatToken(state.outputTokenBalance, state.outputToken) });
                }}
                min={0}
                hint={`Max: ${formatToken(state.outputTokenBalance, state.outputToken)}`}
              />
              <Warning>
                <InfoCircle>
                  <p>i</p>
                </InfoCircle>
                <p>This max amount prevents liquidation.</p>
              </Warning>
              <MarginTop />
              <RangeLabel>Estimated DAI LTV</RangeLabel>
              {/* TODO: Change progress to progress / TokenBalance * 100 */}
              <RangeSlider onChange={(e) => setProgress(Number(e.target.value))} value={progress} progress={progress} />
              <FlexBetween>
                <RangeLabel>0%</RangeLabel>
                <RangeLabel>80%</RangeLabel>
              </FlexBetween>
              <GradientContainer>
                <Apy>
                  5.2% <span>APY</span>
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
                  <a href="#">Find out more.</a>
                </div>
              </RiskAcknowledgement>
              <TradeButton onClick={() => borrow()}>Borrow</TradeButton>
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
                handleChange={(value: string) => setState({ ...state, outputValue: value })}
                isNumber
                value={state.outputValue}
                placeholder="0"
                onHintClick={() => {
                  setState({ ...state, outputValue: formatToken(state.outputTokenBalance, state.outputToken) });
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
                  <LeadMetric>16,318.53 TEMPLE</LeadMetric>
                  <USDMetric>$17,234.25 USD</USDMetric>
                </NumContainer>
              </ValueContainer>
              <Copy>Supply TEMPLE as collateral to borrow DAI</Copy>
              <Rule />
              <FlexRow>
                <TradeButton onClick={() => setScreen('supply')}>Supply</TradeButton>
                <TradeButton onClick={() => setScreen('withdraw')}>Withdraw</TradeButton>
              </FlexRow>
              <MarginTop />
              <Title>Borrows</Title>
              <ValueContainer>
                <TokenImg src={daiImg} />
                <NumContainer>
                  <LeadMetric>50,000.00 DAI</LeadMetric>
                  <USDMetric>$49,000.58 USD</USDMetric>
                </NumContainer>
              </ValueContainer>
              <FlexCol>
                <FlexBetween>
                  <p>LTV</p>
                  <BrandParagraph>70%</BrandParagraph>
                </FlexBetween>
                <FlexBetween>
                  <p>
                    Liquidation
                    <br />
                    threshold
                  </p>
                  <BrandParagraph>85%</BrandParagraph>
                </FlexBetween>
                <FlexBetween>
                  <p>APY</p>
                  <BrandParagraph>2.58%</BrandParagraph>
                </FlexBetween>
              </FlexCol>
              <MarginTop />
              <Copy>
                Given the current TPI price of <strong>$1.06</strong>, your TEMPLE collateral will be liquidated on
                <strong>10/02/2024</strong>.
              </Copy>
              <Rule />
              <FlexRow>
                <TradeButton onClick={() => setScreen('borrow')}>Borrow</TradeButton>
                <TradeButton onClick={() => setScreen('repay')}>Repay</TradeButton>
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
