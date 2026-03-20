<div align="center">

# CellBlock

### Lab equipment scheduling for cell culture research groups

<br>

**[→ Open the live app](https://ebalderasr.github.io/CellBlock/)**

<br>

[![Stack](https://img.shields.io/badge/Stack-React_·_Supabase_·_Tailwind-4A90D9?style=for-the-badge)]()
[![Focus](https://img.shields.io/badge/Focus-Biosafety_Cabinet_Scheduling-34C759?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)
[![Part of](https://img.shields.io/badge/Part_of-HostCell_Lab_Suite-5856D6?style=for-the-badge)](https://github.com/ebalderasr)

</div>

---

## What is CellBlock?

CellBlock is a **web-based scheduling system** for shared biosafety cabinet (hood) usage in a mammalian cell culture laboratory. It gives every lab member a live view of equipment availability, enforces fair-use rules automatically, and keeps experiment notes attached to each booking — all without spreadsheets or group chats.

It is built for research groups that share multiple hoods across rotating users and need a lightweight, always-available booking interface that runs from any device.

---

## Why it matters

Shared equipment in a cell culture lab is a constant source of scheduling conflicts. Without a system:

- Members have no visibility into who is using which hood and when
- Back-to-back bookings monopolize equipment and block others
- Experiment annotations get lost in notebooks or messaging apps

CellBlock solves this with a real-time weekly calendar, per-hood views, and hard limits on consecutive booking blocks — enforced at the application level, not by convention.

---

## Screenshots

**Desktop**

![Desktop view](screenshots/pc.png)

**Mobile**

<img src="screenshots/mobil.jpeg" alt="Mobile view" width="360">

---

## How it works

### Authentication & access control

Users register with their name, institutional email, and a 3-letter lab code. New accounts require **admin approval** before they can book. Login accepts either email or the 3-letter code.

### Weekly calendar

The main view is a 7-day × 24-hour grid — including nights and weekends, for cell culture runs that require off-hours monitoring. Each hood has its own independent schedule. Users can navigate up to 4 weeks ahead.

### Fair-use rules enforced automatically

| Rule | Details |
|------|---------|
| **Max 3 consecutive hours** | Per user, per hood, per day. Attempting a 4th consecutive slot is rejected |
| **Rolling schedule release** | Weeks 3 and 4 are locked until the preceding Saturday at 11:00 AM, preventing early monopolization of future slots |
| **Admin override** | Admin accounts bypass booking locks for urgent or administrative reservations |

### Experiment notes

Each booking has an attached notes field. Only the booking owner can write or edit notes. Notes are visible to any logged-in user when clicking a slot, supporting transparency across the team.

---

## Features

| | |
|---|---|
| **Real-time data** | Bookings sync through Supabase — changes appear immediately across all sessions |
| **Multi-hood** | Any number of biosafety cabinets can be added; each has its own independent schedule |
| **Role-based access** | Admin and regular user roles with different permissions |
| **Approval workflow** | New registrations require admin approval before access is granted |
| **Experiment notes** | Per-booking notes visible to the team, editable only by the owner |
| **PWA-ready** | Installable on Android, iOS, and desktop as a standalone app |
| **24/7 grid** | Full 24-hour view supports night shifts and weekend monitoring |
| **Responsive** | Full sidebar layout on desktop; compact single-column view on mobile |

---

## Implementation: GPR Lab (IBt-UNAM)

This instance is configured for the **Palomares-Ramírez Group** at the Institute of Biotechnology, UNAM, managing five specialized stations:

| Hood | Type |
|------|------|
| Hood 1 | Virus-free |
| Hood 2 | Virus-free |
| Hood 3 | Virus |
| Hood 4 | Insect cells |
| Bacteria Hood | Lab 401 · Bacteria |

---

## Tech stack

**Frontend**

![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Lucide](https://img.shields.io/badge/Lucide_React-555555?style=flat-square)
![date-fns](https://img.shields.io/badge/date--fns-770C56?style=flat-square)

**Backend & data**

![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)

**Deployment**

![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-222222?style=flat-square&logo=github&logoColor=white)

---

## Project structure

```
CellBlock/
├── src/
│   ├── config/
│   │   └── lab.config.js        ← lab identity, admin contact, booking rules
│   ├── lib/
│   │   └── supabase.js          ← Supabase client (single instance)
│   ├── hooks/
│   │   └── useBookings.js       ← data fetching + CRUD (hoods, bookings)
│   ├── components/
│   │   ├── BookingCalendar.jsx  ← 7-day × 24-hour scheduling grid
│   │   ├── BookingModal.jsx     ← booking detail, notes, delete
│   │   ├── LoginScreen.jsx      ← auth + registration flow
│   │   └── SupportBox.jsx      ← admin contact panel
│   ├── App.jsx                  ← thin orchestrator (auth state, slot logic)
│   ├── main.jsx                 ← React entry point
│   └── index.css                ← global styles
├── public/              ← static assets
├── screenshots/         ← UI screenshots for this README
├── index.html           ← HTML entry point
├── vite.config.js       ← Vite + GitHub Pages configuration
├── package.json
└── .env                 ← Supabase credentials (not committed — see .env.example)
```

---

## Database schema (Supabase)

| Table | Key columns |
|-------|-------------|
| `authorized_users` | `id`, `full_name`, `email`, `user_code`, `password`, `is_approved`, `is_admin` |
| `hoods` | `id`, `name` |
| `bookings` | `id`, `hood_id`, `user_id`, `user_name`, `start_time`, `end_time`, `notes` |

---

## Local setup

```bash
# 1. Clone and install
git clone https://github.com/ebalderasr/CellBlock.git
cd CellBlock
npm install

# 2. Configure Supabase credentials
echo "VITE_SUPABASE_URL=https://your-project.supabase.co" >> .env
echo "VITE_SUPABASE_ANON_KEY=your-anon-key" >> .env

# 3. Start dev server
npm run dev
```

### Deploy to GitHub Pages

```bash
npm run deploy
```

---

## Author

**Emiliano Balderas Ramírez**
Bioengineer · PhD Candidate in Biochemical Sciences
Instituto de Biotecnología (IBt), UNAM · Grupo Palomares-Ramírez

[![LinkedIn](https://img.shields.io/badge/LinkedIn-emilianobalderas-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/emilianobalderas/)
[![Email](https://img.shields.io/badge/Email-ebalderas%40live.com.mx-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:ebalderas@live.com.mx)

---

<div align="center"><i>CellBlock — shared equipment, no conflicts.</i></div>
