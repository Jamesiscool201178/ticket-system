const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'tickets.json');
const FEEDBACK_FILE = path.join(__dirname, 'feedbacks.json');

app.use(cors());
app.use(bodyParser.json());
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

function findTicket(tickets, id) {
  return tickets.find((ticket) => ticket.id === id);
}

function isValidGmail(email) {
  return typeof email === 'string' && /^[^\s@]+@gmail\.com$/i.test(email);
}

app.get('/api/tickets', async (req, res) => {
  const { staffEmail } = req.query;
  if (!staffEmail) {
    return res.status(403).json({ error: 'Staff email is required to view tickets.' });
  }

  const tickets = await readTickets();
  res.json(tickets);
});

app.post('/api/tickets', async (req, res) => {
  const { title, description, requesterName, requesterEmail } = req.body;
  if (!title || !description || !requesterName || !requesterEmail) {
    return res.status(400).json({ error: 'Title, description, requester name, and requester email are required.' });
  }

  const tickets = await readTickets();
  const newTicket = {
    id: Date.now().toString(),
    title,
    description,
    status: 'open',
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
    ]
  };

  tickets.unshift(newTicket);
  await writeTickets(tickets);
  res.status(201).json(newTicket);
});

app.post('/api/tickets/:id/claim', async (req, res) => {
  const { name, surname, lastName, gmail } = req.body;
  if (!name || !surname || !lastName || !gmail) {
    return res.status(400).json({ error: 'Name, surname, last name, and gmail are required to claim a ticket.' });
  }

  if (!isValidGmail(gmail)) {
    return res.status(400).json({ error: 'Please provide a valid gmail address for staff.' });
  }

  const tickets = await readTickets();
  const ticket = findTicket(tickets, req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  if (ticket.staff) {
    return res.status(400).json({ error: 'Ticket is already claimed by another staff member.' });
  }

  ticket.staff = {
    name,
    surname,
    lastName,
    gmail
  };
  ticket.status = 'claimed';
  ticket.messages.push({
    id: `msg-${Date.now()}`,
    role: 'system',
    author: `${name} ${surname} ${lastName}`,
    email: gmail,
    text: `Ticket claimed by staff member ${name} ${surname} ${lastName}.`,
    createdAt: new Date().toISOString()
  });

  await writeTickets(tickets);
  res.json(ticket);
});

app.delete('/api/tickets/:id', async (req, res) => {
  // Accept staff identity from JSON body or fallback to headers (some clients/agents omit bodies on DELETE)
  const body = req.body || {};
  const name = body.name || req.headers['x-staff-name'];
  const surname = body.surname || req.headers['x-staff-surname'];
  const lastName = body.lastName || req.headers['x-staff-lastname'];
  const gmail = body.gmail || req.headers['x-staff-gmail'];

  if (!name || !surname || !lastName || !gmail) {
    return res.status(400).json({ error: 'Staff name, surname, last name, and gmail are required to delete a ticket.' });
  }

  if (!isValidGmail(gmail)) {
    return res.status(400).json({ error: 'Please provide a valid gmail address for staff.' });
  }

  const tickets = await readTickets();
  const ticket = findTicket(tickets, req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  if (!ticket.staff || ticket.staff.gmail !== gmail) {
    return res.status(403).json({ error: 'Only the staff member who claimed this ticket may delete it.' });
  }

  const updatedTickets = tickets.filter((item) => item.id !== req.params.id);
  await writeTickets(updatedTickets);
  res.json({ success: true });
});

app.post('/api/feedback', async (req, res) => {
  const { ticketId, rating, comment, staff } = req.body || {};

  if (!ticketId || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'ticketId and rating (1-5) are required.' });
  }

  let feedbacks = [];
  try {
    const content = await fs.readFile(FEEDBACK_FILE, 'utf8');
    feedbacks = JSON.parse(content || '[]');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      return res.status(500).json({ error: 'Unable to read feedback store.' });
    }
  }

  const newFeedback = {
    id: Date.now().toString(),
    ticketId,
    rating,
    comment: comment || '',
    staff: staff || null,
    createdAt: new Date().toISOString()
  };

  feedbacks.unshift(newFeedback);

  try {
    await fs.writeFile(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2), 'utf8');
  } catch (err) {
    return res.status(500).json({ error: 'Unable to save feedback.' });
  }

  res.status(201).json({ success: true });
});

app.post('/api/tickets/:id/messages', async (req, res) => {
  const { role, author, email, text } = req.body;
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
    if (!ticket.staff) {
      return res.status(400).json({ error: 'Ticket must be claimed before staff can send messages.' });
    }
    if (ticket.staff.gmail !== email) {
      return res.status(403).json({ error: 'Only the staff member who claimed this ticket may send messages.' });
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
    createdAt: new Date().toISOString()
  };

  ticket.messages.push(message);
  await writeTickets(tickets);
  res.status(201).json(message);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Ticket system backend running on http://localhost:${PORT}`);
});
