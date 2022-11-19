import bgActive from 'assets/images/nexus/background_on.jpg';
import bgInactive from 'assets/images/nexus/background_off.jpg';
import { useRelic } from 'providers/RelicProvider';
import { ItemInventory } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { FC, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isDevelopmentEnv } from 'utils/helpers';
import { PageWrapper } from '../../Core/utils';
import { DevMintPage } from './DevMintPage';
import { NoRelicPanel } from './NoRelicPanel';
import { RelicPage } from './RelicPages';
import { NexusBackground, NexusBodyContainer, NexusContainer, NexusPanelRow } from './styles';

export const EMPTY_INVENTORY: ItemInventory = {
  relics: [],
  items: [],
};

const NexusPage = () => {
  const { wallet, isConnected } = useWallet();
  const { inventory, updateInventory, inventoryLoading } = useRelic();

  useEffect(() => {
    updateInventory();
  }, [wallet, isConnected]);
  const bgImage = inventory?.relics.length ? bgActive : bgInactive;

  return (
    <PageWrapper>
      <NexusBackground
        style={{
          backgroundImage: `url(${bgImage})`,
        }}
      />
      <NexusContainer>
        <NexusBodyContainer>
          {inventoryLoading && <NexusLoading />}
          {!inventoryLoading && <NexusRoutes inventory={inventory || EMPTY_INVENTORY} />}
        </NexusBodyContainer>
      </NexusContainer>
    </PageWrapper>
  );
};

const NexusLoading = () => {
  return (
    <NexusPanelRow>
      <span>Loading...</span>
    </NexusPanelRow>
  );
};

const NexusRoutes: FC<{ inventory: ItemInventory }> = (props) => {
  return (
    <Routes>
      <Route path="no-relic" element={<NoRelicPanel inventory={props.inventory} />} />
      <Route path=":id" element={<RelicPage inventory={props.inventory} />} />
      {isDevelopmentEnv() && <Route path="dev-mint" element={<DevMintPage />} />}
      <Route path="*" element={<Navigate to="no-relic" />} />
    </Routes>
  );
};

export default NexusPage;
