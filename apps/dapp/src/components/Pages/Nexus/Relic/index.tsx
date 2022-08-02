import bgActive from 'assets/images/nexus-room-active.jpg';
import bgInactive from 'assets/images/nexus-room-inactive.jpg';
import { VITE_PUBLIC_DEV_MODE } from 'providers/env';
import { useRelic } from 'providers/RelicProvider';
import { ItemInventory } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { FC, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageWrapper } from '../../Core/utils';
import { DevMintPage } from './DevMintPage';
import { NoRelicPanel } from './NoRelicPanel';
import { RelicPage } from './RelicPages';
import { NexusBackground, NexusBodyContainer, NexusContainer, NexusPanelRow } from './styles';

const NexusPage = () => {
  const { wallet, isConnected } = useWallet();
  const { inventory, updateInventory } = useRelic();

  useEffect(() => {
    updateInventory();
  }, [wallet, isConnected]);
  const bgImage = inventory?.relics.length ? bgActive : bgInactive

  return <PageWrapper>
    <NexusBackground style={{
      backgroundImage: `url(${bgImage})`,
    }}/>
    <NexusContainer>
      <NexusBodyContainer>
        { inventory ? <NexusRoutes inventory={inventory} /> : <NexusLoading /> }
      </NexusBodyContainer>
    </NexusContainer>
  </PageWrapper>
}

const NexusLoading = () => {
  return <NexusPanelRow>
    <span>Loading...</span>
  </NexusPanelRow>
}

const NexusRoutes: FC<{ inventory: ItemInventory }> = (props) => {
  return <Routes>
    <Route path="no-relic" element={<NoRelicPanel inventory={props.inventory} />} />
    <Route path=":id" element={<RelicPage inventory={props.inventory} />} />
    { VITE_PUBLIC_DEV_MODE && <Route path="dev-mint" element={<DevMintPage />} /> }
    <Route path="*" element={<Navigate to="no-relic" />} />
  </Routes>
}

export default NexusPage