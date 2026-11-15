import { BaseTable } from "@backend/db/base_table";

/**
 * Closing prices as published — never adjusted for splits or bonuses (those
 * change the quantity held, not the published price). Daily bars only for
 * now; `resolution` is in the key so finer bars would need no migration.
 *
 * Held only for tracked instruments: anything in some account's trades, and
 * the benchmarks. Reference data: no access scope.
 */
export class PriceBarTable extends BaseTable {
	readonly table = "price_bars";

	columns = this.setColumns(
		(t) => ({
			instrumentId: t.ulid().foreignKey("instruments", "id", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			resolution: t.string(4).default("1d"),
			barDate: t.date(),
			close: t.decimal(20, 6),
			/** `nse` (bhavcopy) or `amfi` (fund NAV). */
			source: t.string(16),

			...t.timestampsAsNumbers(),
		}),
		(t) => [t.primaryKey(["instrumentId", "resolution", "barDate"])],
	);
}
