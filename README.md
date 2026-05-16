# eCargoWorld — Freight Forwarding Management Platform

A complete freight forwarding operations platform built for **eCargoWorld Pakistan**. Manages shipments, tasks, flight tracking, rates, and team operations — all in one place.

---

## Features

### Public Website
- Company landing page with services, about, and contact sections
- Quote request form — opens pre-filled email to info@ecargopk.com
- Customer shipment tracking by AWB number
- Dynamic branding — logos and images managed from admin panel

### Staff Dashboard
- **Three user roles:** Director, Manager, Employee
- Shipment management — create, edit, delete, advance status
- Manual AWB entry
- Revenue tracking (Director/Manager only)
- Flight tracking via AviationStack API (Director only)
- Airline rates management
- Task engine with delegation
- Team overview

### Admin Panel
- Upload company logos, website images, certification logos
- Edit certification names
- Manage teams (Export, Import, Operations — customizable)
- Manage users — edit names, roles, team assignments
- Update company settings and exchange rate

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Flight API | AviationStack |
| Email | Resend (planned) |

---

## Project Structure
freight_platform/
├── index.html # Public landing page
├── login.html # Staff login
├── app.html # Operations dashboard
├── admin.html # Admin panel
├── track.html # Customer AWB tracking
├── css/
│ ├── main.css # Landing page styles
│ ├── app.css # Dashboard styles
│ └── login.css # Login page styles
├── js/
│ ├── supabase.js # Supabase client config
│ ├── main.js # Landing page logic
│ ├── login.js # Authentication
│ ├── app.js # Dashboard controller
│ ├── shipments.js # Shipment CRUD
│ ├── tasks.js # Task engine + delegation
│ ├── flights.js # AviationStack integration
│ ├── admin.js # Admin panel logic
│ └── track.js # Public tracking
└── assets/ # Uploaded images (optional)
---

## User Roles

| Role | Dashboard | Admin Panel | Flight API | Task Delegation | Edit Shipments |
|------|-----------|-------------|------------|-----------------|----------------|
| Director | Full | ✅ | ✅ | ✅ | ✅ |
| Manager | Team view | ✅ | ❌ | ❌ | ✅ |
| Employee | Own tasks | ❌ | ❌ | ❌ | ❌ |

---

## Setup

### 1. Supabase
- Create project at [supabase.com](https://supabase.com)
- Run the SQL setup script to create tables, policies, and default data
- Add Supabase URL and anon key to `js/supabase.js`

### 2. AviationStack (Flight Tracking)
- Sign up at [aviationstack.com](https://aviationstack.com) for free API key
- Add key to `js/flights.js`

### 3. Email Notifications (Planned)
- Sign up at [resend.com](https://resend.com)
- Verify domain `ecargopk.com`
- Add DNS records (DKIM, SPF, DMARC)
- Create API key and add to `js/tasks.js`
- When director delegates a task, employee receives email with:
  - Task name
  - Deadline
  - Priority
  - Linked shipment (AWB)
  - Link to dashboard

### 4. Deployment
- Deploy to Vercel (static site)
- Point domain `ecargopk.com` to Vercel
- Add DNS records for Resend email

---

## Database Tables

| Table | Purpose |
|-------|---------|
| profiles | User accounts, roles, team assignments |
| settings | Company info, logos, exchange rate |
| shipments | All shipment records |
| tasks | Task assignments and status |
| airline_rates | Rate cards per airline/route |
| teams | Employee team groupings |
| quote_requests | Submitted quote forms |

---

## Default Teams

- Export Team
- Import Team
- Operations Team

Teams are fully customizable from the admin panel.

---

## Selling This Platform

This platform can be sold to other freight forwarding companies as a white-label solution.

**Pricing:**
- One-time sale: **Rs. 500,000 - 700,000** (PKR) / **$1,800 - $2,500** (USD)
- Includes: Full platform, custom branding, deployment, 3 months support
- Compared to custom development: **Rs. 1,500,000+** / **$5,000+**

---

## License

Proprietary — built for eCargoWorld Pakistan.

---

## Contact

**Email:** info@ecargopk.com
**Website:** ecargopk.com
**Offices:** Lahore | Karachi | Peshawar
