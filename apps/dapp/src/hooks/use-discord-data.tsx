import React, { useEffect, useState } from 'react';
import axios from 'axios';

import { createDiscordUserUrl } from 'utils/url';

import useFetchStoreDiscordUser from './use-fetch-store-discord-user';
import useIsMounted from './use-is-mounted';

export interface DiscordUser {
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
            setDiscordData(userData);
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

async function getDiscordUser(userId: string): Promise<DiscordUser | void> {
  const url = createDiscordUserUrl(userId);
  return await axios.get(url);
}
