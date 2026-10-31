import { spawn } from "node:child_process";
const api = spawn(process.execPath, ["server/index.js"], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});
const web = spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
  stdio: "inherit",
});
let exiting = false;
function stop(code = 0) {
  if (exiting) return;
  exiting = true;
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  setTimeout(() => process.exit(code), 200).unref();
}
api.on("exit", (code) => stop(code || 0));
web.on("exit", (code) => stop(code || 0));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
