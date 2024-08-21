const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2/promise');
const app = express();
const PORT = 3000;


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static('public'));

const config = {
    user: 'root',
    server: 'localhost',
    database: 'Exercise',
    password: '12345',
    port: 8000
};

let connection;

mysql.createConnection(config)
    .then(conn => {
        connection = conn;
        console.log('Connected to MySQL');
    })
    .catch(err => {
        console.error('Database connection failed:', err);
    });

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const [rows] = await connection.execute('SELECT username FROM Users WHERE email = ? AND password = ?', [email, password]);

        if (rows.length > 0) {
            res.status(201).send('User Log In successfully');
        } else {
            res.status(401).send('Invalid email or password');
        }
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Internal server error');
    }
});

app.post('/register', async (req, res) => {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
        return res.status(400).send('Missing required fields');
    }

    try {
        const [rows] = await connection.execute('SELECT 1 FROM Users WHERE email = ?', [email]);

        if (rows.length > 0) {
            return res.status(400).send('User already exists');
        }

        await connection.execute('INSERT INTO Users (email, password, username) VALUES (?, ?, ?)', [email, password, username]);

        res.status(201).send('User registered successfully');
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Internal server error');
    }
});

app.get('/user', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await connection.execute('SELECT email, username FROM Users');
        res.json(rows);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Internal server error');
    }
});

app.get('/api/user', async (req, res) => {
    const {email} = req.query;
    try {
        const [rows] = await connection.execute('SELECT username FROM Users WHERE email = ?', 
            [email]);
        res.json(rows);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Internal server error');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
