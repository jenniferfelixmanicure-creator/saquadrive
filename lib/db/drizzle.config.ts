import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  console.warn("Aviso: DATABASE_URL não definida.");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
