import styled from 'styled-components';
import { TradeWidget } from './Trade/TradeWidget';

export const TradePage = () => {
  return (
    <TradeContainer>
      <HeaderText>Trade</HeaderText>
      <TradeWidget />
    </TradeContainer>
  );
};

const HeaderText = styled.div`
  height: 32px;
  font-size: 36px;
  line-height: 42px;
  display: flex;
  align-items: center;
  text-align: center;
  color: #ffdec9;
  margin-top: 10px;
  margin-bottom: 40px;
`;

const TradeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;
