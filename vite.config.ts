import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Standalone starter config for the exported SoundChat source.
// The Muse artifact bundles differently (see client/build.mjs and
// SOUNDCHAT_NOTES.md); this config is for running the client with Vite.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: ".",
  build: { outDir: "dist" },
  server: { port: 5173 },
});
