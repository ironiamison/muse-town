import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/musebook-api": {
        target: "https://musebook.me",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/musebook-api/, ""),
      },
    },
  },
  preview: {
    proxy: {
      "/musebook-api": {
        target: "https://musebook.me",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/musebook-api/, ""),
      },
    },
  },
});
