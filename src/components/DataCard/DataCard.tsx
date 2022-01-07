import React from 'react';
import styled from 'styled-components';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';

interface SizeProps {
  small?: boolean;
}

interface DataCardProps extends SizeProps {
  title: string;
  data: string;
  tooltipContent?: string;
  className?: string;
}

/**
 * Primary UI component for user interaction
 */
export const DataCard = ({
  title,
  data,
  tooltipContent,
  small,
  className,
}: DataCardProps) => {
  return (
    <DataCardStyled small={small} className={className}>
      <TitleContainer>
        <Title hasTooltip={!!tooltipContent}>{title}</Title>
        {tooltipContent && (
          <Tooltip content={tooltipContent} position={'top'}>
            <TooltipIcon />
          </Tooltip>
        )}
      </TitleContainer>
      <DataContainer small={small}>{data}</DataContainer>
    </DataCardStyled>
  );
};

const DataCardStyled = styled.div<SizeProps>`
  display: flex;
  flex-direction: column;
  padding: 1rem;
  width: 100%;
  background-color: ${(props) => props.theme.palette.dark};
  border: 1px solid ${(props) => props.theme.palette.brand50};

  ${({ small }) =>
    small &&
    `
    padding: 0.5rem;
    height: max-content;
    box-sizing: border-box;
  `}
`;

const TitleContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const DataContainer = styled.p<SizeProps>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin: 1rem 0 0;

  ${({ small }) =>
    small &&
    `
    margin-top: 0.5rem;
  `}
`;

interface TitleProps {
  hasTooltip?: boolean;
}

const Title = styled.small<TitleProps>`
  ${({ hasTooltip }) => hasTooltip && 'width: 80%;'}
`;
