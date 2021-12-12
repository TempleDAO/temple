import { PgDatastore, pgStore } from "./store";

export interface DiscordMemberSummary {
  totalMembers: number;
  enclaveChaos: number;
  enclaveOrder: number;
  enclaveLogic: number;
  enclaveMystery: number;
  enclaveStructure: number;
  verified: number;
  unverified: number;
  initiates: number;
  masters: number;
  disciples: number;
}

export class DiscordDataRepository {
  store: PgDatastore;

  constructor(store?: PgDatastore) {
    this.store = store ? store : new PgDatastore();
  }

  async memberSummary(): Promise<DiscordMemberSummary> {
    const result = await this.store.query(`
        select count(distinct user_id)                                             "totalMembers",
            count(distinct user_id) filter (where role_name='Members of Chaos')     "enclaveChaos",
            count(distinct user_id) filter (where role_name='Members of Order')     "enclaveOrder",
            count(distinct user_id) filter (where role_name='Members of Logic')     "enclaveLogic",
            count(distinct user_id) filter (where role_name='Members of Mystery')   "enclaveMystery",
            count(distinct user_id) filter (where role_name='Members of Structure') "enclaveStructure",
            count(distinct user_id) filter (where role_name='Templars')             "verified",
            count(distinct user_id) filter (where role_name!='Templars')            "unverified",
            count(distinct user_id) filter (where role_name='Temple Initiates')     "initiates",
            count(distinct user_id) filter (where role_name='Temple Masters')       "masters",
            count(distinct user_id) filter (where role_name='Temple Disciples')     "disciples"
        from public.discord_user_roles
    `);

    return result.rows[0];
  }

  async userEngagement(userId: string) {
    if (!userId) throw new Error("Missing userId in userEngagemenet query");

    const query = `
        SELECT 
        (
            SELECT
                count(*) AS total
            FROM
                discord_user_messages
            WHERE
                user_id = $1
                AND created_at > CURRENT_DATE - interval '7' day
        ) AS engagementLast7Days,
        (
            SELECT
                count(*) AS total
            FROM
                discord_user_messages
            WHERE
                user_id = $1
                AND created_at > CURRENT_DATE - interval '30' day
        ) AS engagementLast30Days,
        $1 as user_id
    `;
    const values = [userId];
    const result = await this.store.query(query, values);

    return result.rows[0];
  }
}

export const discordRepo = new DiscordDataRepository(pgStore);
