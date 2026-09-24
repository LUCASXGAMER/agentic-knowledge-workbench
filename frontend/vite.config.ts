import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          antd: ["antd", "@ant-design/icons"],
          charts: ["recharts"]
        }
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.FRONTEND_PORT || 8080),
    proxy: {
      "/api": {
        target: process.env.BACKEND_URL || "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/health": {
        target: process.env.BACKEND_URL || "http://127.0.0.1:8000",
        changeOrigin: true
      }
    }
  }
});
