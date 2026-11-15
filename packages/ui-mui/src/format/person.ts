/** "Anil Mehta" → "AM", "Anil Mehta HUF" → "AH", "riya" → "R". */
export const initialsOf = (name: string): string => {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return "?";
	const first = words[0]?.[0] ?? "";
	const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
	return `${first}${last}`.toUpperCase();
};

/** A stable index in `[0, size)` for a key — the same person, the same colour. */
export const stableIndex = (key: string, size: number): number => {
	let hash = 0;
	for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
	return hash % size;
};
