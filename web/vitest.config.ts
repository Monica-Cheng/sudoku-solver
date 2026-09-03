import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    // the full parity suite (min_conflicts on hard) is slow; opt in with RUN_SLOW=1
    testTimeout: 120_000,
  },
});
