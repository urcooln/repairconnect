// repairconnect-backend/db.js
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
});

export default sql;
