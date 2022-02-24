import React from 'react';
import styled from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';

import { Button as BaseButton } from 'components/Button/Button';
import * as breakpoints from 'styles/breakpoints';

export const Header = () => {
  const navigate = useNavigate();
  return (
    <HeaderStyled>
      <NavContainer>
        <Link to="/">
          <AppLogo>TempleDAO</AppLogo>
        </Link>
        <MenuContainer>
          <Button
            label={'enter the temple'}
            onClick={() => navigate('/the-temple')}
            isSmall
            isUppercase
          />
          <DAppButton
            label={'launch dapp'}
            onClick={() => navigate('/dapp')}
            isSmall
            isUppercase
            isActive
          />
        </MenuContainer>
      </NavContainer>
    </HeaderStyled>
  );
};

// Special case font sizing/line height for TempleDAO Logo
const AppLogo = styled.h1`
  font-size: 1.5rem;
  line-height: 2.75rem;
  margin: 0;
`;

const Button = styled(BaseButton)`
  display: none;

  ${breakpoints.tabletAndAbove(`
    display: flex;
  `)}
`;

const HeaderStyled = styled.header`
  position: fixed;
  z-index: ${(props) => props.theme.zIndexes.top};
  top: 0;
  left: 0;
  height: ${(props) => props.theme.metrics.headerHeight};
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${(props) => props.theme.palette.brand};
  background-color: ${(props) => props.theme.palette.dark};
  width: 100%;

  ${breakpoints.tabletAndAbove(`
    width: 100vw;
    justify-content: center;
  `)}
`;

const NavContainer = styled.div`
  position: relative;
  max-width: ${(props) => props.theme.metrics.desktop.maxWidth};
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  height: 100%;
`;

const MenuContainer = styled.div`
  display: flex;

  ${breakpoints.tabletAndAbove(`
    width: 20rem;
  `)}
`;

const DAppButton = styled(BaseButton)`
  border: none;
  color: ${({ theme }) => theme.palette.dark};
`;
