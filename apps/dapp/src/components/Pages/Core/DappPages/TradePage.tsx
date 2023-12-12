import styled from 'styled-components';
import { Trade } from '../NewUI/TradeNew';

export const TradePage = () => {
  return (
    <TradeContainer>
      <Trade />
    </TradeContainer>
  );
};

const TradeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;
