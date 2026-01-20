const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // REQUIRED for Supabase cloud connections
  },
  connectionTimeoutMillis: 10000 // Gives it 10 seconds to connect
});

module.exports = pool;