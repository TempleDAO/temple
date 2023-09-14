import bgActive from 'assets/images/nexus/background_on.jpg';
import bgInactive from 'assets/images/nexus/background_off.png';
import { useRelic } from 'providers/RelicProvider';
import { ItemInventory } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { FC, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageWrapper } from '../../Core/utils';
import { NoRelicPanel } from './NoRelicPanel';
import { RelicPage } from './RelicPages';
import { NexusBackground, NexusBodyContainer, NexusContainer, NexusPanelRow } from './styles';

export const EMPTY_INVENTORY: ItemInventory = {
  relics: [],
  items: [],
};

const NexusPage = () => {
  const { wallet, signer, isConnected } = useWallet();
  const { inventory, updateInventory, inventoryLoading } = useRelic();

  useEffect(() => {
    if (!wallet || !signer || !isConnected) {
      return;
    }
    updateInventory();
  }, [wallet, signer, isConnected]);
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

export const NexusLoading = () => {
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
      {/* {isDevelopmentEnv() && <Route path="dev-mint" element={<DevMintPage />} />} */}
      <Route path="*" element={<Navigate to="no-relic" />} />
    </Routes>
  );
};

export default NexusPage;
