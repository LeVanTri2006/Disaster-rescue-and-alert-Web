import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const email = 'admin@example.com';
    const res = await pool.query('SELECT * FROM public."user" WHERE email = $1', [email]);
    if (res.rows.length > 0) {
      console.log('Admin user exists. Updating role to ADMIN');
      await pool.query('UPDATE public."user" SET role = $1, status = $2 WHERE email = $3', ['ADMIN', 'ACTIVE', email]);
      return;
    }
    
    // Create UUID
    const id = require('crypto').randomUUID();
    const hashedPassword = await bcrypt.hash('Admin@123456', 10);
    const now = new Date().toISOString();
    
    await pool.query(`
      INSERT INTO public."user" (id, email, password, "fullName", role, status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, email, hashedPassword, 'System Admin', 'ADMIN', 'ACTIVE', now, now]);
    
    console.log('Admin user created successfully!');
  } finally {
    pool.end();
  }
}

main().catch(console.error);
