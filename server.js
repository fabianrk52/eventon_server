const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 65000;

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

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

// JWT Token verification middleware
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Authorization header missing' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, 'your_jwt_secret', (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = decoded;  // Add decoded token to request
        next();
    });
};

// Reusable function for queries
const executeQuery = (query, params, res, successMessage) => {
    db.query(query, params, (err, result) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ message: 'Database error', error: err });
        }
        res.status(200).json(successMessage || result);
    });
};

// Register route
app.post('/register', (req, res) => {
    const { role, supplierCategory, firstName, lastName, phoneNumber, email, password } = req.body;
    const userId = uuidv4();

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err });
        if (result.length > 0) return res.status(409).json({ message: 'Email already exists' });

        const query = 'INSERT INTO users (id, first_name, last_name, phone_number, email, password, role, supplier_category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        const params = [userId, firstName, lastName, phoneNumber, email, password, role, supplierCategory || "None"];
        executeQuery(query, params, res, { message: 'User registered successfully' });
    });
});

// Login route
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
        if (err || result.length === 0) return res.status(400).json({ message: 'Invalid credentials' });

        const user = result[0];
        if (password !== user.password) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ userId: user.id, name: `${user.first_name} ${user.last_name}` }, 'your_jwt_secret', { expiresIn: '1h' });
        res.json({ token, userId: user.id, name: `${user.first_name} ${user.last_name}` });
    });
});

// Get user profile route
app.get('/user-profile/:id', verifyToken, (req, res) => {
    const userId = req.params.id;
    executeQuery('SELECT * FROM users WHERE id = ?', [userId], res);
});

// Update user profile route
app.put('/user-profile/:id', verifyToken, (req, res) => {
    const userId = req.params.id;
    const { first_name, last_name, email, phone_number, bio, supplier_category, profilePhoto, coverPhoto } = req.body;

    const query = `
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ?, phone_number = ?, bio = ?, supplier_category = ?, profile_photo = ?, cover_photo = ?
        WHERE id = ?`;
    const params = [first_name, last_name, email, phone_number, bio, supplier_category, profilePhoto, coverPhoto, userId];

    db.query(query, params, (err, result) => {
        if (err) {
            console.error('Error updating profile:', err);
            return res.status(500).json({ message: 'Error updating profile', error: err });
        }
        res.status(200).json({ message: 'Profile updated successfully' });
    });
});


// Get suppliers route
app.get('/suppliers', verifyToken, (req, res) => {
    executeQuery('SELECT * FROM users WHERE role = "Supplier"', [], res);
});

// Get events with details route
app.get('/events-with-details', verifyToken, (req, res) => {
    const userId = req.user.userId;

    const query = `
      SELECT 
        e.id AS event_id, e.title, e.date, e.location, e.description, e.budget, e.status, e.num_guests, e.teammate,
        g.id AS guest_id, g.name AS guest_name, g.surname AS guest_surname, g.phone AS guest_phone, g.confirmation AS guest_confirmation, g.table_number AS guest_table,
        t.id AS task_id, t.title AS task_title, t.description AS task_description, t.deadline AS task_deadline, t.priority AS task_priority, t.teammate AS task_teammate, t.status AS task_status
      FROM events e
      LEFT JOIN guests g ON e.id = g.event_id
      LEFT JOIN tasks t ON e.id = t.event_id
      WHERE e.user_id = ?;
    `;

    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error fetching events', error: err });

        const eventsMap = {};
        results.forEach(row => {
            const eventId = row.event_id;
            if (!eventsMap[eventId]) {
                eventsMap[eventId] = {
                    id: eventId, title: row.title, date: row.date, location: row.location,
                    description: row.description, budget: row.budget, status: row.status,
                    num_guests: row.num_guests, teammate: row.teammate, guests: [], tasks: []
                };
            }
            if (row.guest_id) eventsMap[eventId].guests.push({ id: row.guest_id, name: row.guest_name, surname: row.guest_surname, phone: row.guest_phone, confirmation: row.guest_confirmation, table: row.guest_table });
            if (row.task_id) eventsMap[eventId].tasks.push({ id: row.task_id, title: row.task_title, description: row.task_description, deadline: row.task_deadline, priority: row.task_priority, teammate: row.task_teammate, status: row.task_status });
        });

        const events = Object.values(eventsMap);
        res.json(events);
    });
});

