import { Route, Routes, NavLink as BaseNavLink, Navigate, useSearchParams } from 'react-router-dom';
import * as breakpoints from 'styles/breakpoints';
import styled from 'styled-components';
import DashboardContent, { DashboardType } from './DashboardContent';

export const DashboardPage = () => {
  const [searchParams] = useSearchParams();
  // preserve search params when switching dashboards
  const params = searchParams.toString();
  return (
    <DashboardContainer>
      <DashboardHeaderNav>
        <NavCell>
          <NavLink to={`treasuryreservesvault?${params}`}>TRV</NavLink>
        </NavCell>
        <NavCell>
          <NavLink to={`ramos?${params}`}>RAMOS</NavLink>
        </NavCell>
        {/* <NavCell> // TODO: Hidden until launch
          <NavLink to={`tlc?${params}`}>TLC</NavLink>
        </NavCell> */}
        <NavCell>
          <NavLink to={`templebase?${params}`}>TEMPLE BASE</NavLink>
        </NavCell>
        <NavCell>
          <NavLink to={`dsrbase?${params}`}>DSR BASE</NavLink>
        </NavCell>
        <NavCell>
          <NavLink to={`templomayor?${params}`}>TEMPLO MAYOR</NavLink>
        </NavCell>
      </DashboardHeaderNav>
      <DashboardContentContainer>
        <Routes>
          <Route path="*" element={<Navigate replace to="treasuryreservesvault" />} />
          <Route
            path="treasuryreservesvault"
            element={<DashboardContent selectedDashboard={DashboardType.TREASURY_RESERVES_VAULT} />}
          />
          <Route path="ramos" element={<DashboardContent selectedDashboard={DashboardType.RAMOS} />} />
          {/* // TODO: Hidden until launch */}
          {/* <Route path="tlc" element={<DashboardContent selectedDashboard={DashboardType.TLC} />} /> */}
          <Route path="templebase" element={<DashboardContent selectedDashboard={DashboardType.TEMPLE_BASE} />} />
          <Route path="dsrbase" element={<DashboardContent selectedDashboard={DashboardType.DSR_BASE} />} />
          <Route path="templomayor" element={<DashboardContent selectedDashboard={DashboardType.TEMPLO_MAYOR_GNOSIS} />} />
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
    color: ${({theme})=> theme.palette.brandLight}
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
