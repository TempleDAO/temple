import { CloseImage, NavGroup, NavItem } from 'components/DApp/NavComponents';
import { DAppView } from 'enums/dapp-view';
import React from 'react';
import styled from 'styled-components';

const ENV_VARS = import.meta.env;
interface NavProps {
  small?: boolean;
  onClose?: () => void;
}

export const Nav = React.forwardRef<HTMLElement, NavProps>(
  ({ small, onClose }, ref) => {
    const Container = small ? NavMobileContainer : NavContainer;
    return (
      // @ts-ignore
      <Container ref={ref}>
        {small && <CloseImage onClick={onClose} />}
        <NavGroup>
          <NavItem close={onClose} view={DAppView.BUY} />
          <NavItem close={onClose} view={DAppView.STAKE} />
        </NavGroup>
        {ENV_VARS.VITE_PUBLIC_TEMPLE_DEVOTION_ENGAGED && (
          <NavGroup>
            <NavItem close={onClose} view={DAppView.DEVOTION} />
          </NavGroup>
        )}
        <NavGroup>
          <NavItem close={onClose} view={DAppView.UNLOCK} />
          <NavItem close={onClose} view={DAppView.QUEUE} />
          <NavItem close={onClose} view={DAppView.WITHDRAW} />
          <NavItem close={onClose} view={DAppView.SELL} />
        </NavGroup>
        <NavGroup>
          <NavItem close={onClose} view={DAppView.PROFILE} />
        </NavGroup>
      </Container>
    );
  }
);

Nav.displayName = 'Nav';

const NavContainer = styled.div`
  // border: 1px solid red;

  width: 160px;
  padding-top: 60px;
  padding-left: 23px;
`;
const NavMobileContainer = styled.div`
  border-right: 2px solid #bd7b4f;
  padding-top: 60px;
  padding-left: 20px;
  position: absolute;
  background: #000;
  z-index: 10;
  top: 0px;
  left: 0px;
  bottom: 0px;
  width: 200px;
  text-align: left;
`;
