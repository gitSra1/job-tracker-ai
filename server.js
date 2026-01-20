require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const pool = require('./src/db');

const app = express();

// --- 1. DATA AUDIT & SANITIZATION ---
const SB_URL = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : null;
const SB_KEY = process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.trim() : null;

// --- 2. GLOBAL MIDDLEWARE ---
app.use((req, res, next) => {
  // Replace with your specific Vercel URL for production security
  res.setHeader('Access-Control-Allow-Origin', 'https://job-tracker-ai-virid.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});
app.use(express.json());

// --- 3. SERVICE INITIALIZATION ---
const supabase = createClient(
  SB_URL || 'https://placeholder.supabase.co',
  SB_KEY || 'placeholder'
);

// --- 4. AUTHENTICATION ROUTES ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email, hashedPassword]
    );
    res.status(201).json({ message: "User created", userId: newUser.rows[0].id });
  } catch (err) {
    console.error("Register Error:", err.message);
    res.status(500).json({ error: "Email already exists or DB error" });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    res.json({ message: "Login successful", userId: user.rows[0].id });
  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- 5. UTILITY & STARTUP ---
app.get('/debug', (req, res) => {
  res.json({ status: 'online', supabase_ready: !!SB_URL, db_ready: !!process.env.DATABASE_URL });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Data Pipeline Active on Port ${PORT}`);
});