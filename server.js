const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'tickets.json');
const FEEDBACK_FILE = path.join(__dirname, 'feedbacks.json');
const STAFF_USERNAME = process.env.STAFF_USERNAME || 'staff';
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'admins2012.';
const JWT_SECRET = process.env.JWT_SECRET || 'ticket-system-secret';

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'client', 'dist')));

async function readTickets() {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(content || '[]');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeTickets(tickets) {
  await fs.writeFile(DATA_FILE, JSON.stringify(tickets, null, 2), 'utf8');
}

async function readFeedbacks() {
  try {
    const content = await fs.readFile(FEEDBACK_FILE, 'utf8');
    return JSON.parse(content || '[]');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeFeedbacks(feedbacks) {
  await fs.writeFile(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2), 'utf8');
}

function findTicket(tickets, id) {
  return tickets.find((ticket) => ticket.id === id);
}

function isValidGmail(email) {
  return typeof email === 'string' && /^[^\s@]+@gmail\.com$/i.test(email);
}

function authenticateStaff(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Staff authorization token is required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.staff = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired staff token.' });
  }
}

function createEvent(type, message, actor) {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    actor: actor || 'system',
    createdAt: new Date().toISOString()
  };
}

app.post('/api/staff/login', async (req, res) => {
  const { username, password, name, surname, lastName, gmail } = req.body;
  if (!username || !password || !name || !surname || !lastName || !gmail) {
    return res.status(400).json({ error: 'Username, password, name, surname, last name, and gmail are required.' });
  }

  if (username !== STAFF_USERNAME || password !== STAFF_PASSWORD) {
    return res.status(401).json({ error: 'Invalid staff username or password.' });
  }

  if (!isValidGmail(gmail)) {
    return res.status(400).json({ error: 'Please provide a valid gmail address for staff.' });
  }

  const staff = { username, name, surname, lastName, gmail };
  const token = jwt.sign(staff, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, staff });
});

app.get('/api/tickets', authenticateStaff, async (req, res) => {
  const { q, status, category, priority, assigned } = req.query;
  const tickets = await readTickets();
  let result = tickets;

  if (q) {
    const query = q.toLowerCase();
    result = result.filter((ticket) =>
      ticket.title.toLowerCase().includes(query) ||
      ticket.description.toLowerCase().includes(query) ||
      ticket.owner.name.toLowerCase().includes(query) ||
      ticket.owner.email.toLowerCase().includes(query)
    );
  }

  if (status) {
    result = result.filter((ticket) => ticket.status === status);
  }

  if (category) {
    result = result.filter((ticket) => ticket.category === category);
  }

  if (priority) {
    result = result.filter((ticket) => ticket.priority === priority);
  }

  if (assigned === 'me') {
    result = result.filter((ticket) => ticket.staff?.gmail === req.staff.gmail);
  }

  res.json(result);
});

app.post('/api/tickets', async (req, res) => {
  const { title, description, requesterName, requesterEmail, category, priority, attachments } = req.body;
  if (!title || !description || !requesterName || !requesterEmail || !category || !priority) {
    return res.status(400).json({ error: 'Title, description, requester name, requester email, category, and priority are required.' });
  }

  const tickets = await readTickets();
  const newTicket = {
    id: Date.now().toString(),
    title,
    description,
    status: 'open',
    category,
    priority,
    createdAt: new Date().toISOString(),
    owner: {
      name: requesterName,
      email: requesterEmail
    },
    staff: null,
    messages: [
      {
        id: `msg-${Date.now()}`,
        role: 'user',
        author: requesterName,
        email: requesterEmail,
        text: description,
        createdAt: new Date().toISOString()
      }
    ],
    events: [createEvent('created', `Ticket created by ${requesterName}`, requesterName)],
    attachments: Array.isArray(attachments) ? attachments : [],
    feedback: null
  };

  tickets.unshift(newTicket);
  await writeTickets(tickets);
  res.status(201).json(newTicket);
});

