import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  /* 产物部署到仓库 /website 时，用相对路径加载 JS/CSS */
  base: "./",
});
