import { Route, Routes, NavLink as BaseNavLink } from 'react-router-dom';
import styled from 'styled-components';
import Gnosis from './Gnosis';
import Ramos from './Ramos';
import Tlc from './Tlc';
import TreasuryReservesVault from './TreasuryReservesVault';

export const DashboardPage = () => {
  return (
    <DashboardContainer>
      <DashboardHeaderNav>
        <NavCell>
          <NavLink to="all">All</NavLink>
        </NavCell>
        <NavCell>
          <NavLink to="treasuryreservesvault">Treasury Reserves Vaults</NavLink>
        </NavCell>
        <NavCell>
          <NavLink to="ramos">RAMOS</NavLink>
        </NavCell>
        <NavCell>
          <NavLink to="tlc">TLC</NavLink>
        </NavCell>
        <NavCell>
          <NavLink to="gnosis">Gnosis</NavLink>
        </NavCell>
      </DashboardHeaderNav>
      <DashboardContent>
        <Routes>
          <Route path="*" element={<TreasuryReservesVault />} />
          <Route path="treasuryreservesvault" element={<TreasuryReservesVault />} />
          <Route path="ramos" element={<Ramos />} />
          <Route path="tlc" element={<Tlc />} />
          <Route path="gnosis" element={<Gnosis />} />
        </Routes>
      </DashboardContent>
    </DashboardContainer>
  );
};

const DashboardContent = styled.div`
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
