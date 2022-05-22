import { useState } from 'react';
import { Route, Routes, Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { Trade } from './Trade';
import { Unstake } from './Unstake';
import { PageWrapper } from '../utils';
import { Container, SettingsButton, } from './styles';
import { theme } from 'styles/theme';
import { useSwapController } from './use-swap-controller';

const TradeRoutes = () => {
  const swapController = useSwapController();
  const [isSlippageModalOpen, setIsSlippageModalOpen] = useState(false);

  return (
    <>
      <TransactionSettingsModal
        isOpen={isSlippageModalOpen}
        onClose={() => setIsSlippageModalOpen(false)}
        onChange={(settings) => swapController.handleTxSettingsUpdate(settings)}
      />
      <PageWrapper>
        <Container>
          <Wrapper>
            <MenuWrapper>
              <Menu>
                <TradeLink to="/core/dapp/trade">Trade</TradeLink>
                <TradeLink to="/core/dapp/trade/unstake">Unstake / Withdraw</TradeLink>
              </Menu>
              <SettingsButton onClick={() => setIsSlippageModalOpen(true)} />
            </MenuWrapper>
            <Routes>
              <Route path="/" element={<Trade {...swapController} setIsSlippageModalOpen={setIsSlippageModalOpen} />} />
              <Route path="/unstake" element={<Unstake />} />
            </Routes>
          </Wrapper>
        </Container>
      </PageWrapper>
    </>
  );
};

const Wrapper = styled.div`
  background: #1D1A1A;
  padding: 1.5rem 2rem 2.5rem;
  border-radius: 2rem;
  box-shadow: 0 0 5rem rgba(0, 0, 0, .1);
`;

const MenuWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  max-width: 36.0625rem; // 577px
  margin: 0 auto 1.25rem;
  justify-content: space-between;
`;

const Menu = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const TradeLink = styled(Link)`
  margin-right: 1rem;
  padding: .5rem 0;
  display: block;
`;

export default TradeRoutes;