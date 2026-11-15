import {
	ACCESS_LEVEL_ENUM,
	API_PRODUCT_REQUEST_STATUS_ENUM,
	API_REQUEST_METHOD_ENUM,
	apiProductSkuEnum,
	BROKER_ENUM,
	CASH_FLOW_CLASSIFICATION_ENUM,
	CHARGE_TYPE_ENUM,
	EVENT_KIND_ENUM,
	EXCHANGE_ENUM,
	FILE_TABLE_NAME_ENUM,
	FILE_TYPE_ENUM,
	GRANT_END_REASON_ENUM,
	GROUP_KIND_ENUM,
	HOLDER_KIND_ENUM,
	IMPORT_BATCH_KIND_ENUM,
	IMPORT_BATCH_STATUS_ENUM,
	INSTRUMENT_ALIAS_KIND_ENUM,
	INSTRUMENT_KIND_ENUM,
	PG_TBUS_TASK_STATUS_ENUM,
	THEME_SETTING_ENUM,
	TRADE_SIDE_ENUM,
	WEBHOOK_STATUS_ENUM,
} from "@connected-repo/zod-schemas/enums.zod";
import { createBaseTable } from "orchid-orm";
import { nodePostgresSchemaConfig } from "pqb/node-postgres";
import { ulid } from "ulid";

/**
 * Who authored a Kosh ledger event ('system' pipeline vs interactive 'user').
 * Backend-local (not in @connected-repo/zod-schemas) because it is always
 * server-stamped, never accepted as client input.
 * TODO(kosh): move to zod-schemas if the frontend ever needs to render it.
 */
export const EVENT_ACTOR_ENUM = ["system", "user"] as const;
export type EventActor = (typeof EVENT_ACTOR_ENUM)[number];

export const BaseTable = createBaseTable({
	autoForeignKeys: false,
	nowSQL: `clock_timestamp()`,
	snakeCase: true,
	// Required since orchid-orm 1.72 when using the node-postgres adapter —
	// aligns column encoding/parsing with node-postgres's parser table.
	// Without this, types like int8/numeric/timestamp can decode as the
	// wrong runtime type (string vs number) silently.
	schemaConfig: nodePostgresSchemaConfig,

	columnTypes: (t) => ({
		...t,
		// Decimal helpers — consistent precision across price/quantity/amount columns.
		percent: () => t.decimal(5, 2),
		price: () => t.decimal(10, 2),
		quantity: () => t.decimal(11, 3),
		amount: () => t.decimal(15, 2),

		// Kosh ledger-core decimal helpers (docs/kosh/02-domain-model.md):
		// money and quantities are ALWAYS NUMERIC — never float/real.
		moneyAmount: () => t.decimal(20, 2),
		quantity8: () => t.decimal(20, 8),
		price4: () => t.decimal(20, 4),
		rate8: () => t.decimal(20, 8),

		accessLevelEnum: () => t.enum("access_level_enum", ACCESS_LEVEL_ENUM),
		apiProductSkuEnum: () => t.enum("api_product_enum", apiProductSkuEnum),
		brokerEnum: () => t.enum("broker_enum", BROKER_ENUM),
		cashFlowClassificationEnum: () =>
			t.enum("cash_flow_classification_enum", CASH_FLOW_CLASSIFICATION_ENUM),
		chargeTypeEnum: () => t.enum("charge_type_enum", CHARGE_TYPE_ENUM),
		eventActorEnum: () => t.enum("event_actor_enum", EVENT_ACTOR_ENUM),
		eventKindEnum: () => t.enum("event_kind_enum", EVENT_KIND_ENUM),
		exchangeEnum: () => t.enum("exchange_enum", EXCHANGE_ENUM),
		grantEndReasonEnum: () =>
			t.enum("grant_end_reason_enum", GRANT_END_REASON_ENUM),
		groupKindEnum: () => t.enum("group_kind_enum", GROUP_KIND_ENUM),
		holderKindEnum: () => t.enum("holder_kind_enum", HOLDER_KIND_ENUM),
		importBatchKindEnum: () =>
			t.enum("import_batch_kind_enum", IMPORT_BATCH_KIND_ENUM),
		importBatchStatusEnum: () =>
			t.enum("import_batch_status_enum", IMPORT_BATCH_STATUS_ENUM),
		instrumentAliasKindEnum: () =>
			t.enum("instrument_alias_kind_enum", INSTRUMENT_ALIAS_KIND_ENUM),
		instrumentKindEnum: () =>
			t.enum("instrument_kind_enum", INSTRUMENT_KIND_ENUM),
		tradeSideEnum: () => t.enum("trade_side_enum", TRADE_SIDE_ENUM),

		apiRequestMethodEnum: () =>
			t.enum("api_request_method_enum", API_REQUEST_METHOD_ENUM),
		apiProductRequestStatusEnum: () =>
			t.enum("api_status_enum", API_PRODUCT_REQUEST_STATUS_ENUM),
		fileTableNameEnum: () =>
			t.enum("file_table_name_enum", FILE_TABLE_NAME_ENUM),
		fileTypeEnum: () => t.enum("file_type_enum", FILE_TYPE_ENUM),
		pgTbusTaskStatusEnum: () =>
			t.enum("pg_tbus_task_status_enum", PG_TBUS_TASK_STATUS_ENUM),
		themeSettingEnum: () => t.enum("theme_setting_enum", THEME_SETTING_ENUM),
		timestampNumber: () => t.timestamp().asNumber(),
		ulid: () => t.string(26),
		// App-side ULID default. Do NOT add a `setOnCreate` column to a table
		// that uses this: orchid-orm 1.73 appends the setOnCreate column and the
		// runtime-default column to an INSERT's column list in one order and
		// their values in the other, so the two swap (the old tenant column was
		// written into `id` this way).
		ulidWithDefault: () => t.string(26).default(() => ulid()),
		webhookStatusEnum: () => t.enum("webhook_status_enum", WEBHOOK_STATUS_ENUM),

		/** ms-epoch timestamps — the one timestamp shape every table uses. */
		timestampsAsNumbers: () => ({
			createdAt: t.timestamps().createdAt.asNumber(),
			updatedAt: t.timestamps().updatedAt.asNumber(),
		}),
	}),
});

export const { sql } = BaseTable;
