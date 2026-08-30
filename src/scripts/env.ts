// Loads local env for CLI scripts (db:migrate, seed). `.env.local` wins over `.env`.
// Not imported by the Next.js app — Next loads its own env.
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
