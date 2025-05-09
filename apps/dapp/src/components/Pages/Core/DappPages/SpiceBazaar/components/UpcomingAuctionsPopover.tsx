import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import reminder from 'assets/icons/reminder.svg?react';
import repete from 'assets/icons/repete.svg?react';

export type PopOverData = {
  date: string;
  amount: string;
  reminder?: boolean;
};

interface PopoverProps {
  titles: string[];
  data: PopOverData[];
  width: string;
  isOpen: boolean;
  onClose: () => void;
  repeatRow?: boolean;
}

export const UpcomingAuctionsPopover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  data,
  titles,
  width,
  repeatRow,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <PopoverContainer ref={popoverRef} width={width}>
      {repeatRow && (
        <ExtraRow>
          <RepeteIcon />
          Repeats monthly
        </ExtraRow>
      )}
      <FirstRow>
        {titles.map((title) => (
          <Title key={title}>{title}</Title>
        ))}
      </FirstRow>
      {data.map((item) => (
        <DataColumns key={item.date}>
          <LeftData>
            <Data>{item.date}</Data>
          </LeftData>
          <RightData>
            <Data>{item.amount}</Data>
          </RightData>
          {item.reminder && (
            <ReminderContainer>
              <ReminderIcon />
            </ReminderContainer>
          )}
        </DataColumns>
      ))}
    </PopoverContainer>
  );
};

const PopoverContainer = styled.div<{ width: string }>`
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: ${({ theme }) => theme.palette.dark};
  color: ${({ theme }) => theme.palette.brandLight};
  border: solid 1px ${({ theme }) => theme.palette.brand};
  border-radius: 5px;
  width: ${({ width }) => width};
  z-index: 100;
  margin-top: 5px;
`;

const ExtraRow = styled.div`
  display: flex;
  flex-direction: row;
  gap: 5px;
  padding: 10px;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: ${({ theme }) => theme.palette.brandLight};
  border-bottom: solid 1px ${({ theme }) => theme.palette.brand};
`;

const FirstRow = styled.div`
  display: flex;
  flex-direction: row;
  gap: 10px;
  padding: 10px 10px 5px 10px;

  & > *:nth-child(3) {
    text-align: center;
  }
`;

const Title = styled.p`
  min-width: 100px;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  text-align: left;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const DataColumns = styled.div`
  display: flex;
  flex-direction: row;
  flex-grow: 1;
  gap: 10px;
`;

const RightData = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 100px;
  padding: 0px 10px;
`;

const LeftData = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 100px;
  padding: 0px 10px;
`;

const Data = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 10px 0px;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  color: ${({ theme }) => theme.palette.brand};
`;

const ReminderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 100px;
  gap: 10px;
  padding: 10px 10px 10px 30px;
`;

const ReminderIcon = styled(reminder)``;

const RepeteIcon = styled(repete)``;
