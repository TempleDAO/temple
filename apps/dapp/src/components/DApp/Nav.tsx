import React from 'react';
import styled from 'styled-components';

import { CloseImage, NavItem } from 'components/DApp/NavComponents';
import { DAppView } from 'enums/dapp-view';

const ENV_VARS = import.meta.env;

interface NavProps {
  small?: boolean;
  onClose?: () => void;
}

export const Nav = React.forwardRef<HTMLDivElement, NavProps>(
  ({ small, onClose }, ref) => {
    const Container = small ? NavMobileContainer : NavContainer;

    return (
      <Container ref={ref}>
        {small && <CloseImage onClick={onClose} />}
        <NavGroup>
          <NavItem close={onClose} to="/dapp/buy" view={DAppView.BUY} />
          <NavItem close={onClose} to="/dapp/stake" view={DAppView.STAKE} />
        </NavGroup>
        {ENV_VARS.VITE_PUBLIC_TEMPLE_DEVOTION_ENGAGED && (
          <NavGroup>
            <NavItem close={onClose} to="/dapp/devotion" view={DAppView.DEVOTION} />
          </NavGroup>
        )}
        <NavGroup>
          <NavItem close={onClose} to="/dapp/unlock" view={DAppView.UNLOCK} />
          <NavItem close={onClose} to="/dapp/queue" view={DAppView.QUEUE} />
          <NavItem close={onClose} to="/dapp/withdraw" view={DAppView.WITHDRAW} />
          <NavItem close={onClose} to="/dapp/sell" view={DAppView.SELL} />
        </NavGroup>
        <NavGroup>
          <NavItem close={onClose} to="/dapp/profile" view={DAppView.PROFILE} />
        </NavGroup>
      </Container>
    );
  }
);

Nav.displayName = 'Nav';

const NavGroup = styled.ul`
  margin-top: 0px;
`;

const NavContainer = styled.div`
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