app.get('/events-with-details/:eventId', verifyToken, (req, res) => {
    const { eventId } = req.params;

    const query = `
        SELECT 
            e.id AS event_id, e.title, e.date, e.location, e.description, e.budget, e.status, e.num_guests, e.teammate,
            g.id AS guest_id, g.name AS guest_name, g.surname AS guest_surname, g.phone AS guest_phone, g.confirmation AS guest_confirmation, g.table_number AS guest_table,
            t.id AS task_id, t.title AS task_title, t.description AS task_description, t.deadline AS task_deadline, t.priority AS task_priority, t.teammate AS task_teammate, t.status AS task_status
        FROM events e
        LEFT JOIN guests g ON e.id = g.event_id
        LEFT JOIN tasks t ON e.id = t.event_id
        WHERE e.id = ?;
    `;

    db.query(query, [eventId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error fetching event details', error: err });

        // Transform results into a single event object with guests and tasks arrays
        const event = {
            id: results[0]?.event_id || null,
            title: results[0]?.title || '',
            date: results[0]?.date || '',
            location: results[0]?.location || '',
            description: results[0]?.description || '',
            budget: results[0]?.budget || '',
            status: results[0]?.status || '',
            num_guests: results[0]?.num_guests || 0,
            teammate: results[0]?.teammate || '',
            guests: [],
            tasks: []
        };

        results.forEach(row => {
            if (row.guest_id) {
                event.guests.push({
                    id: row.guest_id,
                    name: row.guest_name,
                    surname: row.guest_surname,
                    phone: row.guest_phone,
                    confirmation: row.guest_confirmation,
                    table: row.guest_table
                });
            }
            if (row.task_id) {
                event.tasks.push({
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

        res.status(200).json(event);
    });
});


// Add event route
app.post('/add_event', verifyToken, (req, res) => {
    const userId = req.user.userId;
    const { title, date, location, description, budget, status, numGuests, teammate } = req.body;
    const eventId = uuidv4();

    const query = 'INSERT INTO events (id, title, date, location, description, budget, status, num_guests, teammate, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [eventId, title, date, location, description, budget, status, numGuests, teammate, userId];
    executeQuery(query, params, res, { message: 'Event created successfully', eventId });
});

// Add guest to event route
app.post('/events/:eventId/guests', verifyToken, (req, res) => {
    const { eventId } = req.params;
    const { name, surname, phone, confirmation, table } = req.body;
    const guestId = uuidv4();

    const query = 'INSERT INTO guests (id, name, surname, phone, confirmation, table_number, event_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const params = [guestId, name, surname, phone, confirmation || "None", table, eventId];
    executeQuery(query, params, res, { message: 'Guest added successfully', guestId });
});

// Add task to event route
app.post('/events/:eventId/tasks', verifyToken, (req, res) => {
    const { eventId } = req.params;
    const { title, description, deadline, priority, teammate, status } = req.body;
    const taskId = uuidv4();

    const query = 'INSERT INTO tasks (id, title, description, deadline, priority, teammate, status, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [taskId, title, description, deadline, priority, teammate, status, eventId];
    executeQuery(query, params, res, { message: 'Task added successfully', taskId });
});

// Update event route
app.put('/events/:eventId', verifyToken, (req, res) => {
    const { eventId } = req.params;
    const { title, date, location, description, budget, status, num_guests, teammate } = req.body;

    const query = 'UPDATE events SET title = ?, date = ?, location = ?, description = ?, budget = ?, status = ?, num_guests = ?, teammate = ? WHERE id = ?';
    const params = [title, date, location, description, budget, status, num_guests, teammate, eventId];
    executeQuery(query, params, res, { message: 'Event updated successfully' });
});

// Update guest route
app.put('/events/:eventId/guests/:guestId', verifyToken, (req, res) => {
    const { guestId } = req.params;
    const { name, surname, phone, confirmation, table } = req.body;

    const query = 'UPDATE guests SET name = ?, surname = ?, phone = ?, confirmation = ?, table_number = ? WHERE id = ?';
    const params = [name, surname, phone, confirmation, table, guestId];
    executeQuery(query, params, res, { message: 'Guest updated successfully' });
});

// Update task route
app.put('/events/:eventId/tasks/:taskId', verifyToken, (req, res) => {
    const { taskId } = req.params;
    const { title, description, deadline, priority, teammate, status } = req.body;

    const query = 'UPDATE tasks SET title = ?, description = ?, deadline = ?, priority = ?, teammate = ?, status = ? WHERE id = ?';
    const params = [title, description, deadline, priority, teammate, status, taskId];
    executeQuery(query, params, res, { message: 'Task updated successfully' });
});

// Delete guest route
app.delete('/events/:eventId/guests/:guestId', verifyToken, (req, res) => {
    const { guestId } = req.params;
    executeQuery('DELETE FROM guests WHERE id = ?', [guestId], res, { message: 'Guest deleted successfully' });
});

// Delete task route
app.delete('/events/:eventId/tasks/:taskId', verifyToken, (req, res) => {
    const { taskId } = req.params;
    executeQuery('DELETE FROM tasks WHERE id = ?', [taskId], res, { message: 'Task deleted successfully' });
});

// Delete event route
app.delete('/events/:eventId', verifyToken, (req, res) => {
    const { eventId } = req.params;

    // Delete related guests and tasks first
    db.query('DELETE FROM guests WHERE event_id = ?', [eventId], (err) => {
        if (err) return res.status(500).json({ message: 'Error deleting related guests', error: err });

        db.query('DELETE FROM tasks WHERE event_id = ?', [eventId], (err) => {
            if (err) return res.status(500).json({ message: 'Error deleting related tasks', error: err });

            db.query('DELETE FROM events WHERE id = ?', [eventId], (err) => {
                if (err) return res.status(500).json({ message: 'Error deleting event', error: err });
                res.status(200).json({ message: 'Event deleted successfully' });
            });
        });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
