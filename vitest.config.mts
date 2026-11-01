import { defineConfig } from "vitest/config";
import path from "node:path";

const root = process.cwd();
export default defineConfig({
  resolve: { alias: { "@": path.resolve(root, "src"), "server-only": path.resolve(root, "tests/stubs/server-only.ts") } },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 60000, hookTimeout: 120000 },
});
