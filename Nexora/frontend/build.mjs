// Bundles src/main.jsx -> dist/app.js + dist/app.css and copies index.html.
// Usage: node build.mjs [--watch]
import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

const watch = process.argv.includes("--watch");
mkdirSync("dist", { recursive: true });
copyFileSync("index.html", "dist/index.html");
copyFileSync("favicon.svg", "dist/favicon.svg");

const options = {
  entryPoints: { app: "src/main.jsx" },
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: ["es2020"],
  jsx: "automatic",
  minify: !watch,
  sourcemap: watch,
  define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") },
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching for changes. Open http://localhost:8000 (served by the backend).");
} else {
  await esbuild.build(options);
}
