import { useMediaQuery } from 'react-responsive';
import { Outlet } from 'react-router-dom';

import styled from 'styled-components';
import { queryMinTablet, tabletAndAbove } from 'styles/breakpoints';
import Footer from './Footer';
import LeftNav from './Nav/LeftNav';
import MobileNav from './Nav/MobileNav';

const V2Layout = () => {
  const isTabletOrAbove = useMediaQuery({
    query: queryMinTablet,
  });

  return (
    <ParentContainer>
      <MainContainer>
        {isTabletOrAbove ? <LeftNav /> : <MobileNav />}
        <Content>
          <Outlet />
        </Content>
      </MainContainer>
      <Footer />
    </ParentContainer>
  );
};

export default V2Layout;

const ParentContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const MainContainer = styled.div`
  display: flex;
  flex-direction: column;
  ${tabletAndAbove(`
    flex-direction: row;
  `)}
  flex-grow: 1;
`;

const Content = styled.div`
  height: 100%;
  flex-grow: 1;
  padding: 1rem;
  background-color: ${(props) => props.theme.palette.dark};
`;
