import styled from 'styled-components';

import {
  NAV_MOBILE_HEIGHT_PIXELS,
  NAV_DESKTOP_HEIGHT_PIXELS,
} from 'components/Layouts/CoreLayout/Header';
import { tabletAndAbove } from 'styles/breakpoints';
import { pixelsToRems } from 'styles/mixins';

export const CenterScreenWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 100%;
  min-height: calc(100vh - ${pixelsToRems(NAV_MOBILE_HEIGHT_PIXELS)}rem);

  ${tabletAndAbove(`
    min-height: calc(100vh - ${pixelsToRems(NAV_DESKTOP_HEIGHT_PIXELS)}rem);
    // Offset header
    padding-bottom: ${pixelsToRems(NAV_DESKTOP_HEIGHT_PIXELS)}rem;
  `)}
`;
