import styled from 'styled-components';

import { VaultButton } from '../VaultPages/VaultContent';
import { NAV_MOBILE_HEIGHT_PIXELS, NAV_DESKTOP_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';
import arrow from 'assets/icons/amm-arrow.svg';
import { pixelsToRems } from 'styles/mixins';
import { phoneAndAbove } from 'styles/breakpoints';

import Gear from 'assets/icons/gear.svg';

export const Container = styled.section`
  margin-top: ${pixelsToRems(NAV_MOBILE_HEIGHT_PIXELS)}rem;
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;

  ${phoneAndAbove(`
    margin-top: ${pixelsToRems(NAV_DESKTOP_HEIGHT_PIXELS)}rem;
  `)}
`;

export const SwapContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
`;

export const InputsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
`;

export const InvertButton = styled.button`
  position: absolute;
  height: 2.5rem;
  width: 2.5rem;
  top: calc(50% - 1.35rem);
  left: calc(50% - 1.25rem);
  border: none;
  cursor: pointer;
  background: url(${arrow});
  transition: 150ms ease;
  background-repeat: no-repeat;
  background-size: cover;
  border-radius: 100%;

  :hover {
    transform: rotate(180deg);
  }
`;

export const Spacer = styled.div`
  height: ${pixelsToRems(10)}rem;
`;

export const SettingsButton = styled.button`
  position: relative;
  left: calc(50% - 0.75rem);
  background-color: transparent;
  background: url(${Gear});
  background-repeat: no-repeat;
  background-size: fill;
  filter: brightness(0.75);
  border: none;

  height: 1.5rem;
  width: 1.5rem;

  margin-bottom: 0.75rem;

  transition: 500ms ease;

  :hover:not(:disabled) {
    background-color: transparent;
    filter: brightness(1);
    cursor: pointer;
  }
`;

export const SwapButton = styled(VaultButton)`
  width: 70%;
  font-size: 1.2rem;
  letter-spacing: 0.25rem;
  transition: 500ms ease;
`;