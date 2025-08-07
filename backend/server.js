require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'feedback_db',
    password: process.env.DB_PASSWORD || 'yourpassword',
    port: process.env.DB_PORT || 5432,
});

// Initialize database
async function initializeDatabase() {
    try {
        // Create database if it doesn't exist (requires separate connection)
        const adminPool = new Pool({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            password: process.env.DB_PASSWORD || 'yourpassword',
            port: process.env.DB_PORT || 5432,
        });
        
        await adminPool.query(`CREATE DATABASE ${process.env.DB_NAME || 'feedback_db'};`)
            .catch(err => console.log('Database already exists or creation failed:', err.message));
        await adminPool.end();

        // Create table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS feedback (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                feedback_type VARCHAR(50) NOT NULL,
                rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
                comments TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Database initialization error:', err);
    }
}

// Routes
app.post('/api/feedback', async (req, res) => {
    try {
        const { name, email, feedbackType, rating, comments } = req.body;

        // Validation
        if (!name || !email || !feedbackType || !rating || !comments) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const query = `
            INSERT INTO feedback (name, email, feedback_type, rating, comments)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [name, email, feedbackType, rating, comments];

        const result = await pool.query(query, values);
        
        res.status(201).json({
            message: 'Feedback submitted successfully',
            feedback: result.rows[0]
        });

    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/feedback', async (req, res) => {
    try {
        const query = 'SELECT * FROM feedback ORDER BY created_at DESC;';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Initialize and start server
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
});
