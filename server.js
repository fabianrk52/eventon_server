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
            return res.status(201).json({ message: 'Email already exists' });
        }

        // Insert the new user into the database
        db.query(
            'INSERT INTO users (first_name, last_name, phone_number, email, password, role, supplier_category) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [firstName, lastName, phoneNumber, email, password, role, supplierCategory],
            (err, result) => {
                if (err) {
                    console.log("error user");
                    return res.status(500).json({ message: 'Error registering user', error: err });
                }
                res.status(200).json({ message: 'User registered successfully' });
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
        const token = jwt.sign({ userId: user.id, name: user.first_name + " " + user.last_name }, 'your_jwt_secret', { expiresIn: '1h' });

        res.json({ token, userId: user.id, name: user.first_name + " " + user.last_name });
        console.log("login success");
    });
});

app.get('/user-profile/:id', (req, res) => {
    const userId = req.params.id;

    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, result) => {
        if (err || result.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(result[0]);
    });
});

app.get('/suppliers', (req, res) => {
    db.query('SELECT * FROM users WHERE role = "Supplier"', (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching suppliers', error: err });
        }
        res.json(results);
    });
});


app.post('/add_event', (req, res) => {
    const { title, date, location, description, budget, status, numGuests, teammate, userId } = req.body;

    db.query(
        'INSERT INTO events (title, date, location, description, budget, status, num_guests, teammate, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [title, date, location, description, budget, status, numGuests, teammate, userId],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Error creating event', error: err });
            }
            res.status(201).json({ message: 'Event created successfully', eventId: result.insertId });
        }
    )
});


app.get('/events-with-details', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const decodedToken = jwt.verify(token, 'your_jwt_secret');
    const userId = decodedToken.userId;

    // Query to fetch all events for the logged-in user
    const query = `
      SELECT 
        e.id AS event_id, 
        e.title, 
        e.date, 
        e.location, 
        e.description, 
        e.budget, 
        e.status, 
        e.num_guests, 
        e.teammate,
        g.id AS guest_id, 
        g.name AS guest_name, 
        g.surname AS guest_surname, 
        g.phone AS guest_phone, 
        g.confirmation AS guest_confirmation, 
        g.table_number AS guest_table,
        t.id AS task_id, 
        t.title AS task_title, 
        t.description AS task_description, 
        t.deadline AS task_deadline, 
        t.priority AS task_priority, 
        t.teammate AS task_teammate, 
        t.status AS task_status
      FROM events e
      LEFT JOIN guests g ON e.id = g.event_id
      LEFT JOIN tasks t ON e.id = t.event_id
      WHERE e.user_id = ?;
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching events', error: err });
        }

        // Process the results to group guests and tasks by event
        const eventsMap = {};

        results.forEach(row => {
            const eventId = row.event_id;

            // If the event is not yet added to the map, add it
            if (!eventsMap[eventId]) {
                eventsMap[eventId] = {
                    id: eventId,
                    title: row.title,
                    date: row.date,
                    location: row.location,
                    description: row.description,
                    budget: row.budget,
                    status: row.status,
                    num_guests: row.num_guests,
                    teammate: row.teammate,
                    guests: [],
                    tasks: []
                };
            }

            // Add guest to the event
            if (row.guest_id) {
                eventsMap[eventId].guests.push({
                    id: row.guest_id,
                    name: row.guest_name,
                    surname: row.guest_surname,
                    phone: row.guest_phone,
                    confirmation: row.guest_confirmation,
                    table: row.guest_table
                });
            }

            // Add task to the event
            if (row.task_id) {
                eventsMap[eventId].tasks.push({
                    id: row.task_id,
                    title: row.task_title,
                    description: row.task_description,
                    deadline: row.task_deadline,
                    priority: row.task_priority,
                    teammate: row.task_teammate,
                    status: row.task_status
                });
            }
        });

        // Convert the events map to an array
        const events = Object.values(eventsMap);

        res.json(events);
    });
});


// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
