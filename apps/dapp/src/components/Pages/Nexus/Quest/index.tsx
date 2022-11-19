import bgActive from 'assets/images/nexus/background_on.jpg';
import bgInactive from 'assets/images/nexus/background_off.jpg';
import { useRelic } from 'providers/RelicProvider';
import { useWallet } from 'providers/WalletProvider';
import { useEffect } from 'react';
import { PageWrapper } from '../../Core/utils';
import { NexusBackground, NexusBodyContainer, NexusContainer } from '../Relic/styles';
import { useNavigate } from 'react-router-dom';

const QuestPage = () => {
  const { wallet, isConnected } = useWallet();
  const { inventory, updateInventory } = useRelic();
  const navigate = useNavigate();

  useEffect(() => {
    updateInventory();
  }, [wallet, isConnected]);

  useEffect(() => {
    if (inventory?.relics.length === 0) {
      navigate('/nexus/relic');
    }
  }, [inventory]);

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
          <h2>Quests</h2>
        </NexusBodyContainer>
      </NexusContainer>
    </PageWrapper>
  );
};

export default QuestPage;
