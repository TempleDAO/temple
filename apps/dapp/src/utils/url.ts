const ENV_VARS = import.meta.env;

export const createDiscordUserUrl = (userId: string) => {
  return `${ENV_VARS.BACKEND_URL}/api/discord/members/${userId}`
}

export const createDiscordAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: ENV_VARS.VITE_DISCORD_CLIENT_ID,
    redirect_uri: `${window.location.protocol}//${window.location.host}/the-temple`,
    response_type: 'token',
    scope: 'identify',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}