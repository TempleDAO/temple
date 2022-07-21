import styled from 'styled-components';
import { Outlet } from 'react-router-dom';

import { PillMenu } from 'components/PillMenu';

import { phoneAndAbove } from 'styles/breakpoints';
import { NAV_MOBILE_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';

export const AscendLayout = () => {
  const isAdmin = false;

  return (
    <>
      {isAdmin && (
        <AdminMenuWrapper>
          <PillMenu
            links={[{
              to: '/dapp/ascend',
              label: 'Current',
            }, {
              to: '/dapp/ascend/edit',
              label: 'Edit',
            }, {
              to: '/dapp/ascend/create',
              label: 'Create',
            }]}
          />
        </AdminMenuWrapper>
      )}
      <Wrapper>
        <Outlet />
      </Wrapper>
    </>
  );
};

const AdminMenuWrapper = styled.div`
  margin: 2rem 0 -1rem;
`;

const Wrapper = styled.div`
  margin: ${NAV_MOBILE_HEIGHT_PIXELS}px 10px 10px 10px;

  ${phoneAndAbove(`
    margin: 40px 40px 40px 40px;
  `)}
`;