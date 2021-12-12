import type { NextApiRequest, NextApiResponse } from "next";
import { DEFAULT_CACHE_AGE } from "../../../../config";
import { discordRepo } from "../../../../repository/discord";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { rank, enclave, userid } = req.query;
    if (!rank && !enclave && !userid) {
      res
        .status(400)
        .json({
          error: "Must provide one of the following query parameters: rank, enclave, userid"
        });
    }
     
    if ((rank && enclave) || (rank && userid) || (enclave && userid)){
      res
        .status(400)
        .json({
          error: "Must provide one, and only one, of the following query parameters: rank, enclave, userid"
        });
    }

    const result = await discordRepo.orgchartMembers({ rank, enclave, userid });
    return res.status(200).setHeader("cache-control", `s-maxage=${DEFAULT_CACHE_AGE}`).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Internal server error"
    });
  }
}
