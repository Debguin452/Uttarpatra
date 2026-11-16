import { defineWorkspace } from "vitest/config";

// packages/** and workers/** tests are pure logic — no DOM needed, so
// they stay on the root config's default (fast) node environment.
// apps/web's component tests need jsdom + the Preact plugin, which is
// its own config so the two don't have to compromise on environment.
export default defineWorkspace(["./vitest.config.ts", "./apps/web/vitest.config.ts"]);
