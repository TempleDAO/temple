import { Outlet } from 'react-router-dom';

import styled from 'styled-components';
import LeftNav from './LeftNav';

const V2Layout = () => {
  return (
    <Container>
      <LeftNav />
      <Content>
        <Outlet />
      </Content>
    </Container>
  );
};

export default V2Layout;

const Container = styled.div`
  display: flex;
  min-height: 100vh;
`;

const Content = styled.div`
  flex-grow: 1;
  padding: 1rem;
  background-color: ${(props) => props.theme.palette.dark};
`;
