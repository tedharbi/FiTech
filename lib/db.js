import { Pool } from 'pg';
import dotenv from "dotenv";
dotenv.config();
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Neon or local URL
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
