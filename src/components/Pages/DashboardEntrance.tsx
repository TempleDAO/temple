import React from 'react';
import styled, { css } from 'styled-components';
import Account from 'components/Pages/Account';
import Dashboard from 'components/Pages/Dashboard';
import Image from 'components/Image/Image';
import { FlexStyled } from 'components/Layout/Flex';
import BackButton from 'components/Button/BackButton';
import talismanImage from 'assets/images/comingsoon.png';
import enclavesImage from 'assets/images/openingceremony.png';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';

import background1 from 'assets/images/dashboard-1.png';
import background2 from 'assets/images/dashboard-2.png';

const DashboardEntrance: CustomRoutingPage = ({ routingHelper }) => {
  const { back, changePageTo } = routingHelper;

  return (
    <>
      <H1>DOORWAY TO DASHBOARDS</H1>
      <Container
        layout={{
          kind: 'container',
        }}
      >
        <Pane
          onClick={() => changePageTo(Account)}
          backgroundImageUrl={background2}
        >
          <div>WHO AM I</div>
        </Pane>
        <Pane
          onClick={() => changePageTo(Dashboard)}
          backgroundImageUrl={background1}
        >
          <div>TEMPLE COMMUNITY</div>
        </Pane>
      </Container>
      <BackButton width={112} height={112} onClick={back} />
    </>
  );
};

const H1 = styled.h1`
  width: 100%;
  text-align: center;
`;

const Container = styled(FlexStyled)`
  width: 50rem;
  height: 25rem;
  margin: 0 auto;
`;

const Pane = styled.div`
  display: inline-block;
  margin: 1rem;
  width: calc(50% - 2rem);
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: ${(props) => props.theme.palette.dark};
  background-image: ${(props) =>
    `linear-gradient( rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4) ), url("${props.backgroundImageUrl}")` ||
    'none'};
  background-size: cover;
  background-position: center;
  border-radius: 5px;
  color: ${(props) => props.theme.palette.light};
  border: 1px solid ${(props) => props.theme.palette.brand};
  align-items: center;
  justify-content: center;
  ${(props) => props.theme.typography.h3};
  text-align: center;
  padding: 2rem;
  cursor: pointer;
`;

export default DashboardEntrance;
