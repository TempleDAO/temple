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
        (
            SELECT
                count(*) AS total
            FROM
                discord_user_messages
            WHERE
                user_id = $1
        ) AS engagementAllTime
    `;
    const values = [userId];
    const result = await this.store.query(query, values);

    return result.rows[0];
  }

  async memberGrowth(since: Date, until: Date) {
    const query = `
        SELECT DISTINCT
            DATE(joined_at),
            count(*) as new_members
        FROM
            discord_users
        WHERE
            joined_at BETWEEN $1 AND $2
        GROUP BY
            DATE(joined_at)
        ORDER BY date
      `;
    const values = [since, until];
    const result = await this.store.query(query, values);

    return result.rows;
  }

  async getUsersByEnclave(enclave: string){
    const query = `
      SELECT * FROM 
      (
        SELECT
          user_id,
          user_name,
          guild_name,
          joined_at,
          CASE 
            WHEN array_to_string(roles, ' ') LIKE '%Order%' THEN 'Order'
            WHEN array_to_string(roles, ' ') LIKE '%Mystery%' THEN 'Mystery'
            WHEN array_to_string(roles, ' ') LIKE '%Structure%' THEN 'Structure'
            WHEN array_to_string(roles, ' ') LIKE '%Logic%' THEN 'Logic'
            WHEN array_to_string(roles, ' ') LIKE '%Chaos%' THEN 'Chaos'
          END AS enclave,
          roles
        FROM 
          (
            SELECT
              u.user_id,
              u.user_name,
              u.guild_name,
              u.joined_at,
              array_agg(r.role_name ORDER BY role_name) roles
            FROM
              discord_users u
            LEFT OUTER JOIN discord_user_roles r ON u.user_id = r.user_id
            GROUP BY
              u.user_id,
              u.user_name,
              u.guild_name,
              u.joined_at
          ) AS t
        ) as users
      WHERE
      enclave = $1
    `;
    const values = [enclave];
    const result = await this.store.query(query, values);

    return result.rows;
  }

  async getUsersByRole(role: string){
    const query = `
      SELECT * FROM 
      (
        SELECT
          user_id,
          user_name,
          guild_name,
          joined_at,
          CASE 
            WHEN array_to_string(roles, ' ') LIKE '%Order%' THEN 'Order'
            WHEN array_to_string(roles, ' ') LIKE '%Mystery%' THEN 'Mystery'
            WHEN array_to_string(roles, ' ') LIKE '%Structure%' THEN 'Structure'
            WHEN array_to_string(roles, ' ') LIKE '%Logic%' THEN 'Logic'
            WHEN array_to_string(roles, ' ') LIKE '%Chaos%' THEN 'Chaos'
          END AS enclave,
          roles
        FROM 
          (
            SELECT
              u.user_id,
              u.user_name,
              u.guild_name,
              u.joined_at,
              array_agg(r.role_name ORDER BY role_name) roles
            FROM
              discord_users u
            LEFT OUTER JOIN discord_user_roles r ON u.user_id = r.user_id
            GROUP BY
              u.user_id,
              u.user_name,
              u.guild_name,
              u.joined_at
          ) AS t
        ) as users
      WHERE
        $1 = ANY (roles)
      `;
    const values = [role];
    const result = await this.store.query(query, values);

    return result.rows;
  }

  async getUser(role: string){
    const query = `
      SELECT * FROM 
      (
        SELECT
          user_id,
          user_name,
          guild_name,
          joined_at,
          CASE 
            WHEN array_to_string(roles, ' ') LIKE '%Order%' THEN 'Order'
            WHEN array_to_string(roles, ' ') LIKE '%Mystery%' THEN 'Mystery'
            WHEN array_to_string(roles, ' ') LIKE '%Structure%' THEN 'Structure'
            WHEN array_to_string(roles, ' ') LIKE '%Logic%' THEN 'Logic'
            WHEN array_to_string(roles, ' ') LIKE '%Chaos%' THEN 'Chaos'
          END AS enclave,
          roles
        FROM 
          (
            SELECT
              u.user_id,
              u.user_name,
              u.guild_name,
              u.joined_at,
              array_agg(r.role_name ORDER BY role_name) roles
            FROM
              discord_users u
            LEFT OUTER JOIN discord_user_roles r ON u.user_id = r.user_id
            GROUP BY
              u.user_id,
              u.user_name,
              u.guild_name,
              u.joined_at
          ) AS t
        ) as users
      WHERE
        user_id = $1
      `;
    const values = [role];
    const result = await this.store.query(query, values);

    return result.rows[0];
  }

  async twitterSummary() {
    const query = `
    SELECT
      followers_count
    FROM
      public.twitter_temple_stats
    WHERE
      screen_name = 'templedao';
      `;
    const values = [];
    const result = await this.store.query(query, values);

    return result.rows[0];
  }
}

export const discordRepo = new DiscordDataRepository(pgStore);
