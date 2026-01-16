const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('../db');

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Files will be saved in the 'uploads' folder
  },
  filename: (req, file, cb) => {
    // Rename file to avoid conflicts: timestamp-originalName
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// --- Updated POST Route ---
// upload.single('resume') looks for a field named 'resume' in the form data
router.post('/', uploadFields, async (req, res) => {
  const { role_name, company, job_url, job_description, status, user_id, reminder_enabled } = req.body;
  const client = await pool.connect(); // Use a single client for a transaction

  try {
    await client.query('BEGIN'); // Start Transaction

    // 1. Insert into 'jobs' table
    const jobRes = await client.query(
      `INSERT INTO jobs (user_id, role_name, company, job_url, job_description, status, reminder_enabled) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [user_id, role_name, company, job_url, job_description, status, reminder_enabled === 'true']
    );
    const jobId = jobRes.rows[0].id;

    // 2. Helper function to handle file inserts into 'resumes' and 'job_resumes'
    const saveDocument = async (file, type) => {
      if (file) {
        const docRes = await client.query(
          `INSERT INTO resumes (user_id, file_name, file_path, file_type) 
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [user_id, file[0].originalname, file[0].path, type]
        );
        const resumeId = docRes.rows[0].id;

        // Link the document to the job in the join table
        await client.query(
          `INSERT INTO job_resumes (job_id, resume_id) VALUES ($1, $2)`,
          [jobId, resumeId]
        );
      }
    };

    // Process Resume and Cover Letter specifically
    await saveDocument(req.files['resume'], 'resume');
    await saveDocument(req.files['coverLetter'], 'cover_letter');

    await client.query('COMMIT'); // Commit all changes
    res.json({ message: "Job and documents saved successfully!", jobId });

  } catch (err) {
    await client.query('ROLLBACK'); // Undo everything if any step fails
    console.error(err.message);
    res.status(500).json({ error: "Failed to save application." });
  } finally {
    client.release();
  }
});

module.exports = router;