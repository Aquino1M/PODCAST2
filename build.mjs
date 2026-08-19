import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

for (const file of ["app.js", "server.mjs"]) {
  const check = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (check.status) process.exit(check.status);
}

await rm("dist", { recursive: true, force: true });
await mkdir("dist/app", { recursive: true });
await copyFile("index.html", "dist/index.html");
await copyFile("app.js", "dist/app.js");
await copyFile("app/globals.css", "dist/app/globals.css");
await copyFile("tiktoklSoKQMn2CNiRPQJWxyukHqLjjwxHYM09.txt", "dist/tiktoklSoKQMn2CNiRPQJWxyukHqLjjwxHYM09.txt");
await cp("public", "dist/public", { recursive: true });
