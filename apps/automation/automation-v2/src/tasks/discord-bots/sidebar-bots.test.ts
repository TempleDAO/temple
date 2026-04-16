import { assert, test } from "vitest";
import { BigRational } from "@mountainpath9/big-rational";
import {
  computeTemplePricePremium,
  formatTemplePriceSidebarState,
} from "./temple-price";
import {
  formatAuctionTimeDelta,
  formatTgldAuctionSidebarState,
} from "./tgld-auction";
import { formatSpiceAuctionActivity, formatSpiceErrorSidebarState } from "./spice";

test("formats Temple price sidebar state", () => {
  const state = formatTemplePriceSidebarState({
    spotPrice: 3.4567,
    tpi: 2.34567,
  });

  assert.equal(computeTemplePricePremium(3.4567, 2.34567).toFixed(2), "1.47");
  assert.equal(state.nickname, "$3.457 | 1.47x TPI");
  assert.equal(state.activity.type, "watching");
  assert.equal(state.activity.name, "TPI rise: $2.3457");
});

test("formats spice activity for pre-start active and ended epochs", () => {
  const now = new Date("2026-04-07T12:00:00.000Z");

  assert.equal(
    formatSpiceAuctionActivity(
      {
        id: 7n,
        price: BigRational.ONE,
        startsAt: new Date("2026-04-08T00:00:00.000Z"),
        endsAt: new Date("2026-04-09T00:00:00.000Z"),
      },
      now
    ),
    "Epoch 7 starts in 0.5 days"
  );

  assert.equal(
    formatSpiceAuctionActivity(
      {
        id: 8n,
        price: BigRational.ONE,
        startsAt: new Date("2026-04-07T00:00:00.000Z"),
        endsAt: new Date("2026-04-08T00:00:00.000Z"),
      },
      now
    ),
    "Epoch 8 ends in 0.5 days"
  );

  assert.equal(
    formatSpiceAuctionActivity(
      {
        id: 9n,
        price: BigRational.ONE,
        startsAt: new Date("2026-04-05T00:00:00.000Z"),
        endsAt: new Date("2026-04-06T00:00:00.000Z"),
      },
      now
    ),
    "Epoch 9 ended 1.5 days ago"
  );
});

test("formats spice error sidebar state", () => {
  const state = formatSpiceErrorSidebarState("TGLD/sENA");

  assert.equal(state.nickname, "TGLD/sENA");
  assert.equal(state.activity.type, "watching");
  assert.equal(state.activity.name, "ERROR");
});

test("formats auction sidebar state", () => {
  const state = formatTgldAuctionSidebarState(
    {
      kind: "auction-ended",
      data: {
        lastEpoch: {
          tgldPrice: BigRational.from(1234n, 1000n),
        },
        nextEpoch: {
          startsAt: new Date("2026-04-07T13:00:00.000Z"),
        },
      },
    },
    new Date("2026-04-07T12:00:00.000Z")
  );

  assert.equal(
    formatAuctionTimeDelta(
      new Date("2026-04-07T12:00:00.000Z"),
      new Date("2026-04-07T13:00:00.000Z")
    ),
    "60.0 minutes"
  );
  assert.equal(state.nickname, "$1.234 / $TGLD");
  assert.equal(state.activity.type, "custom");
  if (state.activity.type !== "custom") {
    throw new Error("expected custom activity");
  }
  assert.equal(state.activity.state, "Auction starts in 60.0 minutes");
});
