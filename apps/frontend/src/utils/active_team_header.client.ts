/**
 * Accessor for the `x-team-id` header value.
 *
 * `getActiveTeamIdReady()` returns a Promise that resolves once the value has
 * been set at least once (even to `null`). This is what the RPC link's
 * `async headers()` awaits, so no request can go out with an *unset* header
 * cache.
 *
 * The distinction matters because "unset" and "logged out (null)" are
 * different states:
 *   - unset  → RPC should wait (cache hasn't been seeded yet)
 *   - null   → RPC should proceed without `x-team-id` (logged out /
 *              anonymous / bootstrap)
 *
 * Seeded by `authLoader` right after `authClient.getSession()`, then
 * re-seeded on team switch via `WorkspaceContext.setActiveTeam`.
 */

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (v: T) => void;
}

function createDeferred<T>(): Deferred<T> {
	let resolve!: (v: T) => void;
	const promise = new Promise<T>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

// `ready.promise` pends until the FIRST call to
// `setActiveTeamIdForRequests`. Subsequent calls swap in an
// already-resolved promise so new awaiters get the latest value
// immediately.
let ready = createDeferred<string | null>();
let hasResolved = false;

export const setActiveTeamIdForRequests = (teamId: string | null): void => {
	if (!hasResolved) {
		hasResolved = true;
		ready.resolve(teamId);
	} else {
		ready = { promise: Promise.resolve(teamId), resolve: () => {} };
	}
};

/**
 * Awaited by the RPC link's `async headers()`. Blocks until the cache has
 * been seeded at least once; then resolves near-instantly on every call.
 */
export const getActiveTeamIdReady = (): Promise<string | null> => ready.promise;
