const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const pool = require('./src/db');

const app = express();

// --- 1. Middleware & File Setup ---
app.use(cors()); 
app.use(express.json()); 
// Allows frontend to access files via http://localhost:5000/uploads/filename
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 

// Create 'uploads' folder automatically if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// --- 2. Authentication Routes ---

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
        console.error("Register Error:", err.message);
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

// --- 3. Job Tracker Route (Multi-Table Transaction) ---

app.post('/api/jobs', upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 }
]), async (req, res) => {
    // Multer populates req.body after processing the files
    const { role_name, company, job_url, job_description, status, user_id, reminder_enabled } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start DB Transaction

        // Convert string from FormData back to Boolean for PostgreSQL
        const isReminderOn = reminder_enabled === 'true'; 

        // Step 1: Insert Job
        const jobRes = await client.query(
            `INSERT INTO jobs (user_id, role_name, company, job_url, job_description, status, reminder_enabled) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [user_id, role_name, company, job_url, job_description, status, isReminderOn]
        );
        const jobId = jobRes.rows[0].id;

        // Step 2 & 3: File Processing Helper
        const processFile = async (fileArray, type) => {
            if (fileArray && fileArray[0]) {
                const file = fileArray[0];
                // Insert into 'resumes' table
                const fileRes = await client.query(
                    `INSERT INTO resumes (user_id, file_name, file_path, file_type) 
                     VALUES ($1, $2, $3, $4) RETURNING id`,
                    [user_id, file.originalname, file.path, type]
                );
                // Link to job in 'job_resumes' join table
                await client.query(
                    `INSERT INTO job_resumes (job_id, resume_id) VALUES ($1, $2)`,
                    [jobId, fileRes.rows[0].id]
                );
            }
        };

        if (req.files) {
            await processFile(req.files['resume'], 'resume');
            await processFile(req.files['coverLetter'], 'cover_letter');
        }

        await client.query('COMMIT'); // Success
        res.status(201).json({ message: "Application tracked successfully", jobId });
    } catch (err) {
        await client.query('ROLLBACK'); // Roll back on any error
        console.error("Save Error:", err.message);
        res.status(500).json({ error: "Failed to save data" });
    } finally {
        client.release(); // Return client to pool
    }
});

// --- 4. Get User Jobs Route ---
app.get('/api/jobs/:userId', async (req, res) => {
    try {
        const jobs = await pool.query(
            "SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC", 
            [req.params.userId]
        );
        res.json(jobs.rows);
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

// UPDATE JOB STATUS
app.put('/api/jobs/:jobId/status', async (req, res) => {
    const { jobId } = req.params;
    const { status } = req.body;
    try {
        await pool.query(
            "UPDATE jobs SET status = $1 WHERE id = $2",
            [status, jobId]
        );
        res.json({ message: "Status updated successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});
// --- 5. Server Startup ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});