app.post('/api/tickets/:id/claim', authenticateStaff, async (req, res) => {
  const tickets = await readTickets();
  const ticket = findTicket(tickets, req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  if (ticket.staff) {
    return res.status(400).json({ error: 'Ticket is already claimed by another staff member.' });
  }

  ticket.staff = {
    name: req.staff.name,
    surname: req.staff.surname,
    lastName: req.staff.lastName,
    gmail: req.staff.gmail
  };
  ticket.status = 'in progress';
  ticket.events.push(createEvent('claimed', `Ticket claimed by ${req.staff.name} ${req.staff.surname}`, `${req.staff.name} ${req.staff.surname}`));
  ticket.messages.push({
    id: `msg-${Date.now()}`,
    role: 'system',
    author: `${req.staff.name} ${req.staff.surname}`,
    email: req.staff.gmail,
    text: `Ticket claimed by staff member ${req.staff.name} ${req.staff.surname}.`,
    createdAt: new Date().toISOString()
  });

  await writeTickets(tickets);
  res.json(ticket);
});

app.post('/api/tickets/:id/status', authenticateStaff, async (req, res) => {
  const { status } = req.body;
  if (!status || !['open', 'in progress', 'waiting', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Status must be one of open, in progress, waiting, or resolved.' });
  }

  const tickets = await readTickets();
  const ticket = findTicket(tickets, req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  if (!ticket.staff || ticket.staff.gmail !== req.staff.gmail) {
    return res.status(403).json({ error: 'Only the staff member who claimed this ticket may update its status.' });
  }

  ticket.status = status;
  ticket.events.push(createEvent('status', `Ticket status changed to ${status}`, `${req.staff.name} ${req.staff.surname}`));
  if (status === 'resolved') {
    ticket.resolvedAt = new Date().toISOString();
  }

  await writeTickets(tickets);
  res.json(ticket);
});

app.delete('/api/tickets/:id', authenticateStaff, async (req, res) => {
  const tickets = await readTickets();
  const ticket = findTicket(tickets, req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  if (!ticket.staff || ticket.staff.gmail !== req.staff.gmail) {
    return res.status(403).json({ error: 'Only the staff member who claimed this ticket may delete it.' });
  }

  const updatedTickets = tickets.filter((item) => item.id !== req.params.id);
  await writeTickets(updatedTickets);
  res.json({ success: true });
});

app.post('/api/tickets/:id/messages', async (req, res) => {
  const { role, author, email, text, attachment } = req.body;
  if (!role || !author || !email || !text) {
    return res.status(400).json({ error: 'Role, author, email, and text are required to send a message.' });
  }

  const tickets = await readTickets();
  const ticket = findTicket(tickets, req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  if (role === 'user') {
    if (ticket.owner.email !== email) {
      return res.status(403).json({ error: 'Only the ticket creator may send user messages in this ticket.' });
    }
  } else if (role === 'staff') {
    let staffPayload;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Staff authorization token is required.' });
    }
    const token = authHeader.split(' ')[1];
    try {
      staffPayload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired staff token.' });
    }
    if (!ticket.staff || ticket.staff.gmail !== staffPayload.gmail) {
      return res.status(403).json({ error: 'Only the staff member who claimed this ticket may send staff messages.' });
    }
    if (staffPayload.gmail !== email) {
      return res.status(403).json({ error: 'Staff email must match the logged-in staff account.' });
    }
  } else {
    return res.status(400).json({ error: 'Invalid role. Use "user" or "staff".' });
  }

  const message = {
    id: `msg-${Date.now()}`,
    role,
    author,
    email,
    text,
    attachment: attachment || null,
    createdAt: new Date().toISOString()
  };

  ticket.messages.push(message);
  ticket.events.push(createEvent('message', `${author} sent a message`, author));
  await writeTickets(tickets);
  res.status(201).json(message);
});

app.post('/api/tickets/:id/feedback', async (req, res) => {
  const { ticketId, rating, comment, staff, userEmail } = req.body || {};
  if (!ticketId || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'ticketId and rating (1-5) are required.' });
  }

  const tickets = await readTickets();
  const ticket = findTicket(tickets, ticketId);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  if (ticket.status !== 'resolved') {
    return res.status(400).json({ error: 'Feedback can only be submitted after the ticket is resolved.' });
  }

  if (ticket.feedback) {
    return res.status(400).json({ error: 'Feedback already submitted for this ticket.' });
  }

  ticket.feedback = {
    rating,
    comment: comment || '',
    submittedAt: new Date().toISOString(),
    userEmail: userEmail || ticket.owner.email,
    staff: staff || null
  };
  ticket.events.push(createEvent('feedback', `Feedback submitted: ${rating} stars`, ticket.owner.name));
  await writeTickets(tickets);

  const feedbacks = await readFeedbacks();
  feedbacks.unshift({ id: Date.now().toString(), ticketId, rating, comment: comment || '', staff: staff || null, createdAt: new Date().toISOString() });
  await writeFeedbacks(feedbacks);

  res.status(201).json({ success: true, feedback: ticket.feedback });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Ticket system backend running on http://localhost:${PORT}`);
});
