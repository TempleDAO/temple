import { NAV_MOBILE_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';
import styled from 'styled-components';
import { phoneAndAbove } from 'styles/breakpoints';

export const PageWrapper = styled.div`
  margin: ${NAV_MOBILE_HEIGHT_PIXELS}px 10px 10px 10px;

  ${phoneAndAbove(`
    margin: 40px 40px 40px 40px;
  `)}
`;
