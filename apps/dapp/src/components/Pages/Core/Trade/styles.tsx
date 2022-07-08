import styled from 'styled-components';

import { VaultButton } from '../VaultPages/VaultContent';
import { NAV_MOBILE_HEIGHT_PIXELS, NAV_DESKTOP_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';

import arrow from 'assets/icons/amm-arrow.svg';
import Gear from 'assets/icons/gear.svg';

import { pixelsToRems } from 'styles/mixins';
import { phoneAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';

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

export const NexusContainer = styled.div`
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
  background-color: transparent;
  background: url(${Gear});
  background-repeat: no-repeat;
  background-size: fill;
  filter: brightness(0.75);
  border: none;

  height: 1.5rem;
  width: 1.5rem;

  transition: 500ms ease;

  :hover:not(:disabled) {
    background-color: transparent;
    filter: brightness(1);
    cursor: pointer;
  }
`;

export const CtaButton = styled(VaultButton)`
  width: auto;
  font-size: 1.2rem;
  letter-spacing: 0.25rem;
  transition: 500ms ease;
  margin: 0 auto;
`;

export const Header = styled.h3`
  margin: 0 0 1rem;
  text-align: left;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

export const ErrorLabel = styled.span`
  color: ${theme.palette.enclave.chaos};
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  width: 95vw;
  max-width: 36rem;
  margin: 1rem 0;
  text-align: center;
`;
