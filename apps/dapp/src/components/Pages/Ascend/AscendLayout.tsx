import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import { theme } from 'styles/theme';

const AscendLayout = () => {
  return (
    <>
      <Main>
        <Outlet />
      </Main>
    </>
  );
};

export default AscendLayout;

const Main = styled.main`
  margin: 0 auto;
  padding: 24px;
  max-width: ${theme.metrics.desktop.maxWidth};
`;
