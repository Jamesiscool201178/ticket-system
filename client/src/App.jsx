import { useEffect, useState } from 'react';

function App() {
  const FEEDBACK_LINK = 'https://ticketcreating.com';
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({
    requesterName: '',
    requesterEmail: '',
    title: '',
    description: '',
    category: 'General',
    priority: 'Normal',
    attachments: []
  });
  const [attachmentName, setAttachmentName] = useState('');
  const [currentTicket, setCurrentTicket] = useState(null);
  const [staffLogin, setStaffLogin] = useState({ username: 'staff', password: '', name: '', surname: '', lastName: '', gmail: '' });
  const [staffSession, setStaffSession] = useState({ name: '', surname: '', lastName: '', gmail: '' });
  const [staffToken, setStaffToken] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  const [claimForms, setClaimForms] = useState({});
  const [messageForms, setMessageForms] = useState({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackModalTicketId, setFeedbackModalTicketId] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSuccessMessage, setFeedbackSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('all');

  useEffect(() => {
    if (!isStaff || !staffToken) {
      setTickets([]);
      return;
    }

    setError('');
    const params = new URLSearchParams();
    if (searchQuery) params.append('q', searchQuery);
    if (statusFilter) params.append('status', statusFilter);
    if (categoryFilter) params.append('category', categoryFilter);
    if (priorityFilter) params.append('priority', priorityFilter);
    if (assignedFilter === 'me') params.append('assigned', 'me');

    fetch(`/api/tickets?${params.toString()}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || 'Unable to load tickets.');
        }
        return res.json();
      })
      .then(setTickets)
      .catch((err) => setError(`Unable to load tickets: ${err.message || err}`));
  }, [isStaff, staffToken, searchQuery, statusFilter, categoryFilter, priorityFilter, assignedFilter]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateStaffLogin = (key, value) => {
    setStaffLogin((prev) => ({ ...prev, [key]: value }));
  };

  const updateClaimForm = (ticketId, key, value) => {
    setClaimForms((prev) => ({
      ...prev,
      [ticketId]: {
        ...(prev[ticketId] || {}),
        [key]: value
      }
    }));
  };

  const updateMessageForm = (ticketId, key, value) => {
    setMessageForms((prev) => ({
      ...prev,
      [ticketId]: {
        ...(prev[ticketId] || {
          role: 'user',
          author: '',
          email: '',
          text: ''
        }),
        [key]: value
      }
    }));
  };

  const updateTicket = (updatedTicket) => {
    setTickets((prev) => prev.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket)));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!form.requesterName.trim() || !form.requesterEmail.trim() || !form.title.trim() || !form.description.trim()) {
      setError('Please fill in your name, email, title, and description.');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to create ticket');
      }

      const ticket = await response.json();
      setCurrentTicket(ticket);
      if (isStaff) {
        setTickets((prev) => [ticket, ...prev]);
      }
      setForm({ requesterName: '', requesterEmail: '', title: '', description: '', category: 'General', priority: 'Normal', attachments: [] });
      setAttachmentName('');
    } catch (err) {
      setError(err.message || 'Unable to create ticket.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStaffSignIn(event) {
    event.preventDefault();
    setError('');

    if (!staffLogin.username.trim() || !staffLogin.password.trim() || !staffLogin.name.trim() || !staffLogin.surname.trim() || !staffLogin.lastName.trim() || !staffLogin.gmail.trim()) {
      setError('Please fill in all staff fields and password.');
      return;
    }

    try {
      const response = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffLogin)
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Staff login failed.');
      }

      const data = await response.json();
      setStaffSession(data.staff);
      setStaffToken(data.token);
      setIsStaff(true);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to login as staff.');
    }
  }

  function handleStaffSignOut() {
    setIsStaff(false);
    setStaffSession({ name: '', surname: '', lastName: '', gmail: '' });
    setStaffToken('');
    setTickets([]);
    setClaimForms({});
    setMessageForms({});
  }

  async function handleClaim(ticketId) {
    setError('');
    const claim = { ...staffSession, ...(claimForms[ticketId] || {}) };

    if (!claim.name?.trim() || !claim.surname?.trim() || !claim.lastName?.trim() || !claim.gmail?.trim()) {
      setError('Please fill in name, surname, last name, and gmail to claim the ticket.');
      return;
    }

    try {
      const response = await fetch(`/api/tickets/${ticketId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify(claim)
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to claim ticket');
      }

      const updatedTicket = await response.json();
      updateTicket(updatedTicket);
      setClaimForms((prev) => ({ ...prev, [ticketId]: {} }));
    } catch (err) {
      setError(err.message || 'Unable to claim ticket.');
    }
  }

  async function handleStatusChange(ticketId, status) {
    if (!staffToken) {
      setError('Please sign in as staff to update ticket status.');
      return;
    }

    try {
      const response = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to update status');
      }

      const updatedTicket = await response.json();
      updateTicket(updatedTicket);
    } catch (err) {
      setError(err.message || 'Unable to update ticket status.');
    }
  }

  // Open feedback modal before deleting
  function handleDelete(ticketId) {
    setFeedbackError('');
    setFeedbackComment('');
    setFeedbackRating(5);
    setFeedbackModalTicketId(ticketId);
  }

  function handleFeedbackCancel() {
    setFeedbackModalTicketId(null);
    setFeedbackError('');
  }

  function handleSetRating(r) {
    setFeedbackRating(r);
  }

  async function submitFeedbackAndDelete() {
    if (!feedbackModalTicketId) return;
    setFeedbackError('');
    if (!feedbackRating || feedbackRating < 1 || feedbackRating > 5) {
      setFeedbackError('Please select a rating between 1 and 5.');
      return;
    }

    setIsSubmittingFeedback(true);

    try {
      const fbResp = await fetch(`/api/tickets/${feedbackModalTicketId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: feedbackModalTicketId, rating: feedbackRating, comment: feedbackComment, staff: `${staffSession.name} ${staffSession.surname}` })
      });

      if (!fbResp.ok) {
        const body = await fbResp.json();
        throw new Error(body.error || 'Failed to submit feedback');
      }

      const delResp = await fetch(`/api/tickets/${feedbackModalTicketId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${staffToken}` }
      });

      if (!delResp.ok) {
        const body = await delResp.json();
        throw new Error(body.error || 'Failed to delete ticket');
      }

      setTickets((prev) => prev.filter((ticket) => ticket.id !== feedbackModalTicketId));
      if (currentTicket?.id === feedbackModalTicketId) {
        setCurrentTicket(null);
      }
      setFeedbackSubmitted(true);
      setFeedbackSuccessMessage('Thanks — your feedback has been recorded.');
      setFeedbackModalTicketId(null);
    } catch (err) {
      setFeedbackError(err.message || 'Unable to submit feedback or delete ticket.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  async function handleSendMessage(ticketId) {
    setError('');
    const ticketMessage = messageForms[ticketId] || {};
    const message = { ...ticketMessage };

    if (message.role === 'staff' && isStaff) {
      message.author = message.author || `${staffSession.name} ${staffSession.surname} ${staffSession.lastName}`;
      message.email = message.email || staffSession.gmail;
    }

    if (!message.role || !message.author?.trim() || !message.email?.trim() || !message.text?.trim()) {
      setError('Please fill in your role, name/email, and message.');
      return;
    }

    try {
      const response = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(message.role === 'staff' ? { Authorization: `Bearer ${staffToken}` } : {})
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to send message');
      }

      const newMessage = await response.json();
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, messages: [...ticket.messages, newMessage] }
            : ticket
        )
      );
      if (currentTicket?.id === ticketId) {
        setCurrentTicket((prev) => ({ ...prev, messages: [...prev.messages, newMessage] }));
      }
      setMessageForms((prev) => ({ ...prev, [ticketId]: { ...message, text: '' } }));
    } catch (err) {
      setError(err.message || 'Unable to send message.');
    }
  }

  const handleAttachment = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      setForm((prev) => ({
        ...prev,
        attachments: [{ name: file.name, content }]
      }));
      setAttachmentName(file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="page-shell">
      <div className="card">
        <h1>Website Ticket System</h1>
        <p>Create a ticket, then staff can claim it and continue the conversation.</p>

        <form onSubmit={handleSubmit} className="ticket-form">
          <label>
            Your full name
            <input
              type="text"
              value={form.requesterName}
              onChange={(e) => updateForm('requesterName', e.target.value)}
              placeholder="Name"
            />
          </label>

          <label>
            Your email
            <input
              type="email"
              value={form.requesterEmail}
              onChange={(e) => updateForm('requesterEmail', e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Ticket title
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
              placeholder="Short summary"
            />
          </label>

          <label>
            Ticket category
            <select value={form.category} onChange={(e) => updateForm('category', e.target.value)}>
              <option value="General">General</option>
              <option value="Bug">Bug</option>
              <option value="Feature Request">Feature Request</option>
              <option value="Support">Support</option>
            </select>
          </label>

          <label>
            Ticket priority
            <select value={form.priority} onChange={(e) => updateForm('priority', e.target.value)}>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </label>

          <label>
            Attach a file (optional)
            <input type="file" onChange={handleAttachment} />
            {attachmentName && <small>Attached: {attachmentName}</small>}
          </label>

          <label>
            Ticket description
            <textarea
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder="Describe the issue or request"
            />
          </label>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Create Ticket'}
          </button>
        </form>
      </div>

      <div className="card staff-panel">
        <h2>Staff access</h2>
        {isStaff ? (
          <div className="staff-status">
            <div>
              Signed in as {staffSession.name} {staffSession.surname} {staffSession.lastName} ({staffSession.gmail})
            </div>
            <button type="button" onClick={handleStaffSignOut}>
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={handleStaffSignIn} className="ticket-form staff-signin">
            <label>
              Staff username
              <input
                type="text"
                value={staffLogin.username}
                onChange={(e) => updateStaffLogin('username', e.target.value)}
                placeholder="staff"
              />
            </label>
            <label>
              Staff password
              <input
                type="password"
                value={staffLogin.password}
                onChange={(e) => updateStaffLogin('password', e.target.value)}
                placeholder="Password"
              />
            </label>
            <label>
              Staff first name
              <input
                type="text"
                value={staffLogin.name}
                onChange={(e) => updateStaffLogin('name', e.target.value)}
                placeholder="First name"
              />
            </label>
            <label>
              Staff surname
              <input
                type="text"
                value={staffLogin.surname}
                onChange={(e) => updateStaffLogin('surname', e.target.value)}
                placeholder="Surname"
              />
            </label>
            <label>
              Staff last name
              <input
                type="text"
                value={staffLogin.lastName}
                onChange={(e) => updateStaffLogin('lastName', e.target.value)}
                placeholder="Last name"
              />
            </label>
            <label>
              Staff gmail
              <input
                type="email"
                value={staffLogin.gmail}
                onChange={(e) => updateStaffLogin('gmail', e.target.value)}
                placeholder="staff@gmail.com"
              />
            </label>
            <button type="submit">Enter Staff View</button>
          </form>
        )}
      </div>

      {isStaff ? (
        <div className="card">
          <h2>Tickets</h2>
          <div className="filter-row">
            <label>
              Search
              <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tickets" />
            </label>
            <label>
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="in progress">In Progress</option>
                <option value="waiting">Waiting</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <label>
              Category
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All</option>
                <option value="General">General</option>
                <option value="Bug">Bug</option>
                <option value="Feature Request">Feature Request</option>
                <option value="Support">Support</option>
              </select>
            </label>
            <label>
              Priority
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                <option value="">All</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </label>
            <label>
              Assigned
              <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="me">Assigned to me</option>
              </select>
            </label>
          </div>
          {tickets.length === 0 ? (
            <p>No tickets match your filters.</p>
          ) : (
            <div className="ticket-list">
              {tickets.map((ticket) => {
                const claim = claimForms[ticket.id] || {};
                const staffClaim = {
                  name: claim.name || staffSession.name,
                  surname: claim.surname || staffSession.surname,
                  lastName: claim.lastName || staffSession.lastName,
                  gmail: claim.gmail || staffSession.gmail
                };
                return (
                  <article key={ticket.id} className="ticket-card">
                    <div className="ticket-card-header">
                      <div>
                        <h3>{ticket.title}</h3>
                        <p className="ticket-owner">Created by {ticket.owner.name} ({ticket.owner.email})</p>
                      </div>
                      <div className="ticket-status-group">
                        <span className={`ticket-status ticket-status-${ticket.status.replace(/\s+/g, '-')}`}>
                          {ticket.status}
                        </span>
                        <span className="ticket-chip">{ticket.category || 'General'}</span>
                        <span className="ticket-chip ticket-chip-priority">{ticket.priority || 'Normal'}</span>
                      </div>
                    </div>

                    <p>{ticket.description}</p>
                    <div className="ticket-meta ticket-meta-grid">
                      <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                      <span>{ticket.staff ? `Claimed by ${ticket.staff.name} ${ticket.staff.surname}` : 'Not claimed yet'}</span>
                    </div>
                    {ticket.attachments?.length ? (
                      <div className="ticket-attachments">
                        <strong>Attachments:</strong>
                        <ul>
                          {ticket.attachments.map((attachment) => (
                            <li key={attachment.name}>{attachment.name}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {ticket.events?.length ? (
                      <div className="ticket-events">
                        <strong>History:</strong>
                        <ul>
                          {ticket.events.map((event) => (
                            <li key={event.id}>
                              <strong>{event.type}</strong> — {event.message} <span>{new Date(event.createdAt).toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {ticket.staff ? (
                      <div className="ticket-claimed">
                        <strong>Staff:</strong> {ticket.staff.name} {ticket.staff.surname} {ticket.staff.lastName} ({ticket.staff.gmail})
                      </div>
                    ) : (
                      <div className="ticket-form ticket-claim-form">
                        <h4>Claim this ticket</h4>
                        <label>
                          Staff name
                          <input
                            type="text"
                            value={staffClaim.name}
                            onChange={(e) => updateClaimForm(ticket.id, 'name', e.target.value)}
                            placeholder="Name"
                          />
                        </label>
                        <label>
                          Staff surname
                          <input
                            type="text"
                            value={staffClaim.surname}
                            onChange={(e) => updateClaimForm(ticket.id, 'surname', e.target.value)}
                            placeholder="Surname"
                          />
                        </label>
                        <label>
                          Staff last name
                          <input
                            type="text"
                            value={staffClaim.lastName}
                            onChange={(e) => updateClaimForm(ticket.id, 'lastName', e.target.value)}
                            placeholder="Last name"
                          />
                        </label>
                        <label>
                          Staff gmail
                          <input
                            type="email"
                            value={staffClaim.gmail}
                            onChange={(e) => updateClaimForm(ticket.id, 'gmail', e.target.value)}
                            placeholder="staff@gmail.com"
                          />
                        </label>
                        <button type="button" onClick={() => handleClaim(ticket.id)}>
                          Claim Ticket
                        </button>
                      </div>
                    )}

                    <div className="ticket-chat">
                      <h4>Conversation</h4>
                      {ticket.messages.map((message) => (
                        <div key={message.id} className="ticket-message">
                          <div className="message-author">
                            {message.role === 'system' ? 'System' : `${message.author} (${message.role})`}
                          </div>
                          <div className="message-text">{message.text}</div>
                          <div className="ticket-meta">
                            <span>{new Date(message.createdAt).toLocaleString()}</span>
                            {message.role !== 'system' && <span>{message.email}</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="ticket-form ticket-message-form">
                      <h4>Send a message</h4>
                      <label>
                        Your role
                        <select
                          value={(messageForms[ticket.id]?.role || 'staff')}
                          onChange={(e) => updateMessageForm(ticket.id, 'role', e.target.value)}
                        >
                          <option value="user">Requester</option>
                          <option value="staff">Staff</option>
                        </select>
                      </label>
                      <label>
                        Your name
                        <input
                          type="text"
                          value={(messageForms[ticket.id]?.author || (messageForms[ticket.id]?.role === 'staff' ? `${staffSession.name} ${staffSession.surname} ${staffSession.lastName}` : ''))}
                          onChange={(e) => updateMessageForm(ticket.id, 'author', e.target.value)}
                          placeholder="Your name"
                        />
                      </label>
                      <label>
                        Your email
                        <input
                          type="email"
                          value={(messageForms[ticket.id]?.email || (messageForms[ticket.id]?.role === 'staff' ? staffSession.gmail : ''))}
                          onChange={(e) => updateMessageForm(ticket.id, 'email', e.target.value)}
                          placeholder="Your email"
                        />
                      </label>
                      <label>
                        Message
                        <textarea
                          value={(messageForms[ticket.id]?.text || '')}
                          onChange={(e) => updateMessageForm(ticket.id, 'text', e.target.value)}
                          placeholder="Write your reply here"
                        />
                      </label>
                      <div className="ticket-actions">
                        <button type="button" onClick={() => handleSendMessage(ticket.id)}>
                          Send Message
                        </button>
                        {ticket.staff?.gmail === staffSession.gmail && (
                          <button type="button" className="delete-button" onClick={() => handleDelete(ticket.id)}>
                            Delete Ticket
                          </button>
                        )}
                        {ticket.staff?.gmail === staffSession.gmail && (
                          <select value={ticket.status} onChange={(e) => handleStatusChange(ticket.id, e.target.value)}>
                            <option value="in progress">In Progress</option>
                            <option value="waiting">Waiting</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : currentTicket ? (
        <div className="card">
          <h2>Your ticket</h2>
          <article className="ticket-card">
            <div className="ticket-card-header">
              <div>
                <h3>{currentTicket.title}</h3>
                <p className="ticket-owner">Created by {currentTicket.owner.name} ({currentTicket.owner.email})</p>
              </div>
              <span className={`ticket-status ticket-status-${currentTicket.status}`}>
                {currentTicket.status}
              </span>
            </div>

            <p>{currentTicket.description}</p>
            <div className="ticket-meta">
              <span>{new Date(currentTicket.createdAt).toLocaleString()}</span>
              {currentTicket.staff ? (
                <span>Claimed by {currentTicket.staff.name} {currentTicket.staff.surname} {currentTicket.staff.lastName}</span>
              ) : (
                <span>Waiting for staff to claim</span>
              )}
            </div>

            <div className="ticket-chat">
              <h4>Conversation</h4>
              {currentTicket.messages.map((message) => (
                <div key={message.id} className="ticket-message">
                  <div className="message-author">
                    {message.role === 'system' ? 'System' : `${message.author} (${message.role})`}
                  </div>
                  <div className="message-text">{message.text}</div>
                  <div className="ticket-meta">
                    <span>{new Date(message.createdAt).toLocaleString()}</span>
                    {message.role !== 'system' && <span>{message.email}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="ticket-form ticket-message-form">
              <h4>Send a message</h4>
              <label>
                Your message
                <textarea
                  value={(messageForms[currentTicket.id]?.text || '')}
                  onChange={(e) => updateMessageForm(currentTicket.id, 'text', e.target.value)}
                  placeholder="Write your reply here"
                />
              </label>
              <div className="ticket-actions">
                <button
                  type="button"
                  onClick={() => {
                    updateMessageForm(currentTicket.id, 'role', 'user');
                    updateMessageForm(currentTicket.id, 'author', currentTicket.owner.name);
                    updateMessageForm(currentTicket.id, 'email', currentTicket.owner.email);
                    handleSendMessage(currentTicket.id);
                  }}
                >
                  Send Reply
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : (
        <div className="card">
          <h2>Ticket access</h2>
          <p>Only signed-in staff can view the full ticket list. Create a ticket, and staff will handle it from there.</p>
        </div>
      )}
      {feedbackModalTicketId !== null || feedbackSubmitted ? (
        <div className="feedback-modal-overlay">
          <div className="feedback-modal">
            {!feedbackSubmitted ? (
              <>
                <h3>How was your ticket?</h3>
                <p className="muted">Rate your experience — 1 (poor) to 5 (excellent)</p>
                <div className="stars" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      title={`${n} star${n > 1 ? 's' : ''}`}
                      className={`star ${feedbackRating >= n ? 'active' : ''}`}
                      onMouseEnter={() => setFeedbackRating(n)}
                      onClick={() => handleSetRating(n)}
                    >
                      {feedbackRating >= n ? '★' : '☆'}
                    </button>
                  ))}
                </div>
                <div className="rating-emoji">{feedbackRating >= 4 ? '😊' : feedbackRating === 3 ? '😐' : '😕'}</div>
                <label>
                  Comments
                  <textarea value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} placeholder="Optional comment" />
                </label>
                {feedbackError && <div className="error">{feedbackError}</div>}
                <div className="modal-actions">
                  <button type="button" onClick={submitFeedbackAndDelete} disabled={isSubmittingFeedback} className="primary">
                    {isSubmittingFeedback ? 'Submitting...' : 'Submit & Close Ticket'}
                  </button>
                  <button type="button" onClick={handleFeedbackCancel} className="cancel">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Thanks for your feedback</h3>
                <p className="muted">{feedbackSuccessMessage}</p>
                <div className="modal-actions">
                  <a className="feedback-link" href={FEEDBACK_LINK} target="_blank" rel="noreferrer">Visit support website</a>
                  <button type="button" onClick={() => { setFeedbackSubmitted(false); setFeedbackSuccessMessage(''); setFeedbackComment(''); setFeedbackRating(5); }} className="primary">
                    Close
                  </button>
                </div>
                <p className="muted" style={{ marginTop: '10px' }}>
                  If the site doesn't open, try again later or use your normal support channel.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
