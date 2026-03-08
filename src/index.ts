import { createApp } from "./app.js";
import { getDatabase, closeDatabase } from "./db/connection.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

const db = getDatabase();
const app = createApp(db);

const server = app.listen(PORT, () => {
  console.log(`Golfshot server listening on http://localhost:${PORT}`);
});

process.on("SIGTERM", () => {
  server.close();
  closeDatabase();
});

process.on("SIGINT", () => {
  server.close();
  closeDatabase();
});
