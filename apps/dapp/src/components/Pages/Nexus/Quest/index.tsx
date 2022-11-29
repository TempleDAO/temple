import bgActive from 'assets/images/nexus/background_on.jpg';
import bgInactive from 'assets/images/nexus/background_off.jpg';
import { useRelic } from 'providers/RelicProvider';
import { useWallet } from 'providers/WalletProvider';
import { useEffect } from 'react';
import { PageWrapper } from '../../Core/utils';
import { NexusBackground, NexusBodyContainer, NexusContainer } from '../Relic/styles';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import QuestCell from './QuestCell';
import Accordion from './QuestAccordion';
import QuestHeader from './QuestHeader';
import env from '../../../../constants/env';
import { QuestData } from '../types';

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

  const quests = env.nexus.quests;

  type CompProps = typeof quests[0] & {
    isOpen: boolean;
  };

  const SummaryComponent = ({ id, title, isOpen }: CompProps) => <QuestHeader id={id} title={title} isOpen={isOpen} />;

  const DetailComponent = ({ id, ...props }: CompProps) => {
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
