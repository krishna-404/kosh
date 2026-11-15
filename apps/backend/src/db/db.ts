import { dbConfig } from "@backend/db/config.db";
import { AccountTable } from "@backend/modules/auth/tables/account.auth.table";
import { SessionTable } from "@backend/modules/auth/tables/session.auth.table";
import { VerificationTable } from "@backend/modules/auth/tables/verification.auth.table";
import { CorporateActionApplicationTable } from "@backend/modules/corporate-actions/tables/corporate_action_applications.table";
import { CorporateActionTable } from "@backend/modules/corporate-actions/tables/corporate_actions.table";
import { PgTbusTaskLogTable } from "@backend/modules/events/tables/pg_tbus_task_log.table";
import { FileTable } from "@backend/modules/files/tables/files.table";
import { ImportBatchTable } from "@backend/modules/imports/tables/import_batches.table";
import { ImportFileTable } from "@backend/modules/imports/tables/import_files.table";
import { RawHoldingsSnapshotTable } from "@backend/modules/imports/tables/raw_holdings_snapshots.table";
import { RawLedgerLineTable } from "@backend/modules/imports/tables/raw_ledger_lines.table";
import { RawTradeTable } from "@backend/modules/imports/tables/raw_trades.table";
import { InstrumentAliasTable } from "@backend/modules/instruments/tables/instrument_aliases.table";
import { InstrumentTable } from "@backend/modules/instruments/tables/instruments.table";
import { CashFlowTable } from "@backend/modules/ledger/tables/cash_flows.table";
import { EventTable } from "@backend/modules/ledger/tables/events.table";
import { TradeChargeUnitTable } from "@backend/modules/ledger/tables/trade_charge_units.table";
import { TradeTable } from "@backend/modules/ledger/tables/trades.table";
import { TransferLinkTable } from "@backend/modules/ledger/tables/transfer_links.table";
import { ApiProductRequestLogsTable } from "@backend/modules/logs/tables/api_product_request_logs.table";
import { MarketStateTable } from "@backend/modules/market-data/tables/market_state.table";
import { PriceBarTable } from "@backend/modules/market-data/tables/price_bars.table";
import { ProviderPayloadTable } from "@backend/modules/market-data/tables/provider_payloads.table";
import { PushDeviceTable } from "@backend/modules/notifications/tables/push_devices.table";
import { AccessGrantTable } from "@backend/modules/portfolio/tables/access_grants.table";
import { AccountGroupMemberTable } from "@backend/modules/portfolio/tables/account_group_members.table";
import { AccountGroupTable } from "@backend/modules/portfolio/tables/account_groups.table";
import { BrokerAccountTable } from "@backend/modules/portfolio/tables/broker_accounts.table";
import { PersonTable } from "@backend/modules/portfolio/tables/persons.table";
import { SubscriptionsTable } from "@backend/modules/subscriptions/tables/subscriptions.table";
import { FeatureFlagTable } from "@backend/modules/system/tables/feature_flags.table";
import { RateLimitTable } from "@backend/modules/system/tables/rate_limits.table";
import { TeamApiTable } from "@backend/modules/teams/tables/teams_api.table";
import { UserTable } from "@backend/modules/users/tables/users.table";
import { orchidORM } from "orchid-orm/node-postgres";

export const db = orchidORM(
	{
		...dbConfig,
		log: false,
	},
	{
		users: UserTable,
		files: FileTable,

		// Kosh ledger core (M1) — Layer 1 + Layer 2
		accessGrants: AccessGrantTable,
		persons: PersonTable,
		brokerAccounts: BrokerAccountTable,
		accountGroups: AccountGroupTable,
		accountGroupMembers: AccountGroupMemberTable,
		importBatches: ImportBatchTable,
		importFiles: ImportFileTable,
		rawTrades: RawTradeTable,
		rawLedgerLines: RawLedgerLineTable,
		rawHoldingsSnapshots: RawHoldingsSnapshotTable,
		instruments: InstrumentTable,
		marketState: MarketStateTable,
		priceBars: PriceBarTable,
		providerPayloads: ProviderPayloadTable,
		instrumentAliases: InstrumentAliasTable,
		events: EventTable,
		trades: TradeTable,
		tradeChargeUnits: TradeChargeUnitTable,
		cashFlows: CashFlowTable,
		corporateActionApplications: CorporateActionApplicationTable,
		corporateActions: CorporateActionTable,
		transferLinks: TransferLinkTable,

		// API only
		teamsApi: TeamApiTable,
		subscriptions: SubscriptionsTable,
		apiProductRequestLogs: ApiProductRequestLogsTable,

		// Backend only
		sessions: SessionTable,
		accounts: AccountTable,
		verifications: VerificationTable,
		pgTbusTaskLogs: PgTbusTaskLogTable,
		featureFlags: FeatureFlagTable,
		rateLimits: RateLimitTable,
		pushDevices: PushDeviceTable,
	},
);

export type Db = typeof db;
