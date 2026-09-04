# NAMASTE ITC AI

NAMASTE ITC AI is a role-based hotel assistant prototype for ITC hotels with:
- **Customer interface**: multilingual checkout assistant with voice input and text fallback.
- **Employee interface**: feedback analytics plus commodities/amenities inventory operations.

## Features

### Customer-oriented interface
- Preferred language selection before checkout.
- Checkout conversation via text or browser voice recognition.
- Voice consent flag required before voice capture.
- Transcript messages stored encrypted in backend.
- AI feedback categorization and sentiment scoring:
  - Categories: room, food, service, hygiene, billing, staff behavior, amenities, general.
  - Sentiment: positive, neutral, negative.
  - Quality: good / not good.

### Employee-oriented interface
- Feedback summary dashboard (totals, category counts, sentiment distribution, alerts).
- Drill-down filters in APIs by hotel, date range, department, and language.
- Inventory/amenities management:
  - View stock levels
  - Record consume/restock transactions
  - Low-stock realtime alerts
- Realtime event stream for new feedback and inventory updates.

### Security & governance
- Role-based API access:
  - `customer` routes require `x-role: customer`
  - `employee` routes require `x-role: employee` + `x-employee-token`
- Audit logging for customer and employee actions.
- Consent tracking for voice recordings.

## Data model (in-memory MVP)
- Customer stay
- Checkout session
- Transcript entry (encrypted)
- Feedback item
- Sentiment result
- Inventory item
- Stock transaction
- Audit log

## Run locally

```bash
npm install
npm start
```

Open: `http://localhost:3000`

## Test

```bash
npm test
```

## API notes
- `GET /api/config` returns supported languages and app metadata.
- Customer flow:
  - `POST /api/customer/stays`
  - `POST /api/customer/checkout/start`
  - `POST /api/customer/checkout/:sessionId/message`
  - `POST /api/customer/checkout/:sessionId/finish`
  - `GET /api/customer/checkout/:sessionId/transcript`
- Employee flow:
  - `GET /api/employee/feedback/summary`
  - `GET /api/employee/feedback/items`
  - `GET /api/employee/inventory/items`
  - `POST /api/employee/inventory/transactions`
  - `GET /api/employee/events`
  - `GET /api/employee/audit-logs`

## MVP rollout mapping
- **Phase 1**: multilingual checkout + transcript storage + basic sentiment ✅
- **Phase 2**: employee feedback dashboard ✅
- **Phase 3**: inventory/amenities tracking + low-stock alerts ✅
- **Phase 4**: advanced analytics/model tuning ⏳ (future work)
