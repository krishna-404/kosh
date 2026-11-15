import type { AccessLevel, Broker, GroupKind } from "@connected-repo/zod-schemas/enums.zod";

/**
 * The words for levels, brokers and group kinds — from the design's wording
 * board. Level names themselves ("Can view", "Can edit", "Owner") come from
 * the kit's LevelBadge; these are the sentences around them.
 *
 * Never in the UI: role, tenant, grant, permission, ACL, user, revoke,
 * collaborator, entity. Say person, remove, "Can view", "Can edit", "Owner".
 */

/** One line under each level in a level picker. */
export const LEVEL_SUMMARY: Record<AccessLevel, string> = {
	view: "Holdings, cash flows, returns and how they were worked out",
	edit: "Also upload statements, undo uploads, answer questions",
	owner: "Also invite people, change access, set fees, close accounts",
};

/** What a level lets someone see, for "Check before you send". */
export const LEVEL_SEES = [
	"Holdings, cash flows and returns, and how each number was worked out",
	"The same-money comparison with NIFTY and gold",
] as const;

/** What edit adds. */
export const LEVEL_EDIT_CAN = [
	"Upload statements and undo an upload",
	"Answer questions about ledger lines, dividends, splits and bonuses",
] as const;

/** What owner adds. */
export const LEVEL_OWNER_CAN = [
	"Invite people, change anyone’s access — including yours — and remove them",
	"Set the fund manager’s fee, rename or close the account",
] as const;

export const OWNER_WARNING =
	"An owner can remove you from this account. Only choose Owner for someone you’d hand the account to.";

export const BROKER_LABEL: Record<Broker, string> = {
	zerodha: "Zerodha",
	groww: "Groww",
	dhan: "Dhan",
	manual: "Other",
};

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
	family: "Family",
	fund_manager: "Fund manager",
	personal: "Personal",
	friends: "Friends",
};
