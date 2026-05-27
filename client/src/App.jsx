import { useEffect, useState } from 'react';

function App() {
  const FEEDBACK_LINK = 'https://ticketcreating.com';
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({
    requesterName: '',
    requesterEmail: '',
    title: '',
    description: ''
  });
  const [currentTicket, setCurrentTicket] = useState(null);
  const [staffLogin, setStaffLogin] = useState({ name: '', surname: '', lastName: '', gmail: '', password: '' });
  const [staffSession, setStaffSession] = useState({ name: '', surname: '', lastName: '', gmail: '' });
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

  useEffect(() => {
    if (!isStaff || !staffSession.gmail) {
      setTickets([]);
      return;
    }

    setError('');
    fetch(`/api/tickets?staffEmail=${encodeURIComponent(staffSession.gmail)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || 'Unable to load tickets.');
        }
        return res.json();
      })
      .then(setTickets)
      .catch((err) => setError(`Unable to load tickets: ${err.message || err}`));
  }, [isStaff, staffSession.gmail]);

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
      setForm({ requesterName: '', requesterEmail: '', title: '', description: '' });
    } catch (err) {
      setError(err.message || 'Unable to create ticket.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStaffSignIn(event) {
    event.preventDefault();
    setError('');

    if (!staffLogin.name.trim() || !staffLogin.surname.trim() || !staffLogin.lastName.trim() || !staffLogin.gmail.trim() || !staffLogin.password) {
      setError('Please fill in all staff fields and password.');
      return;
    }

    // Simple client-side password check
    if (staffLogin.password !== 'admins2012.') {
      setError('Incorrect staff password.');
      return;
    }

    setStaffSession({ name: staffLogin.name, surname: staffLogin.surname, lastName: staffLogin.lastName, gmail: staffLogin.gmail });
    setIsStaff(true);
  }

  function handleStaffSignOut() {
    setIsStaff(false);
    setStaffSession({ name: '', surname: '', lastName: '', gmail: '' });
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
        headers: { 'Content-Type': 'application/json' },
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
      // send feedback first
      const fbResp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: feedbackModalTicketId, rating: feedbackRating, comment: feedbackComment, staff: staffSession })
      });

      if (!fbResp.ok) {
        const txt = await fbResp.text();
        // If server returned HTML (e.g., an error page), include helpful hint
        if (txt && txt.trim().startsWith('<')) {
          throw new Error('Server returned HTML — check that the backend is running and /api/feedback is available.');
        }
        try {
          const body = txt ? JSON.parse(txt) : {};
          throw new Error(body.error || 'Failed to submit feedback');
        } catch (_e) {
          throw new Error(txt || 'Failed to submit feedback');
        }
      }

      // then delete the ticket (include headers for compatibility)
      const delResp = await fetch(`/api/tickets/${feedbackModalTicketId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Staff-Name': staffSession.name,
          'X-Staff-Surname': staffSession.surname,
          'X-Staff-LastName': staffSession.lastName,
          'X-Staff-Gmail': staffSession.gmail
        },
        body: JSON.stringify(staffSession)
      });

      if (!delResp.ok) {
        const txt = await delResp.text();
        if (txt && txt.trim().startsWith('<')) {
          throw new Error('Server returned HTML on delete — check that the backend is running.');
        }
        try {
          const body = txt ? JSON.parse(txt) : {};
          throw new Error(body.error || 'Failed to delete ticket');
        } catch (_e) {
          throw new Error(txt || 'Failed to delete ticket');
        }
      }

      setTickets((prev) => prev.filter((ticket) => ticket.id !== feedbackModalTicketId));
      if (currentTicket?.id === feedbackModalTicketId) {
        setCurrentTicket(null);
      }
      setFeedbackSubmitted(true);
      setFeedbackSuccessMessage('Thanks — your feedback has been recorded.');
      // keep modal open to show success and link; clear ticket id so Submit cannot be re-triggered
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
        headers: { 'Content-Type': 'application/json' },
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
              Staff name
              <input
                type="text"
                value={staffLogin.name}
                onChange={(e) => updateStaffLogin('name', e.target.value)}
                placeholder="Name"
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
            <label>
              Staff password
              <input
                type="password"
                value={staffLogin.password}
                onChange={(e) => updateStaffLogin('password', e.target.value)}
                placeholder="Password"
              />
            </label>
            <button type="submit">Enter Staff View</button>
          </form>
        )}
      </div>

      {isStaff ? (
        <div className="card">
          <h2>Tickets</h2>
          {tickets.length === 0 ? (
            <p>No tickets yet. Create the first one.</p>
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
                      <span className={`ticket-status ticket-status-${ticket.status}`}>
                        {ticket.status}
                      </span>
                    </div>

                    <p>{ticket.description}</p>
                    <div className="ticket-meta">
                      <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                      {ticket.staff ? (
                        <span>Claimed by {ticket.staff.name} {ticket.staff.surname} {ticket.staff.lastName}</span>
                      ) : (
                        <span>Not claimed yet</span>
                      )}
                    </div>

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
