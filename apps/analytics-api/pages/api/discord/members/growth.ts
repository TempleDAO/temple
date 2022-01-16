import { parse } from "date-fns";
import type { NextApiRequest, NextApiResponse } from "next";
import { DEFAULT_CACHE_AGE } from "../../../../config";
import { discordRepo } from "../../../../repository/discord";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { since, until } = req.query;
    let startDate, endDate;
    try {
      startDate = parse(Array.isArray(since) ? since[0] : since, "yyyy-MM-dd", new Date());
      endDate = parse(Array.isArray(until) ? until[0] : until, "yyyy-MM-dd", new Date());
      console.log(startDate, endDate);
    } catch (err) {
      console.log(`memberGrowth: Failed to parse querystring: ${err.message}`);

      return res.status(400).json({
        error: "since and until parameters must be formatted as yyyy-MM-dd"
      });
    }

    const result = await discordRepo.memberGrowth(startDate, endDate);
    return res.status(200)
              .setHeader("cache-control", `s-maxage=${DEFAULT_CACHE_AGE}`)
              .json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Internal server error"
    });
  }
}
