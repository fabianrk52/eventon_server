const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
var bodyParser = require('body-parser')
var cors = require('cors')



const app = express();
const port = 65000;

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors())

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '12345',
    database: 'Eventon',
    port: 8000
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Connected to MySQL database');
    }
});

// Register route
app.post('/register', (req, res) => {
    const {
        role,
        supplierCategory,
        firstName,
        lastName,
        phoneNumber,
        email,
        password,
    } = req.body;

    // Check if the email already exists
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
        if (result.length > 0) {
            console.log("already exists");
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Insert the new user into the database
        db.query(
            'INSERT INTO users (first_name, last_name, phone_number, email, password, role, supplier_Category) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [firstName, lastName, phoneNumber, email, password, role, supplierCategory],
            (err, result) => {
                if (err) {
                    console.log("error user");
                    return res.status(500).json({ message: 'Error registering user', error: err });
                }
                res.status(201).json({ message: 'User registered successfully' });
                console.log("new user");
            }
        );
    });
});


// Login route
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Find the user by username
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
        if (err || result.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = result[0];

        // Check the plain text password
        if (password !== user.password) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate a token
        const token = jwt.sign({ userId: user.id }, 'your_jwt_secret', { expiresIn: '1h' });

        res.json({ token, userId: user.id });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
