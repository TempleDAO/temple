import daiImg from 'assets/images/newui-images/tokens/dai.png';
import templeImg from 'assets/images/newui-images/tokens/temple.png';
import { TradeButton } from '../Home';
import { formatToken } from 'utils/formatter';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import { FlexBetween, Screen, MAX_LTV, State, RemoveMargin, Title, Copy, MarginTop } from './TLCModal';
import { fromAtto } from 'utils/bigNumber';
import styled from 'styled-components';
import { BigNumber } from 'ethers';

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  borrowRate: BigNumber | undefined;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
}

export const Overview: React.FC<IProps> = ({ accountPosition, state, borrowRate, setScreen }) => {
  return (
    <>
      <RemoveMargin />
      <Title>Supplies</Title>
      <ValueContainer>
        <TokenImg src={templeImg} />
        <NumContainer>
          <LeadMetric>
            {accountPosition?.collateral ? formatToken(accountPosition?.collateral, state.inputToken) : 0} TEMPLE
          </LeadMetric>
          <USDMetric>$? USD</USDMetric>
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
            {accountPosition?.currentDebt ? formatToken(accountPosition?.currentDebt, state.outputToken) : 0} DAI
          </LeadMetric>
          <USDMetric>$? USD</USDMetric>
        </NumContainer>
      </ValueContainer>
      <FlexCol>
        <FlexBetween>
          <p>Your LTV</p>
          <BrandParagraph>
            {accountPosition?.collateral.gt(0) ? (fromAtto(accountPosition?.loanToValueRatio) * 100).toFixed(2) : 0}%
          </BrandParagraph>
        </FlexBetween>
        <FlexBetween>
          <p>Liquidation LTV</p>
          <BrandParagraph>{MAX_LTV}%</BrandParagraph>
        </FlexBetween>
        <FlexBetween>
          <p>Interest Rate</p>
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
  );
};

// Overview Styles
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

const BrandParagraph = styled.p`
  color: ${({ theme }) => theme.palette.brand};
`;

export default Overview;
