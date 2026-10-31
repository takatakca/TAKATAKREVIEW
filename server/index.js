import { createApp, processOutbox } from "./app.js";
import { processSyncJobs } from "./sync.js";
const { app, store } = createApp();
const port = Number(process.env.PORT || 4100),
  host = process.env.HOST || "127.0.0.1";
const server = app.listen(port, host, () =>
  console.log(`TAKATAK Review listening on ${host}:${port}`),
);
// Resume interrupted sends using the same provider idempotency key.
store.db
  .prepare("UPDATE deliveries SET status='retry' WHERE status='sending'")
  .run();
let working = false;
const interval = setInterval(async () => {
  if (working) return;
  working = true;
  try {
    await processOutbox(store, process.env);
    await processSyncJobs(store, process.env);
  } finally {
    working = false;
  }
}, 30000).unref();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clearInterval(interval);
    server.close(() => {
      store.close();
      process.exit(0);
    });
  });
