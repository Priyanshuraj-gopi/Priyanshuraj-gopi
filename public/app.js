const customerRoleBtn = document.getElementById('customerRoleBtn');
const employeeRoleBtn = document.getElementById('employeeRoleBtn');
const customerView = document.getElementById('customerView');
const employeeView = document.getElementById('employeeView');
const customerLog = document.getElementById('customerLog');
const employeeEvents = document.getElementById('employeeEvents');

let checkoutSessionId = null;
let eventSource = null;
let activeRole = 'customer';

function logCustomer(message) {
  customerLog.textContent = `${message}\n${customerLog.textContent}`;
}

function switchRole(role) {
  activeRole = role;
  customerView.classList.toggle('hidden', role !== 'customer');
  employeeView.classList.toggle('hidden', role !== 'employee');
  customerRoleBtn.classList.toggle('active', role === 'customer');
  employeeRoleBtn.classList.toggle('active', role === 'employee');
}

customerRoleBtn.addEventListener('click', () => switchRole('customer'));
employeeRoleBtn.addEventListener('click', () => switchRole('employee'));
switchRole(activeRole);

async function api(path, options = {}, role = 'customer') {
  const headers = {
    'Content-Type': 'application/json',
    'x-role': role,
    ...(options.headers || {}),
  };

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return response.json();
}

async function loadConfig() {
  const config = await fetch('/api/config').then((r) => r.json());
  const languageSelect = document.getElementById('language');
  languageSelect.innerHTML = '';
  config.supportedLanguages.forEach((language) => {
    const option = document.createElement('option');
    option.value = language;
    option.textContent = language;
    languageSelect.appendChild(option);
  });
}

document.getElementById('startCheckout').addEventListener('click', async () => {
  try {
    const stay = await api('/api/customer/stays', {
      method: 'POST',
      body: JSON.stringify({
        customerName: document.getElementById('customerName').value,
        hotelId: document.getElementById('hotelId').value,
        roomNumber: document.getElementById('roomNumber').value,
      }),
    });

    const session = await api('/api/customer/checkout/start', {
      method: 'POST',
      body: JSON.stringify({
        stayId: stay.id,
        preferredLanguage: document.getElementById('language').value,
        consentForVoice: document.getElementById('voiceConsent').checked,
      }),
    });

    checkoutSessionId = session.id;
    logCustomer(`Checkout started: ${checkoutSessionId} | Language: ${session.preferredLanguage}`);
  } catch (error) {
    logCustomer(`Error: ${error.message}`);
  }
});

document.getElementById('sendText').addEventListener('click', async () => {
  if (!checkoutSessionId) {
    logCustomer('Start checkout first.');
    return;
  }

  try {
    const payload = await api(
      `/api/customer/checkout/${checkoutSessionId}/message`,
      {
        method: 'POST',
        body: JSON.stringify({
          text: document.getElementById('feedbackText').value,
          mode: 'text',
        }),
      },
      'customer',
    );

    logCustomer(`Stored feedback items: ${payload.createdFeedback.length}`);
  } catch (error) {
    logCustomer(`Error: ${error.message}`);
  }
});

document.getElementById('startVoice').addEventListener('click', async () => {
  if (!checkoutSessionId) {
    logCustomer('Start checkout first.');
    return;
  }

  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    logCustomer('Voice unavailable. Use text fallback.');
    return;
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Recognition();
  recognition.lang = 'en-US';

  recognition.onresult = async (event) => {
    const spokenText = event.results[0][0].transcript;
    document.getElementById('feedbackText').value = spokenText;

    try {
      await api(
        `/api/customer/checkout/${checkoutSessionId}/message`,
        {
          method: 'POST',
          body: JSON.stringify({ text: spokenText, mode: 'voice' }),
        },
        'customer',
      );
      logCustomer(`Voice feedback captured: "${spokenText}"`);

      if ('speechSynthesis' in window) {
        const reply = new SpeechSynthesisUtterance('Thank you for your feedback.');
        speechSynthesis.speak(reply);
      }
    } catch (error) {
      logCustomer(`Error: ${error.message}. Switching to text fallback.`);
    }
  };

  recognition.onerror = () => {
    logCustomer('Voice recognition issue. Please use text fallback.');
  };

  recognition.start();
});

