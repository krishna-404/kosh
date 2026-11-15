import { PERIODS, type Period, type Scope } from "@connected-repo/zod-schemas/kosh/money.zod";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

/**
 * Which accounts a money page is looking at, and over what stretch of time.
 *
 * Both live in the address (`?in=group:01H…&over=1y`), so a view can be
 * bookmarked, opened in a new tab, and kept when moving between Overview and
 * Holdings. "Everything, since you started" is the plain address.
 */
const SCOPE_PARAM = "in";
const PERIOD_PARAM = "over";

export const EVERYTHING: Scope = { kind: "everything" };

export const scopeToParam = (scope: Scope): string | null =>
	scope.kind === "everything" ? null : `${scope.kind}:${scope.id}`;

export const scopeFromParam = (raw: string | null): Scope => {
	const [kind, id] = (raw ?? "").split(":");
	return id && (kind === "group" || kind === "holder" || kind === "account") ? { kind, id } : EVERYTHING;
};

export const periodFromParam = (raw: string | null): Period =>
	(PERIODS as readonly string[]).includes(raw ?? "") ? (raw as Period) : "all";

/** The query string that carries a scope and period to another money page ("" when both are the defaults). */
export const scopeSearch = (scope: Scope, period: Period = "all"): string => {
	const params = new URLSearchParams();
	const param = scopeToParam(scope);
	if (param) params.set(SCOPE_PARAM, param);
	if (period !== "all") params.set(PERIOD_PARAM, period);
	const search = params.toString();
	return search ? `?${search}` : "";
};

export const sameScope = (a: Scope, b: Scope): boolean => scopeToParam(a) === scopeToParam(b);

/** The scope and period in the address, and how to change them. */
export const useScope = () => {
	const [params, setParams] = useSearchParams();
	const scopeRaw = params.get(SCOPE_PARAM);
	const periodRaw = params.get(PERIOD_PARAM);
	const scope = useMemo(() => scopeFromParam(scopeRaw), [scopeRaw]);
	const period = periodFromParam(periodRaw);

	const set = useCallback(
		(key: string, value: string | null) =>
			setParams(
				(current) => {
					const next = new URLSearchParams(current);
					if (value === null) next.delete(key);
					else next.set(key, value);
					return next;
				},
				{ replace: true },
			),
		[setParams],
	);
	const setScope = useCallback((next: Scope) => set(SCOPE_PARAM, scopeToParam(next)), [set]);
	const setPeriod = useCallback((next: Period) => set(PERIOD_PARAM, next === "all" ? null : next), [set]);

	return { scope, period, setScope, setPeriod, search: scopeSearch(scope, period) };
};
