#!/usr/bin/env node
/**
 * Design-system guard (docs/kosh/06-build-plan.md §2). Fails when:
 *
 *  1. a colour literal (hex, rgb(), hsl()) or a font-family name appears
 *     anywhere outside the design tokens file;
 *  2. the app imports MUI directly instead of through @connected-repo/ui-mui.
 *
 * Run: `yarn lint:design`
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const posix = (p) => p.split(sep).join("/");

/** Where colour and font literals are allowed to live. */
const TOKEN_FILES = new Set(["packages/ui-mui/src/theme/tokens.ts"]);

/**
 * Files that legitimately carry brand colours of their own:
 * a third party's logo, and the service worker (no theme at runtime).
 */
const COLOUR_EXEMPT = new Set([
	"packages/ui-mui/src/components/GoogleIcon.tsx",
	"apps/frontend/src/sw/sw.ts",
]);

const SCAN = ["apps/frontend/src", "packages/ui-mui/src"];
const EXT = /\.(ts|tsx)$/;
const SKIP = /\.(test|spec)\.tsx?$|\.d\.ts$/;

const walk = (dir) =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === "node_modules" ? [] : walk(path);
		return EXT.test(name) && !SKIP.test(name) ? [path] : [];
	});

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*\d/;
const FONT = /fontFamily\s*:\s*["'`](?!inherit)/;
const MUI_IMPORT = /from\s+["']@mui\/(material|icons-material|system)[^"']*["']/;

const strip = (line) => line.replace(/\/\/.*$/, "");

const problems = [];
for (const dir of SCAN) {
	for (const file of walk(join(root, dir))) {
		const rel = posix(relative(root, file));
		const inApp = rel.startsWith("apps/frontend/");
		const lines = readFileSync(file, "utf8").split("\n");
		let inBlockComment = false;
		lines.forEach((raw, index) => {
			if (inBlockComment) {
				if (raw.includes("*/")) inBlockComment = false;
				return;
			}
			const trimmed = raw.trim();
			if (trimmed.startsWith("/*") || trimmed.startsWith("*")) {
				if (trimmed.startsWith("/*") && !trimmed.includes("*/")) inBlockComment = true;
				return;
			}
			const line = strip(raw);
			const at = `${rel}:${index + 1}`;
			if (!TOKEN_FILES.has(rel) && !COLOUR_EXEMPT.has(rel)) {
				// "#123" inside a URL fragment or an id selector is not a colour;
				// only flag hex that sits inside a string or template literal.
				if (COLOUR.test(line) && /["'`]/.test(line)) {
					problems.push(`${at}  colour literal — use a theme token (theme.vars.palette.kosh.*)`);
				}
				if (FONT.test(line)) {
					problems.push(`${at}  font family — use a typography variant`);
				}
			}
			if (inApp && MUI_IMPORT.test(line)) {
				problems.push(`${at}  direct MUI import — import through @connected-repo/ui-mui`);
			}
		});
	}
}

if (problems.length > 0) {
	console.error(`Design-system guard: ${problems.length} problem(s)\n`);
	for (const p of problems) console.error(`  ${p}`);
	console.error("\nSee docs/kosh/06-build-plan.md §2.");
	process.exit(1);
}
console.log("Design-system guard: clean.");
