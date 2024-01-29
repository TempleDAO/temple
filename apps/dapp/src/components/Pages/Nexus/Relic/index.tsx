import bgActive from 'assets/images/nexus/background_on.jpg';
import bgInactive from 'assets/images/nexus/background_off.png';
import { useRelic } from 'providers/RelicProvider';
import { ItemInventory } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { FC, useEffect, useMemo } from 'react';
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
  const { wallet, signer, isConnected, isConnecting } = useWallet();
  const { inventory, updateInventory, inventoryLoading } = useRelic();

  useEffect(() => {
    updateInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!wallet || !signer || !isConnected) {
      return;
    }
    updateInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, signer, isConnected, isConnecting]);

  const bgImage = useMemo(() => (inventory?.relics.length ? bgActive : bgInactive), [inventory?.relics.length]);

  const onSacrificeHandler = async () => {
    console.debug('Updating inventory after sacrifice');
    await updateInventory();
  };

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
          {!inventoryLoading && (
            <NexusRoutes inventory={inventory || EMPTY_INVENTORY} onSacrificeHandler={onSacrificeHandler} />
          )}
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

const NexusRoutes: FC<{ inventory: ItemInventory; onSacrificeHandler: () => Promise<void> }> = (props) => {
  return (
    <Routes>
      <Route
        path="no-relic"
        element={<NoRelicPanel inventory={props.inventory} onSacrificeHandler={props.onSacrificeHandler} />}
      />
      <Route path=":id" element={<RelicPage inventory={props.inventory} />} />
      {/* {isDevelopmentEnv() && <Route path="dev-mint" element={<DevMintPage />} />} */}
      <Route path="*" element={<Navigate to="no-relic" />} />
    </Routes>
  );
};

export default NexusPage;
