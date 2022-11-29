import styled from 'styled-components';

import Image from '../../../Image/Image';
import { QuestData, RARITY_TYPE } from '../types';


export interface QuestCellProps {
  quest: QuestData;
}

const QuestCell = ({ quest }: QuestCellProps) => {
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
          <TravelLink href={quest.linkUrl}>Travel</TravelLink>
        </RowText>
      </CellRow>
      <CellRow>
        <DescriptionContainer>
          <span>{quest.description}</span>
          <Image src={quest.logoUrl} width={100} height={100} />
        </DescriptionContainer>
      </CellRow>
      <RewardsRow>
        <RowText>Rewards</RowText>
        <RowText align={'right'}>{RARITY_TYPE[quest.rarity]}</RowText>
      </RewardsRow>
      <RewardIconsRow>
        {quest.rewardLogoUrls.map((rewardLogo) => (
          <RewardIcon src={rewardLogo} />
        ))}
      </RewardIconsRow>
    </CellContainer>
  );
};

const TravelLink = styled.a`
  color: #000;
  font-weight: normal;
`;

const RewardIcon = styled(Image)`
  margin: 6px;
  width: 20px;
  height: 20px;
`;

const RewardIconsRow = styled.div`
  padding: 5px 0 0 5px;
`;

const RewardsRow = styled.div`
  display: flex;
  padding: 10px 10px 0 10px;
`;

const DescriptionContainer = styled.div`
  display: flex;
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
