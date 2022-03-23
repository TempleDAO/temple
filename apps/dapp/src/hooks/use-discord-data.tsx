import React, { useEffect, useState } from 'react';
import axios from 'axios';

import { createDiscordUserUrl } from 'utils/url';

import useFetchStoreDiscordUser from './use-fetch-store-discord-user';
import useIsMounted from './use-is-mounted';
import { Enclave } from 'enums/discord';

interface DiscordUserResponse {
  user_id: string;
  user_name: string;
  guild_name: string;
  enclave: string;
  engagementlast7days: string;
  engagementlast30days: string;
  engagementalltime: string;
  roles: string[];
  joined_at: string;
}

export interface DiscordUser {
  userId: string;
  userName: string;
  guildName: string;
  enclave: Enclave;
  engagementLast7Days: string;
  engagementLast30Days: string;
  engagementAllTime: string;
  roles: string[];
  joinedAt: Date;
}

export const useDiscordUserData = () => {
  const discordId = useFetchStoreDiscordUser();
  const [loading, setLoading] = useState(true);
  const [discordData, setDiscordData] = useState<DiscordUser | null>(null);
  const [error, setError] = useState<Error>();

  const isMounted = useIsMounted();

  useEffect(() => {
    async function getDiscordData() {
      if (discordId) {
        try {
          const userData = await getDiscordUser(discordId);
          if (userData && isMounted) {
            setDiscordData({
              userId: userData.user_id,
              userName: userData.user_name,
              guildName: userData.guild_name,
              enclave: userData.enclave as Enclave,
              engagementLast7Days: userData.engagementlast7days,
              engagementLast30Days: userData.engagementlast30days,
              engagementAllTime: userData.engagementalltime,
              roles: userData.roles,
              joinedAt: new Date(userData.joined_at),
            });
          }
        } catch (err) {
          if (err && isMounted) {
            setError(err as Error);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      } else setLoading(false);
    }
    getDiscordData();
  }, [discordId]);

  const clearDiscordData = () => {
    localStorage.removeItem('discord-id');
    setDiscordData(null);
  };

  return {
    error,
    data: discordData,
    clearDiscordData,
    loading,
  };
};

async function getDiscordUser(
  userId: string
): Promise<DiscordUserResponse | void> {
  const url = createDiscordUserUrl(userId);
  return await axios.get(url);
}
