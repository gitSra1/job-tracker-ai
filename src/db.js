const { Pool } = require('pg');
require('dotenv').config();

// For Data Engineering, we use the connection string for better portability
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Required for Supabase and other cloud providers to encrypt the data pipeline
    rejectUnauthorized: false 
  }
});

// Event listener for active monitoring of the data connection
pool.on('connect', () => {
  console.log('✅ Connected to the Supabase Cloud Database');
});

// Critical for Data Reliability: Alerts if the connection to the data store drops
pool.on('error', (err) => {
  console.error('❌ Data Pipeline Error: Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;