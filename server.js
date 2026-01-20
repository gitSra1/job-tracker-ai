const express = require('express');
const cors = require('cors'); // Using the library for cleaner code
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const pool = require('./src/db');

const app = express();

// --- 1. GLOBAL MIDDLEWARE (The Security Layer) ---

// Manual CORS + Options handling to satisfy preflight checks

app.get('/debug', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    message: 'Data Pipeline is active' 
  });
});

// Parse JSON bodies - Must be before routes!
app.use((req, res, next) => {
  // We use setHeader for better compatibility with Render's proxy
  res.setHeader('Access-Control-Allow-Origin', 'https://job-tracker-ai-virid.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle the Preflight OPTIONS request explicitly
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});
app.use(express.json());

// --- 2. CLOUD & SERVICE INITIALIZATION ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error("❌ CRITICAL ERROR: Supabase environment variables are missing!");
}

const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_ANON_KEY
);



// Use Memory Storage so Render's ephemeral disk doesn't lose files
const upload = multer({ storage: multer.memoryStorage() });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// --- 3. AUTHENTICATION ROUTES (The Ingestion Gates) ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email, hashedPassword]
    );
    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    console.error("Registration Error:", err.message);
    res.status(500).json({ error: "Registration failed" });
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
    res.status(500).send("Server Error");
  }
});

// --- 4. JOB & FILE MANAGEMENT (The Data Pipeline) ---



app.post('/api/jobs', upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'coverLetter', maxCount: 1 }
]), async (req, res) => {
  const { role_name, company, job_url, job_description, status, user_id, reminder_enabled } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN'); // Atomic Transaction Start

    const jobRes = await client.query(
      `INSERT INTO jobs (user_id, role_name, company, job_url, job_description, status, reminder_enabled) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [user_id, role_name, company, job_url, job_description, status, reminder_enabled === 'true']
    );
    const jobId = jobRes.rows[0].id;

    const uploadToCloud = async (file, type) => {
      if (!file) return;
      const cloudPath = `${user_id}/${Date.now()}-${file.originalname}`;
      
      const { data, error } = await supabase.storage
        .from('resumes')
        .upload(cloudPath, file.buffer, { contentType: file.mimetype });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('resumes').getPublicUrl(cloudPath);

      const fileRes = await client.query(
        `INSERT INTO resumes (user_id, file_name, file_path, file_type) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [user_id, file.originalname, publicUrl, type]
      );

      await client.query(
        `INSERT INTO job_resumes (job_id, resume_id) VALUES ($1, $2)`,
        [jobId, fileRes.rows[0].id]
      );
    };

    if (req.files) {
      if (req.files['resume']) await uploadToCloud(req.files['resume'][0], 'resume');
      if (req.files['coverLetter']) await uploadToCloud(req.files['coverLetter'][0], 'cover_letter');
    }

    await client.query('COMMIT'); 
    res.status(201).json({ message: "Cloud sync successful", jobId });
  } catch (err) {
    await client.query('ROLLBACK'); 
    console.error("Cloud Ingestion Error:", err);
    res.status(500).json({ error: "Failed to ingest data to cloud" });
  } finally {
    client.release();
  }
});

app.get('/api/jobs/:userId', async (req, res) => {
  try {
    const jobs = await pool.query("SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC", [req.params.userId]);
    res.json(jobs.rows);
  } catch (err) { res.status(500).send("Server Error"); }
});

app.put('/api/jobs/:jobId/status', async (req, res) => {
  const { jobId } = req.params;
  const { status } = req.body;
  try {
    await pool.query("UPDATE jobs SET status = $1 WHERE id = $2", [status, jobId]);
    res.json({ message: "Status updated" });
  } catch (err) { res.status(500).send("Server Error"); }
});

// --- 5. ORCHESTRATION (The Automated Trigger) ---

app.post('/api/reminders/send', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.REMINDER_SECRET}`) return res.status(401).send('Unauthorized');
  
  try {
    const pendingJobs = await pool.query(
      `SELECT j.role_name, j.company, u.email FROM jobs j 
       JOIN users u ON j.user_id = u.id 
       WHERE j.status = 'Pending' AND j.reminder_enabled = true`
    );
    for (let job of pendingJobs.rows) {
      await transporter.sendMail({
        from: '"JobTracker AI" <no-reply@jobtracker.com>',
        to: job.email,
        subject: `Reminder: ${job.role_name}`,
        text: `Time to check on your ${job.role_name} application at ${job.company}!`
      });
    }
    res.json({ message: `Sent ${pendingJobs.rows.length} reminders.` });
  } catch (err) { 
    console.error("Orchestration Error:", err);
    res.status(500).send('Orchestration failed.'); 
  }
});

// --- 6. SERVER STARTUP ---

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Data Pipeline Active on Port ${PORT}`);
});