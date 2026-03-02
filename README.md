# 🛰️ CellBlock | Host Cell Lab Suite

> **Smart hood booking and lab flow coordination. Fast, clear, and lab-ready.**

CellBlock is a dedicated web app for managing laminar flow hood schedules and synchronizing daily operations within the Palomares-Ramírez (GPR) group.
It is an official module of HostCell, a suite of practical laboratory and bioprocess tools built by Emiliano Balderas (IBt-UNAM).

<p align="center">
<img src="[https://cdn-icons-png.flaticon.com/512/3022/3022513.png](https://www.google.com/search?q=https://cdn-icons-png.flaticon.com/512/3022/3022513.png)" width="180" alt="CellBlock Logo">
</p>

<p align="center">
<a href="[https://ebalderasr.github.io/CellBlock/](https://www.google.com/search?q=https://ebalderasr.github.io/CellBlock/)">
<img src="[https://img.shields.io/badge/](https://img.shields.io/badge/)🚀_Launch_Live_App-CellBlock-2563eb?style=for-the-badge&labelColor=000000" alt="Launch CellBlock App">
</a>
</p>

<p align="center">
<a href="[https://github.com/ebalderasr/CellBlock](https://www.google.com/search?q=https://github.com/ebalderasr/CellBlock)">Repo</a> •
<a href="[https://ebalderasr.github.io/CellBlock/](https://www.google.com/search?q=https://ebalderasr.github.io/CellBlock/)">Live App</a>
</p>

---

## What is CellBlock?

**CellBlock** helps coordinate the daily operations of Lab 10-401 by providing a centralized, real-time booking system for sterile flow hoods.

The app is focused on three pillars:

* **Availability**: 24/7 access for night-shifts or early-morning operations.
* **Fairness**: Automated rules to prevent schedule over-saturation (3h limit).
* **Traceability**: Quick identification of users via 3-letter codes and experiment notes.

It is designed for rapid bench-side booking, allowing scientists to focus on their cell cultures rather than logistics.

---

## ✅ Operational Logic (The GPR Ruleset)

CellBlock implements specific laboratory policies to ensure efficient workflow distribution:

### 1) The 3-Hour Consecutive Rule

To ensure all members of the **GPR** have access to sterile workspaces, the system enforces a strict time limit:

* A user cannot book more than **3 consecutive hours** in the same equipment.
* The algorithm scans the entire day's sequence; if a new booking creates a 4-hour chain, the request is automatically blocked.

### 2) Fortnightly Schedule Release

The agenda is managed in blocks of two weeks:

* **Weeks 1 and 2**: Always open for regular planning.
* **Weeks 3 and 4**: Released every **Saturday at 11:00 AM (CDMX time)**.
* *Note: Administrators have bypass permissions for long-term project planning.*

### 3) Dual Login & Identity

Users can access the system using:

* **Institutional Email** (@ibt.unam.mx).
* **3-Letter Code** (e.g., EBR, ARC).
This ensures the schedule remains legible and professional on small screens.

---

## ⚡ Features

* **24/7 Scheduling:** Full hourly grid for all days of the week.
* **Role-Based Access:** Admin accounts can manage or release bookings from any user.
* **Experiment Notes:** Optional observations for each slot (e.g., "Media prep", "Media change only").
* **Mobile-First UI:** Optimized for lab use with a "sticky time" column and PWA capabilities.
* **PWA Ready:** Installable on PC, Android, and iOS for an app-like experience.

---

## 🔬 Typical Use Cases

CellBlock is useful for:

* Planning **complex passaging** schedules in advance.
* Coordinating **long-term bioreactor** sampling windows.
* Managing **emergency sterile work** during off-hours.
* Reducing conflicts and "double-booking" errors in Lab 10-401.

---

## 📱 Installation (PWA)

CellBlock can be installed as a Progressive Web App (PWA) for faster access at the bench.

### Android / PC (Chrome, Edge)

* Open the live app in your browser.
* Look for the **Install Icon** in the address bar (PC) or the **Install App** prompt (Android).

### iPhone / iPad (Safari)

* Open the live app in Safari.
* Tap the **Share** button.
* Select **Add to Home Screen**.

---

## 🛠️ Technical Support

**CellBlock** is maintained by the laboratory's technical support team:

* **Admin/Support**: Emiliano Balderas
* **Contact**: [emiliano.balderas@ibt.unam.mx](mailto:emiliano.balderas@ibt.unam.mx)

Contact support for account approvals, role upgrades, or reporting system issues.

---

## 🧩 About Host Cell

**Host Cell** is a growing suite of practical lab and bioprocess tools focused on:

* Clarity & Speed
* Reproducibility
* Real-world usability at the bench

CellBlock is a dedicated module for GPR workflow synchronization.

---

**Host Cell Lab Suite** – *Practical tools for high-performance biotechnology.*

