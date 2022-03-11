import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { CloseImage, NavGroup, NavItem } from 'components/DApp/NavComponents';

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
          <Link to="trade">
            <NavItem close={onClose} label={'Trade'} />
          </Link>
        </NavGroup>
        <NavGroup>
          <Link to="unstake">
            <NavItem close={onClose} label={'Unstake'} />
          </Link>
          <Link to="withdraw">
            <NavItem close={onClose} label={'Withdraw'} />
          </Link>
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
