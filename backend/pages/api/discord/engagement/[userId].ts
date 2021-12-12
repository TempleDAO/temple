import type { NextApiRequest, NextApiResponse } from "next";
import { DEFAULT_CACHE_AGE } from "../../../../config";
import { discordRepo } from "../../../../repository/discord";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userId } = req.query;
  const id = Array.isArray(userId) ? userId[0] : userId;
  
  try {
    const result = await discordRepo.userEngagement(id);
    return res
      .status(200)
      .setHeader("cache-control", `s-maxage=${DEFAULT_CACHE_AGE}`)
      .json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Internal server error"
    });
  }
}
