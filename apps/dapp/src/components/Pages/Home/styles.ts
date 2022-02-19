import styled, { css } from 'styled-components';

import { Button, ButtonProps } from 'components/Button/Button';
import { aboveMobileBreakpoint } from 'styles/breakpoints';

export const Row = styled.section`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 1rem 0;

  ${aboveMobileBreakpoint(`
    flex-direction: row;
  `)}
`;

export const RowCell = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;


  ${aboveMobileBreakpoint(`
    width: 50%;
    align-items: flex-start;

    &:nth-child(odd) {
      padding-right: 1rem;
    }

    &:nth-child(even) {
      padding-left: 1rem;
    }
  `)}
`;

export const SunGateWrapper = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  width: fit-content;
`;

export const EarnStableGainsHeader = styled.h2`
  font-size: 3rem;
  line-height: 3.5625rem;
  text-align: center;
  margin: 0;

  ${aboveMobileBreakpoint(`
    text-align: left;
    margin: 0 0 1em;
  `)}
`;

export const SleepEasyStakingText = styled.h4`
  margin: 0 0 2em;

  ${aboveMobileBreakpoint(`
    margin: 0 0 3em;
  `)}
`;

export const EarnStableGainsWrapper = styled.div`
  margin: 1rem 0 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  width: 100%;

  ${aboveMobileBreakpoint(`
    margin: 0;
    text-align: initial;
    margin-bottom: 3rem;
  `)}
`;

export const TempleDaoSun = styled.div`
  z-index: ${(props) => props.theme.zIndexes.up};

  position: absolute;
  transform-origin: center center;
  transform: translateY(44%);
  translate-origin: center center;

  width: 53%;

  img {
    animation: ${(props) => props.theme.animations.spin};
  }
`;

export const ResponsiveImage = styled.img`
  display: block;
  max-width: 100%;
  height: auto;
`;

export const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  max-width: 24.0625rem;
  width: 100%;
  margin: 0 auto 3rem;

  ${aboveMobileBreakpoint(`
    margin: 0 0 4rem;
    justify-content: space-between;
  `)}
`;

export const MetricsWrapper = styled.div`
  display: flex;
  justify-content: center;

  ${aboveMobileBreakpoint(`
    justify-content: flex-start;
  `)}
`;

interface CircleBgWrapperProps {
  rightAlign?: boolean;
}

export const CircleBgWrapper = styled.div<CircleBgWrapperProps>`
  position: absolute;
  transform: translateX(-50%);

  ${(props) =>
    props.rightAlign &&
    css`
      right: 0;
      transform: translateX(50%);
    `}
`;

export const ButtonContainer = styled.div`
  width: 9.6875rem;
`;

export const StyledButton = styled(Button)<ButtonProps>`
  width: 100%;
`;
