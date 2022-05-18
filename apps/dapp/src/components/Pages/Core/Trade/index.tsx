import { useState } from 'react';
import { Route, Routes, Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { Trade } from './views/Trade';
import { Unstake } from './views/Unstake';
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
          <MenuWrapper>
            <Menu>
              <TradeLink to="/core/dapp/trade">Trade</TradeLink>
              <TradeLink to="/core/dapp/trade/unstake">Unstake / Withdraw</TradeLink>
            </Menu>
            <SettingsButton onClick={() => setIsSlippageModalOpen(true)} />
          </MenuWrapper>
          <Routes>
            <Route path="/" element={<Trade {...swapController} />} />
            <Route path="/unstake" element={<Unstake />} />
          </Routes>
        </Container>
      </PageWrapper>
    </>
  );
};

const MenuWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  max-width: 36.0625rem; // 577px
  margin: 0 auto 1rem;
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
  background: ${theme.palette.dark75};
  display: block;
`;

export default TradeRoutes;