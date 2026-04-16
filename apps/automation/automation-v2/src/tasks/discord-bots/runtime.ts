import { assertNever } from "@/tlc/utils";
import { Logger, StringVariable, TaskRunner } from "@mountainpath9/overlord-core";
import { ActivityType, Client, GatewayIntentBits } from "discord.js";

export type SidebarActivity =
  | {
      type: "watching";
      name: string;
    }
  | {
      type: "custom";
      state: string;
      name?: string;
      url?: string;
    };

export interface SidebarState {
  nickname: string;
  activity: SidebarActivity;
}

export async function startDiscordSidebarBot({
  runner,
  botLabel,
  tokenVariable,
}: {
  runner: TaskRunner;
  botLabel: string;
  tokenVariable: StringVariable;
}): Promise<Client | undefined> {
  const botToken = await runner.config.getString(tokenVariable.name());
  if (!botToken) {
    runner.logger.info(
      `${botLabel} not provided (${tokenVariable.name()})`
    );
    return undefined;
  }

  runner.logger.info(`Starting ${botLabel} using ${tokenVariable.name()}`);
  const bot = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
    try {
        await bot.login(botToken);
        return bot
    } catch (error){
        // since the log-in happens outside of the task runner task, must not fail
        // otherwise it would crash the whole task runner
        runner.logger.info(`Error logging in ${botLabel}`)
        runner.logger.exceptionDetail(error)
    }
}

export async function applyDiscordSidebarState({
  bot,
  state,
  logger,
}: {
  bot: Client;
  state: SidebarState;
  logger: Logger;
}) {
  if (!bot.user) {
    logger.error("No bot user");
    return;
  }

  logger.info(`Updating bot ${bot.user.id} state ${JSON.stringify(state)}`)
  bot.user.setPresence({
    activities: [formatDiscordActivity(state.activity)],
  });

  for (const guild of bot.guilds.cache.values()) {
    try {
      await guild.members.fetchMe();
      await guild.members.edit(bot.user.id, { nick: state.nickname });
    } catch (error) {
      logger.info(
        `Failed to update sidebar nickname in guild ${guild.id} ${guild.name}: ${String(
          error
        )}`
      );
    }
  }
}

function formatDiscordActivity(activity: SidebarActivity) {
  switch (activity.type) {
    case "watching":
      return {
        name: activity.name,
        type: ActivityType.Watching,
      };
    case "custom":
      return {
        name: activity.name ?? "Custom Status",
        state: activity.state,
        type: ActivityType.Custom,
        url: activity.url,
      };
    default:
      assertNever(activity)
  }
}
