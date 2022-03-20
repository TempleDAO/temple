import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';
import axios from 'axios';

import useIsMounted from 'hooks/use-is-mounted';
import useFetchStoreDiscordUser from 'hooks/use-fetch-store-discord-user';

import { createDiscordUserUrl, createDiscordAuthUrl } from 'utils/url';
import { ENCLAVES, ROLES, ROLE_LABELS } from 'enums/discord';

import { Button } from 'components/Button/Button';
import StatsCard from 'components/StatsCard/StatsCard';
import type { DiscordUser } from 'components/Pages/Account';

import { theme } from 'styles/theme';
import { tabletAndAbove } from 'styles/breakpoints';

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
  const discordId = useFetchStoreDiscordUser();
  const [discordData, setDiscordData] = useState<DiscordUser | null>(null);
  const isMounted = useIsMounted();

  useEffect(() => {
    async function getDiscordData() {
      if (discordId) {
        const userData = await getDiscordUser(discordId);

        if (userData && isMounted) {
          setDiscordData(userData);
        }
      }
    }
    getDiscordData();
  }, [discordId]);

  return discordData ? (
    <DiscordDataSection>
      <div>
        <StatsCard
          stat={discordData.guild_name}
          backgroundImageUrl={texture2}
          backgroundColor={theme.palette.brand75}
          isSquare={false}
          smallStatFont
          height={CARD_HEIGHT_SMALL}
        />
        <StatsCard
          label="Enclave of"
          stat={discordData.enclave}
          backgroundImageUrl={setEnclaveImage(discordData.enclave)}
          darken
          isSquare={false}
          height={CARD_HEIGHT_LARGE}
        />
      </div>
      <div>
        <StatsCard
          label="Seniority"
          stat={getTenure(discordData.roles)}
          backgroundImageUrl={background4}
          darken
          isSquare={false}
          height={CARD_HEIGHT_LARGE}
        />
        <StatsCard
          label="Templar since"
          stat={format(new Date(discordData.joined_at), 'dd MMM yyyy')}
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
          stat={`${discordData.engagementalltime} posts`}
          backgroundImageUrl={texture1}
          backgroundColor={theme.palette.brand75}
          isSquare={false}
          smallStatFont
          height={CARD_HEIGHT_SMALL}
        />
        <Button
          label={discordData.enclave ? 'Change enclave' : 'Join an enclave'}
          onClick={onStartCeremony}
        />
        <Button
          label="Disconnect discord"
          onClick={() => {
            onDiscordLogout();
            setDiscordData(null);
          }}
        />
      </div>
    </DiscordDataSection>
  ) : (
    <DiscordEmptyState>
      <Button
        isSmall
        label="Connect Discord"
        as="a"
        href={createDiscordAuthUrl()}
      />
    </DiscordEmptyState>
  );
};

function onStartCeremony() {
  // simple OC stuff
}

function setEnclaveImage(enclave: string) {
  switch (enclave) {
    case ENCLAVES.CHAOS: {
      return chaos;
    }
    case ENCLAVES.LOGIC: {
      return logic;
    }
    case ENCLAVES.MYSTERY: {
      return mystery;
    }
    case ENCLAVES.ORDER: {
      return order;
    }
    case ENCLAVES.STRUCTURE: {
      return structure;
    }
    default: {
      return;
    }
  }
}

async function getDiscordUser(userId: string): Promise<DiscordUser | void> {
  const url = createDiscordUserUrl(userId);
  return await axios.get(url);
}

function onDiscordLogout() {
  localStorage.removeItem('discord-id');
}

function getTenure(roles: string[]) {
  const highestRankingRole = Object.values(ROLES).find((role) => {
    return roles.indexOf(role) !== -1;
  });

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

const DiscordEmptyState = styled.div`
  display: flex;
  margin: 2rem;
  justify-content: center;

  a {
    width: max-content;
  }
`;
