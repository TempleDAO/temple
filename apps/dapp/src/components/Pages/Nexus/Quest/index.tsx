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
import Accordion from './QuestAccordion';
import QuestHeader from './QuestHeader';
import './style.css';

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

  const quests = [
    {
      id: '1',
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
    } as QuestData,
    {
      id: '2',
      title: 'Spirit in the Sky',
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
    } as QuestData,
    {
      id: '3',
      title: 'Lightning in the Bottle',
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
    } as QuestData,    
  ];

  // create type if you need intellisense
  type CompProps = typeof quests[0] & {
    isOpen: boolean;
  };

  const SummaryComponent = ({ id, title, isOpen }: CompProps) => (
    <QuestHeader id={id} title={title} isOpen={isOpen} />
    // <div className="header">
    //   {title} <span className={(isOpen ? 'open' : '') + ' chevron'}></span>
    // </div>
  );

  // component will get wrapped in <div class="acc-content">
  const DetailComponent = ({id,  ...props }: CompProps) => {
    const quest: QuestData = {
      id,
      title: props.title,
      origin: props.origin,
      linkUrl: props.linkUrl,
      description: props.description,
      logoUrl: props.logoUrl,
      rewardLogoUrls: props.rewardLogoUrls,
      rarity: props.rarity,
    };

    console.log('props');
    console.log(quest);
    return <QuestCell quest={quest} />;
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
          <QuestPanel>
            <Accordion
              items={quests}
              SummaryComponent={SummaryComponent}
              multiExpand={false}
              DetailComponent={DetailComponent}
            />
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
