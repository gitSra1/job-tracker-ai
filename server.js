const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js'); // Added Supabase SDK
require('dotenv').config();
const pool = require('./src/db');

const app = express();

// --- 1. Middleware & Cloud Setup ---
app.use(cors()); 
app.use(express.json()); 

// Initialize Supabase Client for Cloud Storage
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Switch Multer to Memory Storage (Files stay in RAM temporarily)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 2. Email Orchestration (Nodemailer) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- 3. Authentication Routes ---
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
        res.status(500).send("Server Error");
    }
});

// --- 4. Job Management & Cloud File Ingestion ---

app.post('/api/jobs', upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 }
]), async (req, res) => {
    const { role_name, company, job_url, job_description, status, user_id, reminder_enabled } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN'); // Start Transaction

        // 1. Insert Job Metadata
        const jobRes = await client.query(
            `INSERT INTO jobs (user_id, role_name, company, job_url, job_description, status, reminder_enabled) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [user_id, role_name, company, job_url, job_description, status, reminder_enabled === 'true']
        );
        const jobId = jobRes.rows[0].id;

        // 2. Helper to Pipe Buffer to Cloud Storage
        const uploadToCloud = async (file, type) => {
            if (!file) return;
            
            // Generate a unique path in the Cloud Data Lake
            const cloudPath = `${user_id}/${Date.now()}-${file.originalname}`;
            
            // Upload the Buffer directly to Supabase 'resumes' bucket
            const { data, error } = await supabase.storage
                .from('resumes')
                .upload(cloudPath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });

            if (error) throw error;

            // Generate Public URL for retrieval
            const { data: { publicUrl } } = supabase.storage
                .from('resumes')
                .getPublicUrl(cloudPath);

            // Save the URL reference in PostgreSQL
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

        // Ingest files into the pipeline
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

// Other routes remain the same...
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

app.post('/api/reminders/send', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.REMINDER_SECRET}`) return res.status(401).send('Unauthorized');
    try {
        const pendingJobs = await pool.query(
            `SELECT j.role_name, j.company, u.email FROM jobs j JOIN users u ON j.user_id = u.id 
             WHERE j.status = 'Pending' AND j.reminder_enabled = true`
        );
        for (let job of pendingJobs.rows) {
            await transporter.sendMail({
                from: '"JobTracker AI" <no-reply@jobtracker.com>',
                to: job.email,
                subject: `Reminder: ${job.role_name}`,
                text: `Reminder for ${job.role_name} at ${job.company}.`
            });
        }
        res.json({ message: `Sent ${pendingJobs.rows.length} reminders.` });
    } catch (err) { res.status(500).send('Orchestration failed.'); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Cloud Data Pipeline Active on http://localhost:${PORT}`));