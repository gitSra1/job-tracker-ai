const { Pool } = require('pg');
require('dotenv').config();

// 1. Get the raw string and immediately trim any hidden spaces/newlines
const rawConnectionString = process.env.DATABASE_URL || '';
const sanitizedConnectionString = rawConnectionString.trim();

// 2. Data Audit: Ensure we aren't passing an empty or placeholder string
if (!sanitizedConnectionString || sanitizedConnectionString === 'base') {
    console.error("❌ DATABASE_URL ERROR: The connection string is empty or invalid in the environment settings.");
}

const pool = new Pool({
  connectionString: sanitizedConnectionString,
  ssl: {
    // This allows the connection to Supabase's SSL-required servers
    rejectUnauthorized: false 
  },
  // Increased timeout for stable handshakes between Render and Supabase
  connectionTimeoutMillis: 10000, 
  idleTimeoutMillis: 30000,
  max: 20, // Connection limit
});

// 3. Connection Event Logger
pool.on('connect', () => {
  console.log('✅ Database Pool Connected Successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected Database Pool Error:', err.message);
});

module.exports = pool;