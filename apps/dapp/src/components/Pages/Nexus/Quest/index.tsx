import bgActive from 'assets/images/nexus/background_on.jpg';
import bgInactive from 'assets/images/nexus/background_off.jpg';
import { useRelic } from 'providers/RelicProvider';
import { useWallet } from 'providers/WalletProvider';
import { useEffect } from 'react';
import { PageWrapper } from '../../Core/utils';
import { NexusBackground, NexusBodyContainer, NexusContainer } from '../Relic/styles';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import QuestCell, { QuestData, RARITY_TYPE } from './QuestCell';

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

  const quests: QuestData[] = [
    {
      id: 1,
      title: 'Spirit of the Sands',
      origin: 'TempleDAO',
      linkUrl: 'https://templedao.link',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi accumsan libero sed placerat viverra. Praesent ac vehicula mauris, non ullamcorper metus. Vestibulum ultricies odio at libero pulvinar dapibus sed vel leo.',
      logoUrl: 'https://myst.mypinata.cloud/ipfs/QmaTErwf7sV9WzfP86GjDfnRBwKL74y2j9H4vUwNr7jMhE/0.png',
      rewardLogoUrls: [
        'https://myst.mypinata.cloud/ipfs/QmaTErwf7sV9WzfP86GjDfnRBwKL74y2j9H4vUwNr7jMhE/0.png',
        'https://myst.mypinata.cloud/ipfs/QmaTErwf7sV9WzfP86GjDfnRBwKL74y2j9H4vUwNr7jMhE/0.png',
        'https://myst.mypinata.cloud/ipfs/QmaTErwf7sV9WzfP86GjDfnRBwKL74y2j9H4vUwNr7jMhE/0.png',
      ],
      rarity: RARITY_TYPE.EPIC,
    },
    {
      id: 2,
      title: 'Spirit of the Sands',
      origin: 'TempleDAO',
      linkUrl: 'https://templedao.link',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi accumsan libero sed placerat viverra. Praesent ac vehicula mauris, non ullamcorper metus. Vestibulum ultricies odio at libero pulvinar dapibus sed vel leo.',
      logoUrl: 'https://myst.mypinata.cloud/ipfs/QmaTErwf7sV9WzfP86GjDfnRBwKL74y2j9H4vUwNr7jMhE/0.png',
      rewardLogoUrls: [
        'https://myst.mypinata.cloud/ipfs/QmaTErwf7sV9WzfP86GjDfnRBwKL74y2j9H4vUwNr7jMhE/0.png',
        'https://myst.mypinata.cloud/ipfs/QmaTErwf7sV9WzfP86GjDfnRBwKL74y2j9H4vUwNr7jMhE/0.png',
        'https://myst.mypinata.cloud/ipfs/QmaTErwf7sV9WzfP86GjDfnRBwKL74y2j9H4vUwNr7jMhE/0.png',
      ],
      rarity: RARITY_TYPE.EPIC,
    },
  ];

  return (
    <PageWrapper>
      <NexusBackground
        style={{
          backgroundImage: `url(${bgImage})`,
        }}
      />
      <NexusContainer>
        <NexusBodyContainer>
          <QuestPanel>
            {quests.map((quest) => (
              <QuestCell quest={quest} />
            ))}
          </QuestPanel>
        </NexusBodyContainer>
      </NexusContainer>
    </PageWrapper>
  );
};

const QuestPanel = styled.div<{ color?: string }>`
  flex-direction: column;
  align-items: center;
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 16px;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(15px);
  max-width: 700px;
`;

export default QuestPage;
