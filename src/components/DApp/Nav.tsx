import React, { FC, useContext } from 'react';
import styled from 'styled-components';
import { DAppView } from 'enums/dapp-view';
import { CloseImage, NavGroup, NavItem } from 'components/DApp/NavComponents';

interface NavProps {
  small?: boolean;
  onClose?: () => void;
}

export const Nav: FC<NavProps> = ({ small, onClose }) => {
  const Container = small ? NavMobileContainer : NavContainer;

  return (
    <Container>
      {small && <CloseImage onClick={onClose} />}
      <NavGroup>
        <NavItem close={onClose} view={DAppView.BUY} />
        <NavItem close={onClose} view={DAppView.STAKE} />
      </NavGroup>
      <NavGroup>
        <NavItem close={onClose} view={DAppView.QUEUE} />
        <NavItem close={onClose} view={DAppView.WITHDRAW} />
        <NavItem close={onClose} view={DAppView.SELL} />
      </NavGroup>
    </Container>
  );
};

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
