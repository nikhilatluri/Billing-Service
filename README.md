# Billing Service

Billing Service manages bill generation, payment tracking, and refund processing for the Hospital Management System.

## Features

- **Generate Bills**: Auto-generates bills for completed appointments with 5% tax
- **Refund Policies**: Handles cancellations (Full/Partial/Fee)
- **Bill Statuses**: OPEN, PAID, VOID, REFUND
- **No-Show Fees**: Applies fees for missed appointments
- **Inter-service Integration**: Works with Appointment, Payment, and Notification services

## Tech Stack

Node.js 18, Express, PostgreSQL, Axios, Winston, Prometheus, Swagger

## Quick Start

```bash
npm install
cp .env.example .env
npm start
```

## API Endpoints

- `POST /v1/bills` - Generate bill
- `POST /v1/bills/cancel` - Handle cancellation with refund policy
- `GET /v1/bills` - Get bills (with filters)
- `GET /v1/bills/:id` - Get bill by ID
- `GET /v1/bills/appointment/:appointment_id` - Get bill by appointment
- `PUT /v1/bills/:id/pay` - Mark bill as paid

## Database Schema

```sql
CREATE TABLE bills (
  bill_id SERIAL PRIMARY KEY,
  appointment_id INTEGER UNIQUE,
  patient_id INTEGER,
  doctor_id INTEGER,
  amount DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'OPEN',
  bill_type VARCHAR(50),
  refund_policy VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Business Logic

**Tax Calculation**: 5% on base amount

**Refund Policies**:
- FULL_REFUND: 100% refund
- PARTIAL_REFUND: 50% refund
- CANCELLATION_FEE: No refund
- NO_REFUND: No refund

## Environment Variables

```
PORT=3004
DB_HOST=localhost
DB_NAME=hms_billing
TAX_RATE=0.05
NOTIFICATION_SERVICE_URL=http://localhost:3007
```

## API Documentation

http://localhost:3004/api-docs

## License

MIT
