const crypto = require('crypto');
const EventEmitter = require('events');

function createStore({ encryptionSecret, lowStockThreshold = 10 } = {}) {
  const keySeed = encryptionSecret || 'namaste-itc-ai-dev-secret';
  const encryptionKey = crypto.createHash('sha256').update(keySeed).digest();

  const events = new EventEmitter();

  let stayCounter = 1;
  let checkoutCounter = 1;
  let feedbackCounter = 1;
  let transactionCounter = 1;

  const customerStays = [];
  const checkoutSessions = [];
  const feedbackItems = [];
  const sentimentResults = [];
  const stockTransactions = [];
  const auditLogs = [];
  const inventoryItems = [
    {
      id: 'inv-1',
      hotelId: 'itc-grand-bharat',
      name: 'Bath Towels',
      department: 'housekeeping',
      quantity: 60,
      lowStockThreshold,
    },
    {
      id: 'inv-2',
      hotelId: 'itc-grand-bharat',
      name: 'Complimentary Water Bottles',
      department: 'hospitality',
      quantity: 150,
      lowStockThreshold: 50,
    },
    {
      id: 'inv-3',
      hotelId: 'itc-grand-bharat',
      name: 'Spa Essential Oils',
      department: 'wellness',
      quantity: 22,
      lowStockThreshold,
    },
  ];

  function recordAudit(action, actorRole, metadata = {}) {
    const log = {
      id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      action,
      actorRole,
      metadata,
      timestamp: new Date().toISOString(),
    };
    auditLogs.push(log);
    return log;
  }

  function encrypt(plainText) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('base64'),
      content: encrypted.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  function decrypt(payload) {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey,
      Buffer.from(payload.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.content, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  function createStay({ customerName, hotelId, roomNumber }) {
    const stay = {
      id: `stay-${stayCounter++}`,
      customerName,
      hotelId,
      roomNumber,
      createdAt: new Date().toISOString(),
    };
    customerStays.push(stay);
    return stay;
  }

  function createCheckoutSession({ stayId, preferredLanguage, consentForVoice }) {
    const session = {
      id: `checkout-${checkoutCounter++}`,
      stayId,
      preferredLanguage,
      consentForVoice: Boolean(consentForVoice),
      status: 'active',
      transcript: [],
      createdAt: new Date().toISOString(),
      finishedAt: null,
    };
    checkoutSessions.push(session);
    events.emit('checkout.started', {
      type: 'checkout.started',
      sessionId: session.id,
      stayId: session.stayId,
      preferredLanguage: session.preferredLanguage,
      timestamp: new Date().toISOString(),
    });
    return session;
  }

  function addTranscriptMessage({ sessionId, speaker, mode, text }) {
    const session = checkoutSessions.find((item) => item.id === sessionId);
    if (!session) {
      return null;
    }

    const entry = {
      speaker,
      mode,
      encryptedText: encrypt(text),
      createdAt: new Date().toISOString(),
    };

    session.transcript.push(entry);
    return { session, entry };
  }

  function addFeedback(feedbackItem) {
    const enriched = {
      ...feedbackItem,
      id: `feedback-${feedbackCounter++}`,
      createdAt: new Date().toISOString(),
    };

    feedbackItems.push(enriched);
    sentimentResults.push({
      feedbackId: enriched.id,
      category: enriched.category,
      sentiment: enriched.sentiment,
      quality: enriched.quality,
      confidence: enriched.confidence,
      createdAt: enriched.createdAt,
    });

    events.emit('feedback.created', {
      type: 'feedback.created',
      payload: enriched,
      timestamp: new Date().toISOString(),
    });

    return enriched;
  }

  function finishCheckoutSession(sessionId) {
    const session = checkoutSessions.find((item) => item.id === sessionId);
    if (!session) {
      return null;
    }
    session.status = 'completed';
    session.finishedAt = new Date().toISOString();
    return session;
  }

  function getCheckoutSession(sessionId) {
    return checkoutSessions.find((item) => item.id === sessionId) || null;
  }

  function getDecryptedTranscript(session) {
    return session.transcript.map((entry) => ({
      speaker: entry.speaker,
      mode: entry.mode,
      text: decrypt(entry.encryptedText),
      createdAt: entry.createdAt,
    }));
  }

  function getFeedbackSummary({ hotelId, from, to, department, language }) {
    const filtered = feedbackItems.filter((item) => {
      if (hotelId && item.hotelId !== hotelId) return false;
      if (department && item.department !== department) return false;
      if (language && item.language !== language) return false;
      if (from && item.createdAt < from) return false;
      if (to && item.createdAt > to) return false;
      return true;
    });

    const byCategory = {};
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };

    for (const item of filtered) {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      sentimentCounts[item.sentiment] = (sentimentCounts[item.sentiment] || 0) + 1;
    }

    const positiveHighlights = filtered
      .filter((item) => item.sentiment === 'positive')
      .slice(-5)
      .map((item) => item.text);

    const alerts = filtered
      .filter((item) => item.sentiment === 'negative')
      .slice(-5)
      .map((item) => ({ category: item.category, text: item.text }));

    return {
      total: filtered.length,
      byCategory,
      sentimentCounts,
      positiveHighlights,
      alerts,
      trend: filtered.map((item) => ({ timestamp: item.createdAt, sentiment: item.sentiment })),
    };
  }

  function listFeedback(filters) {
    return feedbackItems.filter((item) => {
      if (filters?.hotelId && item.hotelId !== filters.hotelId) return false;
      if (filters?.language && item.language !== filters.language) return false;
      if (filters?.department && item.department !== filters.department) return false;
      return true;
    });
  }

  function listInventory({ hotelId, department } = {}) {
    return inventoryItems.filter((item) => {
      if (hotelId && item.hotelId !== hotelId) return false;
      if (department && item.department !== department) return false;
      return true;
    });
  }

  function applyStockTransaction({ itemId, type, quantity, requestedBy, note }) {
    const item = inventoryItems.find((entry) => entry.id === itemId);
    if (!item) {
      return null;
    }

    const delta = type === 'restock' ? quantity : -quantity;
    item.quantity += delta;

    const transaction = {
      id: `stock-${transactionCounter++}`,
      itemId,
      type,
      quantity,
      requestedBy,
      note,
      resultingQuantity: item.quantity,
      timestamp: new Date().toISOString(),
    };

    stockTransactions.push(transaction);

    events.emit('inventory.updated', {
      type: 'inventory.updated',
      payload: transaction,
      timestamp: new Date().toISOString(),
    });

    if (item.quantity <= item.lowStockThreshold) {
      events.emit('inventory.low_stock', {
        type: 'inventory.low_stock',
        payload: {
          itemId: item.id,
          name: item.name,
          quantity: item.quantity,
          lowStockThreshold: item.lowStockThreshold,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return transaction;
  }

  return {
    customerStays,
    checkoutSessions,
    feedbackItems,
    sentimentResults,
    inventoryItems,
    stockTransactions,
    auditLogs,
    events,
    createStay,
    createCheckoutSession,
    addTranscriptMessage,
    addFeedback,
    finishCheckoutSession,
    getCheckoutSession,
    getDecryptedTranscript,
    getFeedbackSummary,
    listFeedback,
    listInventory,
    applyStockTransaction,
    recordAudit,
  };
}

module.exports = {
  createStore,
};
