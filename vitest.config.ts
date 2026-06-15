import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "bridge/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      // Resolve lumi-protocol from its workspace location.
      // Pointing to the package root lets vitest honour package.json#exports
      // rather than hard-coding a dist/ path that breaks after a rebuild.
      "lumi-protocol": resolve(
        __dirname,
        "./bridge/node_modules/lumi-protocol",
      ),
    },
  },
})
