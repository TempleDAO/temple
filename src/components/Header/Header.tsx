import React from 'react';
import styled, { css } from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from 'components/Button/Button';

export const Header = () => {
  const navigate = useNavigate();
  return (
    <HeaderStyled>
      <NavContainer>
        <Link to="/">
          <h4>TempleDAO</h4>
        </Link>
        <MenuContainer>
          <Button
            label={'enter the temple'}
            onClick={() => navigate('/the-temple', { replace: true })}
            isSmall
            isUppercase
          />
        </MenuContainer>
      </NavContainer>
    </HeaderStyled>
  );
};

const HeaderStyled = styled.header`
  position: fixed;
  z-index: ${(props) => props.theme.zIndexes.top};
  top: 0;
  left: 0;
  width: 100vw;
  height: ${(props) => props.theme.metrics.headerHeight};
  padding: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${(props) => props.theme.palette.brand};
  background-color: ${(props) => props.theme.palette.dark};
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
`;
