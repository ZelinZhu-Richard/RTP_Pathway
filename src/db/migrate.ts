// Applies drizzle/ migrations to the SQLite file. Run via `npm run db:migrate`.
import { db } from "./client";

// Importing the client runs migrations on boot; touching it here is enough.
void db;
console.log("Migrations applied.");
