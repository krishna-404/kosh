// Calendar-date helpers for the metrics engine. Dates are YYYY-MM-DD strings,
// compared as strings; arithmetic goes through UTC so there is no time zone in it.

const DAY_MS = 86_400_000;

export const toMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);
export const fromMs = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const addDays = (date: string, days: number): string => fromMs(toMs(date) + days * DAY_MS);
export const daysBetween = (from: string, to: string): number => Math.round((toMs(to) - toMs(from)) / DAY_MS);

let fixedToday: string | null = null;

/** Today's date in India — where the markets Kosh prices from are. */
export const todayInIndia = (): string => fixedToday ?? fromMs(Date.now() + 5.5 * 3_600_000);

/** Tests only: pin "today". Returns a function that lets time run again. */
export function useFixedToday(date: string): () => void {
	fixedToday = date;
	return () => {
		fixedToday = null;
	};
}

/** Every calendar day from `from` to `to`, both included. */
export function dayRange(from: string, to: string): string[] {
	const days: string[] = [];
	for (let ms = toMs(from), end = toMs(to); ms <= end; ms += DAY_MS) days.push(fromMs(ms));
	return days;
}

export const isWeekday = (date: string): boolean => {
	const day = new Date(toMs(date)).getUTCDay();
	return day !== 0 && day !== 6;
};

/** `date` moved back by a number of years (29 Feb lands on 28 Feb). */
export function yearsBefore(date: string, years: number): string {
	const d = new Date(toMs(date));
	const month = d.getUTCMonth();
	d.setUTCFullYear(d.getUTCFullYear() - years);
	if (d.getUTCMonth() !== month) d.setUTCDate(0);
	return d.toISOString().slice(0, 10);
}

/** Two-decimal money string from a number. */
export const money = (n: number): string => (Math.round(n * 100) / 100).toFixed(2).replace(/^-0\.00$/, "0.00");
