import styled from 'styled-components';

import Image from '../../../Image/Image';
import { QuestData, RARITY_TYPE } from '../types';

import { keyframes } from 'styled-components';
import { NexusTooltip } from '../Relic/NexusTooltip';

import env from '../../../../constants/env';

export interface QuestCellProps {
  quest: QuestData;
}

const QuestCell = ({ quest }: QuestCellProps) => {
  const shards = env.nexus.shardMetadata;

  const handleMouseOver = () => {
    console.log('mouse over');
  }

  return (
    <CellContainer>
      <CellRow>
        <RowText align={'left'} bold={true}>
          {quest.title}
        </RowText>
        <RowText align={'right'} bold={true}>
          {`Quest #${quest.id}`}
        </RowText>
      </CellRow>
      <CellRow>
        <RowText>{`Origin: ${quest.origin}`}</RowText>
        <RowText align={'right'}>
          <TravelLink target="_blank" href={quest.linkUrl}>
            JOURNEY
          </TravelLink>
        </RowText>
      </CellRow>
      <CellRow>
        <DescriptionContainer>
          <span>{quest.description}</span>
          <QuestLogo src={quest.logoUrl} width={100} height={100} />
        </DescriptionContainer>
      </CellRow>
      <RewardsRow>
        <RowText>Rewards</RowText>
        <RowText align={'right'}>{RARITY_TYPE[quest.rarity]}</RowText>
      </RewardsRow>
      <RewardIconsRow>
        {quest.rewardIds.map((shardId) => {
          const shard = shards[shardId];
          if (!shard) {
            throw new Error('Invalid shard id');
          }
          return (
            <NexusTooltip shard={shard}>
              <RewardIcon onMouseOver={handleMouseOver} src={shard.logoUrl} />
            </NexusTooltip>
          );
        })}
      </RewardIconsRow>
    </CellContainer>
  );
};

const animation = keyframes`
  from {
    text-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff, 0 0 40px #0c0b0b, 0 0 50px #0c0b0b, 0 0 60px #0c0b0b,
      0 0 70px #0c0b0b;
  }

  to {
    text-shadow: 0 0 20px #fff, 0 0 30px #fff, 0 0 40px #fff, 0 0 50px #fff, 0 0 60px #fff,
      0 0 70px #fff, 0 0 80px #fff;
  }
`;

const TravelLink = styled.a`
  color: #000;
  font-weight: normal;
  // text-decoration: underline;
  text-shadow: 2px 2px 5px white;
  font-size: 16pt;
  color: #fff;
  text-align: center;

  color: #fff;
  text-align: center;
  animation: ${animation} 1s ease-in-out infinite alternate;
`;

const QuestLogo = styled(Image)`
  margin-left: 20px;
  width: 100px;
  height: 100px;
  border-radius: 15%;
`;

const RewardIcon = styled(Image)`
  margin: 6px;
  width: 75px;
  height: 75px;
  border-radius: 15%;
`;

const RewardIconsRow = styled.div`
  padding: 5px 0 0 5px;
`;

const RewardsRow = styled.div`
  display: flex;
  padding: 10px 10px 0 10px;
  font-size: 16pt;
`;

const DescriptionContainer = styled.div`
  display: flex;
  align-items: center;
`;

const CellRow = styled.div`
  padding: 10px;
  display: flex;
  justify-content: space-between;
`;

const RowText = styled.span<{ align?: string; bold?: boolean }>`
  font-weight: ${(props) => (props.bold ? 'bold' : 'normal')};
  text-align: ${(props) => (props.align === 'right' ? 'right' : 'left')};
  flex: 1;
`;

const CellContainer = styled.div<{ color?: string }>`
  flex-direction: column;
  align-items: center;
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 16px;
  padding: 1rem;
  color: #000;
  margin: 15px 0 15px 0;
  background-color: ${(props) => props.color ?? props.theme.palette.brand75};
`;

export default QuestCell;
