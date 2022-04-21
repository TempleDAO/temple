import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';

import { createDiscordAuthUrl } from 'utils/url';

import { DiscordRole, Enclave, ROLE_LABELS } from 'enums/discord';

import { useDiscordUserData } from 'hooks/use-discord-data';

import { Button } from 'components/Button/Button';
import StatsCard from 'components/StatsCard/StatsCard';
import Loader from 'components/Loader/Loader';

import { theme } from 'styles/theme';
import { tabletAndAbove } from 'styles/breakpoints';
import { Container } from '../styles';

import background4 from 'assets/images/dashboard-4.png';
import texture1 from 'assets/images/texture-1.svg';
import texture2 from 'assets/images/texture-2.svg';
import texture3 from 'assets/images/texture-3.svg';
import chaos from 'assets/images/circle-chaos.png';
import logic from 'assets/images/circle-logic.png';
import mystery from 'assets/images/circle-mystery.png';
import order from 'assets/images/circle-order.png';
import structure from 'assets/images/circle-structure.png';

const CARD_HEIGHT_LARGE = '10rem';
const CARD_HEIGHT_SMALL = '5rem';

export const ProfileDiscordData = () => {
  const { data, loading, clearDiscordData } = useDiscordUserData();

  if (loading) {
    return (
      <Container>
        <Loader />;
      </Container>
    );
  }

  if (!data) {
    return (
      <Container>
        <Button
          isSmall
          label="Connect Discord"
          as="a"
          href={createDiscordAuthUrl()}
        />
      </Container>
    );
  }

  return (
    <DiscordDataSection>
      <div>
        <StatsCard
          stat={data.guildName}
          backgroundImageUrl={texture2}
          backgroundColor={theme.palette.brand75}
          isSquare={false}
          smallStatFont
          height={CARD_HEIGHT_SMALL}
        />
        <StatsCard
          label="Enclave of"
          stat={data.enclave}
          backgroundImageUrl={setEnclaveImage(data.enclave)}
          darken
          isSquare={false}
          height={CARD_HEIGHT_LARGE}
        />
      </div>
      <div>
        <StatsCard
          label="Role"
          stat={getTenure(data.roles)}
          backgroundImageUrl={background4}
          darken
          isSquare={false}
          height={CARD_HEIGHT_LARGE}
        />
        <StatsCard
          label="Templar since"
          stat={format(data.joinedAt, 'dd MMM yyyy')}
          backgroundImageUrl={texture3}
          backgroundColor={theme.palette.brand75}
          isSquare={false}
          smallStatFont
          height={CARD_HEIGHT_SMALL}
        />
      </div>
      <div>
        <StatsCard
          label="Engagement"
          stat={`${data.engagementAllTime} posts`}
          backgroundImageUrl={texture1}
          backgroundColor={theme.palette.brand75}
          isSquare={false}
          smallStatFont
          height={CARD_HEIGHT_SMALL}
        />
        <Button
          label={data.enclave ? 'Change enclave' : 'Join an enclave'}
          onClick={onStartCeremony}
        />
        <Button label="Disconnect discord" onClick={clearDiscordData} />
      </div>
    </DiscordDataSection>
  );
};

function onStartCeremony() {
  // simple OC stuff
}

function setEnclaveImage(enclave: Enclave) {
  switch (enclave) {
    case Enclave.Chaos: {
      return chaos;
    }
    case Enclave.Logic: {
      return logic;
    }
    case Enclave.Mystery: {
      return mystery;
    }
    case Enclave.Order: {
      return order;
    }
    case Enclave.Structure: {
      return structure;
    }
    default: {
      return;
    }
  }
}

function getTenure(roles: string[]) {
  const highestRankingRole = Object.values(DiscordRole).find((role) =>
    roles.includes(role)
  );

  if (highestRankingRole) return ROLE_LABELS[highestRankingRole];

  return ROLE_LABELS.UNVERIFIED;
}

const DiscordDataSection = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;

  > div {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  ${tabletAndAbove(`
    grid-template-columns: 1fr 1fr 1fr;
`)}
`;
