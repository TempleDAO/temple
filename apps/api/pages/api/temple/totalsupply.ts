import type { NextApiRequest, NextApiResponse } from "next";
import {templeStats}  from "../../../services/templeStatsService"


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const totalSupply = await templeStats.getTotalSupply()
    return res.status(200).send(totalSupply);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Internal server error"
    });
  }
}
