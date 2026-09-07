import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // The zxing wasm is a large binary; make sure the service worker will
      // cache it so a scan works with the radio off after first load.
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Yumbo — Produce Risk Scanner",
        short_name: "Yumbo",
        description:
          "Scan a grocery barcode and see pesticide and heavy-metal risk.",
        theme_color: "#0b0f0a",
        background_color: "#0b0f0a",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
