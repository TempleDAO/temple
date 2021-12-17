import React from 'react';
import styled from 'styled-components';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';

interface DataCardProps {
  title: string;
  data: string;
  tooltipContent?: string;
}

/**
 * Primary UI component for user interaction
 */
export const DataCard = ({ title, data, tooltipContent }: DataCardProps) => {
  return (
    <DataCardStyled>
      <TitleContainer>
        <small>{title}</small>
        {tooltipContent && (
          <Tooltip content={tooltipContent} position={'left'}>
            <TooltipIcon />
          </Tooltip>
        )}
      </TitleContainer>
      <DataContainer>{data}</DataContainer>
    </DataCardStyled>
  );
};

const DataCardStyled = styled.div`
  display: flex;
  flex-direction: column;
  padding: 1rem;
  width: 100%;
  background-color: ${(props) => props.theme.palette.dark};
  border: 1px solid ${(props) => props.theme.palette.brand50};
`;

const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const DataContainer = styled.p`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin: 1rem 0 0;
`;
