import { StringVariable } from "@mountainpath9/overlord-core";


export const tlc_discord_webhook_url = new StringVariable({
    name: 'tlc_discord_webhook_url',
    description: 'webhook url for the discord channel to which we send tlc notifications',
    isSecret: true,
});