document.getElementById('finishCheckout').addEventListener('click', async () => {
  if (!checkoutSessionId) {
    logCustomer('Start checkout first.');
    return;
  }

  try {
    await api(`/api/customer/checkout/${checkoutSessionId}/finish`, { method: 'POST' });
    logCustomer(`Checkout completed: ${checkoutSessionId}`);
    checkoutSessionId = null;
  } catch (error) {
    logCustomer(`Error: ${error.message}`);
  }
});

function employeeHeaders() {
  return {
    'x-role': 'employee',
    'x-employee-token': document.getElementById('employeeToken').value,
  };
}

document.getElementById('refreshSummary').addEventListener('click', async () => {
  try {
    const summary = await fetch('/api/employee/feedback/summary?hotelId=itc-grand-bharat', {
      headers: employeeHeaders(),
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error((await response.json()).error || 'Unable to load summary');
      }
      return response.json();
    });

    const chips = Object.entries(summary.byCategory)
      .map(([name, count]) => `<span class="pill">${name}: ${count}</span>`)
      .join('');

    document.getElementById('summary').innerHTML = `
      <p>Total feedback: <strong>${summary.total}</strong></p>
      <p>Sentiment: ${JSON.stringify(summary.sentimentCounts)}</p>
      <div>${chips}</div>
      <p>Alerts: ${summary.alerts.map((a) => `[${a.category}] ${a.text}`).join(' | ') || 'None'}</p>
    `;
  } catch (error) {
    document.getElementById('summary').textContent = `Error: ${error.message}`;
  }
});

document.getElementById('loadInventory').addEventListener('click', async () => {
  try {
    const items = await fetch('/api/employee/inventory/items?hotelId=itc-grand-bharat', {
      headers: employeeHeaders(),
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error((await response.json()).error || 'Unable to load inventory');
      }
      return response.json();
    });

    document.getElementById('inventoryList').innerHTML = items
      .map(
        (item) =>
          `<div class="pill">${item.id} | ${item.name} | Dept: ${item.department} | Qty: ${item.quantity}</div>`,
      )
      .join('');
  } catch (error) {
    document.getElementById('inventoryList').textContent = `Error: ${error.message}`;
  }
});

document.getElementById('submitTransaction').addEventListener('click', async () => {
  try {
    await fetch('/api/employee/inventory/transactions', {
      method: 'POST',
      headers: {
        ...employeeHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemId: document.getElementById('transactionItem').value,
        type: document.getElementById('transactionType').value,
        quantity: Number(document.getElementById('transactionQuantity').value),
      }),
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error((await response.json()).error || 'Unable to submit transaction');
      }
      return response.json();
    });

    document.getElementById('loadInventory').click();
  } catch (error) {
    employeeEvents.textContent = `Error: ${error.message}\n${employeeEvents.textContent}`;
  }
});

document.getElementById('connectStream').addEventListener('click', () => {
  if (eventSource) {
    eventSource.close();
  }

  const token = encodeURIComponent(document.getElementById('employeeToken').value);
  eventSource = new EventSource(`/api/employee/events?role=employee&token=${token}`);
  eventSource.onmessage = (event) => {
    employeeEvents.textContent = `${event.data}\n${employeeEvents.textContent}`;
  };

  eventSource.onerror = () => {
    employeeEvents.textContent = 'Realtime stream interrupted.\n' + employeeEvents.textContent;
    eventSource.close();
  };

  fetch('/api/employee/feedback/summary', { headers: employeeHeaders() }).catch(() => {
    employeeEvents.textContent = 'Check employee token before loading secure resources.\n' + employeeEvents.textContent;
  });
});

loadConfig().catch(() => {
  logCustomer('Unable to load app configuration');
});
