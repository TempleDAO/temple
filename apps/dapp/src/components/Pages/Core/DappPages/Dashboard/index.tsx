import { Route, Routes, NavLink as BaseNavLink, Navigate, useSearchParams } from 'react-router-dom';
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
          <NavLink to={`treasuryreservesvault?${params}`}>All</NavLink>
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
  }
`;

const NavCell = styled.div`
  padding: 0 1rem;
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
  padding: 0 0 1rem 0;
`;

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;
