import { useEffect, useState } from 'react';
import axios from 'axios';

export default function useFetchStoreDiscordUser() {
  const [discordId, setDiscordId] = useState<string | null>(null);

  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const [accessToken, tokenType] = [
    fragment.get('access_token'),
    fragment.get('token_type'),
  ];

  useEffect(() => {
    const getUserId = async () => {
      const id = localStorage.getItem('discord-id');
      if (id) {
        return setDiscordId(id);
      }
      if (!accessToken) {
        return;
      }
      const response = await axios({
        url: 'https://discord.com/api/users/@me',
        headers: {
          authorization: `${tokenType} ${accessToken}`,
        },
      });
      setDiscordId(response?.data?.id);
      window.history.replaceState({}, document.title, window.location.pathname);
      localStorage.setItem('discord-id', response?.data?.id);
    };

    getUserId();
  }, [accessToken, tokenType]);

  return discordId;
}
