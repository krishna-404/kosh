import { change } from "../db_script";

// Whether the last price fetch finished cleanly — so the app can tell
// "fetched, nothing new" from "could not reach the exchange".
change(async (db) => {
	await db.changeTable("market_state", (t) => ({
		lastSyncOk: t.add(t.boolean().default(true)),
	}));
});
