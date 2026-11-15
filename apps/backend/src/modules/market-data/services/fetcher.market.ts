/**
 * The one door to the network for market data, so tests (and a relay, if a
 * server's address is blocked by the exchange) can stand in for it.
 */
export interface FetchedFile {
	/** HTTP status; 404 means "nothing was published", not a failure. */
	status: number;
	bytes: Buffer;
}

export type MarketFetcher = (url: string) => Promise<FetchedFile>;

// NSE's archive turns away requests that do not look like a browser's.
const USER_AGENT =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;

const liveFetcher: MarketFetcher = async (url) => {
	let lastError: unknown;
	for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
		try {
			const response = await fetch(url, {
				headers: { "user-agent": USER_AGENT, accept: "*/*" },
				signal: AbortSignal.timeout(TIMEOUT_MS),
				redirect: "follow",
			});
			// A server error is worth another try; a 404 or a 403 is an answer.
			if (response.status >= 500 && attempt < ATTEMPTS) {
				await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
				continue;
			}
			return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
		} catch (error) {
			lastError = error;
			if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
		}
	}
	throw lastError instanceof Error ? lastError : new Error(`Could not fetch ${url}`);
};

let current: MarketFetcher = liveFetcher;

export const fetchMarketFile: MarketFetcher = (url) => current(url);

/** Replace the network (tests). Returns a function that puts it back. */
export function useMarketFetcher(fetcher: MarketFetcher): () => void {
	const previous = current;
	current = fetcher;
	return () => {
		current = previous;
	};
}
