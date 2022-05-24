import { FC } from 'react';
import { Route, Routes, Link as BaseLink, useResolvedPath, useMatch } from 'react-router-dom';
import styled from 'styled-components';

import { Trade } from './views/Trade';
import { Unstake } from './views/Unstake';
import { Stake } from './views/Stake';
import { PageWrapper } from '../utils';
import { Container } from './styles';
import { tabletAndAbove } from 'styles/breakpoints';

const TradeRoutes = () => {
  return (
    <>
      <PageWrapper>
        <Container>
          <div>
            <MenuWrapper>
              <Menu>
                <TradeLink to="/core/dapp/trade">Trade</TradeLink>
                <TradeLink to="/core/dapp/trade/unstake">Unstake / Withdraw</TradeLink>
                <TradeLink to="/core/dapp/trade/stake">Stake</TradeLink>
              </Menu>
            </MenuWrapper>
            <Wrapper>
              <Routes>
                <Route path="/" element={<Trade />} />
                <Route path="/unstake" element={<Unstake />} />
                <Route path="/stake" element={<Stake />} />
              </Routes>
            </Wrapper>
          </div>
        </Container>
      </PageWrapper>
    </>
  );
};

const TradeLink: FC<{ to: string }> = (props) => {
  const resolved = useResolvedPath(props.to);
  const match = useMatch({ path: resolved.pathname, end: true });
  return (
    <Link {...props} $isActive={!!match} />
  );
};

const Wrapper = styled.div`
  ${tabletAndAbove(`
    padding: 1.5rem 2rem 2.5rem;
    border-radius: 2rem;
    box-shadow: 0 0 5rem #1D1A1A;
    max-width: 40rem;
  `)}
`;

const MenuWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  max-width: 40rem;
  margin: 0 auto 1.5rem;
  justify-content: space-between;
`;

const Menu = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const Link = styled(BaseLink)<{ $isActive: boolean }>`
  padding: .5rem 1rem;
  border-radius: .5rem;
  display: block;
  background: ${({ $isActive, theme }) => $isActive ? '#1D1A1A' : 'transparent'};
`;

export default TradeRoutes;