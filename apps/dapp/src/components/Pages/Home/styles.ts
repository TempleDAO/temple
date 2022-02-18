import styled from 'styled-components';
import { aboveMobileBreakpoint } from 'styles/breakpoints';

export const Row = styled.section`
  display: flex;
  flex-direction: column-reverse;
  width: 100%;

  ${aboveMobileBreakpoint(`
    flex-direction: row;
  `)}
`;

export const RowCell = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  flex-direction: column;

  ${aboveMobileBreakpoint(`
    width: 50%;
  `)}
`;

export const SunGateWrapper = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  width: fit-content;
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