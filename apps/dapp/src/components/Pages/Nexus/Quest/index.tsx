import bgActive from 'assets/images/nexus-room-active.jpg';
import bgInactive from 'assets/images/nexus-room-inactive.jpg';
import { useRelic } from 'providers/RelicProvider';
import { useWallet } from 'providers/WalletProvider';
import { useEffect } from 'react';
import { PageWrapper } from '../../Core/utils';
import { NexusBackground, NexusBodyContainer, NexusContainer } from '../Relic/styles';

const QuestPage = () => {
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
        <h2>Quests</h2>
      </NexusBodyContainer>
    </NexusContainer>
  </PageWrapper>
}

export default QuestPage