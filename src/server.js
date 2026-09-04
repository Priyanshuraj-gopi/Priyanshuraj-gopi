const path = require('path');
const express = require('express');
const { classifyFeedbackText } = require('./feedback');
const { requireCustomer, requireEmployee, hasEmployeeAccess } = require('./security');
const { createStore } = require('./store');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const EMPLOYEE_API_TOKEN = process.env.EMPLOYEE_API_TOKEN || 'itc-employee-secure-token';
const store = createStore({ encryptionSecret: process.env.TRANSCRIPT_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const requireEmployeeMiddleware = requireEmployee(EMPLOYEE_API_TOKEN);

function inferDepartment(category) {
  switch (category) {
    case 'room':
    case 'hygiene':
      return 'housekeeping';
    case 'food':
      return 'kitchen';
    case 'billing':
      return 'finance';
    case 'staff behavior':
    case 'service':
      return 'guest-relations';
    case 'amenities':
      return 'hospitality';
    default:
      return 'general';
  }
}

app.post('/api/customer/stays', requireCustomer, (req, res) => {
  const { customerName, hotelId, roomNumber } = req.body;
  if (!customerName || !hotelId || !roomNumber) {
    return res.status(400).json({ error: 'customerName, hotelId and roomNumber are required' });
  }

  const stay = store.createStay({ customerName, hotelId, roomNumber });
  store.recordAudit('stay.created', 'customer', { stayId: stay.id });
  return res.status(201).json(stay);
});

app.post('/api/customer/checkout/start', requireCustomer, (req, res) => {
  const { stayId, preferredLanguage, consentForVoice } = req.body;
  if (!stayId || !preferredLanguage) {
    return res.status(400).json({ error: 'stayId and preferredLanguage are required' });
  }

  const session = store.createCheckoutSession({ stayId, preferredLanguage, consentForVoice });
  store.recordAudit('checkout.started', 'customer', {
    sessionId: session.id,
    consentForVoice: session.consentForVoice,
  });

  return res.status(201).json(session);
});

app.post('/api/customer/checkout/:sessionId/message', requireCustomer, (req, res) => {
  const { sessionId } = req.params;
  const { text, mode = 'text' } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const session = store.getCheckoutSession(sessionId);
  if (!session || session.status !== 'active') {
    return res.status(404).json({ error: 'Active checkout session not found' });
  }

  if (mode === 'voice' && !session.consentForVoice) {
    return res.status(400).json({ error: 'Voice input not allowed without consent' });
  }

  store.addTranscriptMessage({ sessionId, speaker: 'customer', mode, text });

  const feedbackCandidates = classifyFeedbackText(text);
  const stay = store.customerStays.find((item) => item.id === session.stayId);

  const createdFeedback = feedbackCandidates.map((candidate) =>
    store.addFeedback({
      sessionId,
      stayId: session.stayId,
      hotelId: stay?.hotelId || 'unknown',
      language: session.preferredLanguage,
      department: inferDepartment(candidate.category),
      ...candidate,
    }),
  );

  store.recordAudit('checkout.feedback_ingested', 'customer', {
    sessionId,
    count: createdFeedback.length,
    mode,
  });

  return res.status(201).json({
    sessionId,
    createdFeedback,
    voiceFallbackAvailable: true,
  });
});

app.post('/api/customer/checkout/:sessionId/finish', requireCustomer, (req, res) => {
  const finished = store.finishCheckoutSession(req.params.sessionId);
  if (!finished) {
    return res.status(404).json({ error: 'Checkout session not found' });
  }
  store.recordAudit('checkout.finished', 'customer', { sessionId: finished.id });
  return res.json(finished);
});

app.get('/api/customer/checkout/:sessionId/transcript', requireCustomer, (req, res) => {
  const session = store.getCheckoutSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Checkout session not found' });
  }
  return res.json({
    sessionId: session.id,
    transcript: store.getDecryptedTranscript(session),
  });
});

app.get('/api/employee/feedback/summary', requireEmployeeMiddleware, (req, res) => {
  const summary = store.getFeedbackSummary({
    hotelId: req.query.hotelId,
    from: req.query.from,
    to: req.query.to,
    department: req.query.department,
    language: req.query.language,
  });

  store.recordAudit('feedback.summary_viewed', 'employee', {
    filters: req.query,
  });

  return res.json(summary);
});

app.get('/api/employee/feedback/items', requireEmployeeMiddleware, (req, res) => {
  const items = store.listFeedback({
    hotelId: req.query.hotelId,
    department: req.query.department,
    language: req.query.language,
  });

  store.recordAudit('feedback.items_viewed', 'employee', { filters: req.query });
  return res.json(items);
});

app.get('/api/employee/inventory/items', requireEmployeeMiddleware, (req, res) => {
  const items = store.listInventory({
    hotelId: req.query.hotelId,
    department: req.query.department,
  });
  return res.json(items);
});

app.post('/api/employee/inventory/transactions', requireEmployeeMiddleware, (req, res) => {
  const { itemId, type, quantity, note, requestedBy } = req.body;

  if (!itemId || !type || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'itemId, type and positive quantity are required' });
  }

  if (!['restock', 'consume'].includes(type)) {
    return res.status(400).json({ error: 'type must be restock or consume' });
  }

  const transaction = store.applyStockTransaction({
    itemId,
    type,
    quantity: Number(quantity),
    note: note || '',
    requestedBy: requestedBy || 'employee',
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Inventory item not found' });
  }

  store.recordAudit('inventory.transaction_applied', 'employee', transaction);
  return res.status(201).json(transaction);
});

app.get('/api/employee/audit-logs', requireEmployeeMiddleware, (req, res) => {
  return res.json(store.auditLogs.slice(-100));
});

app.get('/api/employee/events', (req, res) => {
  const hasHeaderAccess = hasEmployeeAccess(req, EMPLOYEE_API_TOKEN);
  const hasQueryAccess =
    String(req.query.role || '').toLowerCase() === 'employee' &&
    req.query.token === EMPLOYEE_API_TOKEN;

  if (!hasHeaderAccess && !hasQueryAccess) {
    return res.status(403).json({ error: 'Employee role and valid token required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (eventPayload) => {
    res.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
  };

  const listener = (event) => sendEvent(event);
  store.events.on('checkout.started', listener);
  store.events.on('feedback.created', listener);
  store.events.on('inventory.updated', listener);
  store.events.on('inventory.low_stock', listener);

  sendEvent({
    type: 'stream.ready',
    timestamp: new Date().toISOString(),
  });

  req.on('close', () => {
    store.events.removeListener('checkout.started', listener);
    store.events.removeListener('feedback.created', listener);
    store.events.removeListener('inventory.updated', listener);
    store.events.removeListener('inventory.low_stock', listener);
  });
});

app.get('/api/config', (_req, res) => {
  return res.json({
    appName: 'NAMASTE ITC AI',
    supportedLanguages: ['English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi'],
    voiceFallbackMode: 'text',
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`NAMASTE ITC AI running on http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  store,
};
