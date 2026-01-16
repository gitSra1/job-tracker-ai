const { Pool } = require('pg');
require('dotenv').config();

// The Pool handles multiple connections to the database efficiently
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// This helps us debug if the server successfully connects
pool.on('connect', () => {
  console.log('✅ Connected to the PostgreSQL database');
});

// If the database connection drops, this will alert us
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle database client', err);
  process.exit(-1);
});

module.exports = pool;