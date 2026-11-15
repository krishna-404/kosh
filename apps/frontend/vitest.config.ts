import path from "node:path";
import { defineConfig } from "vitest/config";

// Standalone vitest config (does NOT load vite.config.ts, which pulls in the
// PWA plugin + build-time env validation that unit tests don't need). Unit
// tests here cover pure logic — no DOM.
export default defineConfig({
	resolve: {
		alias: { "@frontend": path.resolve(import.meta.dirname, "src") },
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		// e2e specs are Playwright, not vitest.
		exclude: ["e2e/**", "node_modules/**", "**/*.spec.ts"],
	},
});
