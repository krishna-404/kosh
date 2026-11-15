/**
 * Dates as Kosh writes them: "13 Nov 2026", "13 Nov", "Mar 2021", "10:42".
 *
 * A calendar date (`YYYY-MM-DD`, e.g. a trade date) has no time zone and is
 * formatted as written. A moment (epoch ms, e.g. when an upload happened) is
 * shown in the viewer's own time zone.
 */

const LOCALE = "en-IN";
const DAY_MS = 86_400_000;

const calendar = (isoDate: string): Date => new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, options);

const dayUtc = fmt({ day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayShortUtc = fmt({ day: "numeric", month: "short", timeZone: "UTC" });
const monthUtc = fmt({ month: "short", year: "numeric", timeZone: "UTC" });
const dayLocal = fmt({ day: "numeric", month: "short", year: "numeric" });
const dayShortLocal = fmt({ day: "numeric", month: "short" });
const timeLocal = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });

/** "2026-11-13" → "13 Nov 2026" */
export const formatDate = (isoDate: string): string => dayUtc.format(calendar(isoDate));

/** "2026-11-13" → "13 Nov" */
export const formatDateShort = (isoDate: string): string => dayShortUtc.format(calendar(isoDate));

/** "2021-03-09" → "Mar 2021" */
export const formatMonth = (isoDate: string): string => monthUtc.format(calendar(isoDate));

/** A moment → "13 Nov 2026" in the viewer's time zone. */
export const formatDay = (epochMs: number): string => dayLocal.format(epochMs);

/** A moment → "10:42" in the viewer's time zone. */
export const formatTime = (epochMs: number): string => timeLocal.format(epochMs);

const startOfLocalDay = (epochMs: number): number => {
	const d = new Date(epochMs);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
};

/** A moment → "Today", "Yesterday", "13 Nov" or (other years) "13 Nov 2025". */
export const formatDayLabel = (epochMs: number, now: number = Date.now()): string => {
	const days = Math.round((startOfLocalDay(now) - startOfLocalDay(epochMs)) / DAY_MS);
	if (days === 0) return "Today";
	if (days === 1) return "Yesterday";
	const sameYear = new Date(epochMs).getFullYear() === new Date(now).getFullYear();
	return sameYear ? dayShortLocal.format(epochMs) : dayLocal.format(epochMs);
};

/** A moment → "Today 10:42", "Yesterday 21:10", "13 Nov 16:05". */
export const formatWhen = (epochMs: number, now: number = Date.now()): string =>
	`${formatDayLabel(epochMs, now)} ${formatTime(epochMs)}`;
