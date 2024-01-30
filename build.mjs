import { build } from "esbuild";
import { rmSync } from "node:fs";

const args = process.argv.slice(2);

const watch = args.some((p) => p == "--watch");

console.log("cleaning output directory");
rmSync("./dist", { recursive: true, force: true });

console.log("starting build for extension");
build({
  entryPoints: ["src/extension.ts"],
  platform: "node",
  external: ["vscode"],
  bundle: true,
  sourcemap: true,
  outfile: "dist/extension.js",
})
  .then(() => {
    console.log("finished build for extension.");
  })
  .catch(() => process.exit(1));
