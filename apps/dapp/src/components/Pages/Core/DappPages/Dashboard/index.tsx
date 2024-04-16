import {
  Route,
  Routes,
  NavLink as BaseNavLink,
  Navigate,
  useSearchParams,
} from 'react-router-dom';
import * as breakpoints from 'styles/breakpoints';
import styled from 'styled-components';
import DashboardContent from './DashboardContent';
import { Dashboards } from './DashboardConfig';

export const DashboardPage = () => {
  const [searchParams] = useSearchParams();
  // preserve search params when switching dashboards
  const params = searchParams.toString();
  return (
    <DashboardContainer>
      <DashboardHeaderNav>
        {Dashboards.map((dashboard) => (
          <NavCell key={dashboard.key}>
            <NavLink to={`${dashboard.path}?${params}`}>
              {dashboard.title}
            </NavLink>
          </NavCell>
        ))}
      </DashboardHeaderNav>
      <DashboardContentContainer>
        <Routes>
          <Route
            path="*"
            element={<Navigate replace to="treasuryreservesvault" />}
          />
          {Dashboards.map((dashboard) => (
            <Route
              key={dashboard.key}
              path={dashboard.path}
              element={<DashboardContent selectedDashboard={dashboard} />}
            />
          ))}
        </Routes>
      </DashboardContentContainer>
    </DashboardContainer>
  );
};

const DashboardContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

type NavLinkProps = {
  active?: boolean;
};

const NavLink = styled(BaseNavLink)<NavLinkProps>`
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }

  &.active {
    text-decoration: underline;
    color: ${({ theme }) => theme.palette.brandLight};
  }

  ${breakpoints.phoneToSmallTablet(`
    font-size: 16px;
  `)}
`;

const NavCell = styled.div`
  padding-right: 1rem;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  color: #fff;
  &:hover {
    color: #fff;
  }
`;

const DashboardHeaderNav = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  white-space: nowrap;
  overflow-x: scroll;
  &::-webkit-scrollbar {
    display: none;
  }
  ${breakpoints.tabletAndAbove(`
    margin-bottom: 80px;
  `)}
`;

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: left;
  ${breakpoints.tabletAndAbove(`
    align-items: center;
  `)}
`;
