// @ts-nocheck
import { ReactChild } from 'react';
import styled, { css } from 'styled-components';
import { transparentize } from 'polished';

import Loader from 'components/Loader/Loader';

interface StatsCardProps {
  className?: string;
  label?: string;
  stat: string | number;
  fontColor?: string;
  statDelta?: number;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  description?: ReactChild;
  darken?: boolean;
  heightPercentage?: number;
  smallStatFont?: boolean;
  isSquare?: boolean;
  height?: string;
  isLoading?: boolean;
}

const StatsCard = ({
  className,
  label,
  stat,
  fontColor,
  statDelta,
  backgroundColor,
  backgroundImageUrl,
  description,
  darken,
  heightPercentage,
  smallStatFont,
  isSquare = true,
  height = '100%',
  isLoading = false,
}: StatsCardProps) => {
  const deltaLabel = `${statDelta >= 0 ? '▲' : '▼'} ${(statDelta * 100).toFixed(
    2
  )}%`;

  return (
    <FlexCol className={className}>
      <SquareWrapper
        heightPercentage={heightPercentage}
        isSquare={isSquare}
        height={height}
      >
        <CardStyled
          backgroundColor={backgroundColor}
          backgroundImageUrl={backgroundImageUrl}
          fontColor={fontColor}
          darken={darken}
          isSquare={isSquare}
          height={height}
        >
          {isLoading ? (
            <Loader />
          ) : (
            <>
              <div>
                {statDelta && <Pill fontColor={fontColor}>{deltaLabel}</Pill>}
              </div>
              <div>
                {label ? <StatLabel>{label.toUpperCase()}</StatLabel> : null}
                <Stat smallFont={smallStatFont}>
                  {stat?.toString().toUpperCase()}
                </Stat>
              </div>
            </>
          )}
        </CardStyled>
      </SquareWrapper>
      {description ? (
        <DescriptionWrapper>{description}</DescriptionWrapper>
      ) : null}
    </FlexCol>
  );
};

interface CardWrapperProps {
  background?: string;
  fontColor?: string;
  isSquare?: boolean;
  height?: string;
}

const FlexCol = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
`;

const CardStyled = styled.div<CardWrapperProps>`
  position: absolute;
  width: 100%;
  height: ${({ isSquare, height }) => (isSquare ? '100%' : height)};
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1em;
  background-color: ${(props) =>
    props.backgroundColor || props.theme.palette.dark};
  background-image: ${(props) => {
    if (props.backgroundImageUrl && props.darken) {
      return `linear-gradient( rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4) ), url("${props.backgroundImageUrl}")`;
    } else if (props.backgroundImageUrl) {
      return `linear-gradient( rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2) ), url("${props.backgroundImageUrl}")`;
    }
    return 'none';
  }};
  background-size: cover;
  background-position: center;
  border-radius: 5px;
  color: ${(props) => props.fontColor || props.theme.palette.light};
  border: 1px solid ${(props) => props.theme.palette.brand};
`;

const SquareWrapper = styled.div<{ isSquare: boolean; height: string }>`
  position: relative;
  width: 100%;
  height: ${({ height }) => height};
  ${({ isSquare }) =>
    isSquare &&
    css`
      padding-bottom: ${(props) => props.heightPercentage || '100'}%;
    `}
`;

const Pill = styled.div`
  background: ${(props) =>
    transparentize(0.75, props.fontColor || props.theme.palette.light)};
  display: inline-block;
  border-radius: 1em;
  padding: 0.25em 0.75em;
  ${(props) => props.theme.typography.meta};
`;

const Stat = styled.strong<{ smallFont?: boolean }>`
  ${(props) =>
    props.smallFont ? props.theme.typography.h4 : props.theme.typography.h2};
  font-weight: 900;
  display: block;
  width: 100%;
  text-align: right;
`;

const StatLabel = styled.span`
  ${(props) => props.theme.typography.meta};
  display: block;
`;

const DescriptionWrapper = styled.span`
  ${(props) => props.theme.typography.meta};
  margin-top: 0.5em;
  display: inline-block;
`;

export default StatsCard;
