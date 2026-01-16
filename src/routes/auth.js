const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db'); // The connection we set up earlier

// 1. CREATE ACCOUNT (Register)
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Hash the password for security 
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save to the 'users' table we created in DBeaver 
        const newUser = await pool.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
            [email, hashedPassword]
        );
        res.json(newUser.rows[0]); 
    } catch (err) {
        res.status(500).send("User already exists or Server Error");
    }
});

// 2. LOG IN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (user.rows.length === 0) return res.status(400).send("User not found");

        // Compare scrambled passwords
        const isMatch = await bcrypt.compare(password, user.rows[0].password);
        if (!isMatch) return res.status(400).send("Invalid credentials");

        res.json({ message: "Logged in!", userId: user.rows[0].id });
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

module.exports = router;