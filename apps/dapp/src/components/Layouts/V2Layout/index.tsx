import { Outlet } from 'react-router-dom';

import styled from 'styled-components';
import Footer from './Footer';
import LeftNav from './LeftNav';

const V2Layout = () => {
  return (
    <ParentContainer>
      <MainContainer>
        <LeftNav />
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
  flex-grow: 1;
`;

const Content = styled.div`
  height: 100%;
  flex-grow: 1;
  padding: 1rem;
  background-color: ${(props) => props.theme.palette.dark};
`;
