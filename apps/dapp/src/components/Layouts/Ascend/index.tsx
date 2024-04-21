import styled from 'styled-components';
import { Outlet } from 'react-router-dom';

import { PillMenu } from 'components/Layouts/Ascend/PillMenu';

import { pixelsToRems } from 'styles/mixins';
import { tabletAndAbove } from 'styles/breakpoints';
import {
  NAV_MOBILE_HEIGHT_PIXELS,
  NAV_DESKTOP_HEIGHT_PIXELS,
} from 'components/Layouts/CoreLayout/Header';

export const AscendLayout = () => {
  const isAdmin = false;

  return (
    <>
      {isAdmin && (
        <AdminMenuWrapper>
          <PillMenu
            links={[
              {
                to: '/dapp/ascend',
                label: 'Current',
              },
              {
                to: '/dapp/ascend/edit',
                label: 'Edit',
              },
              {
                to: '/dapp/ascend/create',
                label: 'Create',
              },
            ]}
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
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 100%;
  min-height: calc(100vh - ${pixelsToRems(NAV_MOBILE_HEIGHT_PIXELS)}rem);

  ${tabletAndAbove(`
    min-height: calc(100vh - ${pixelsToRems(NAV_DESKTOP_HEIGHT_PIXELS)}rem);
    // Offset header
    padding-bottom: ${pixelsToRems(NAV_DESKTOP_HEIGHT_PIXELS)}rem;
  `)}
`;
