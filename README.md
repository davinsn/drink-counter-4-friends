# Drink Counter (Realtime Party Tracker)

A real-time web application for tracking drinks among friends in shared sessions.  
Built as a side project to demonstrate live data synchronisation, session-based state management, and interactive UI design.

---

## Features

- Create and join rooms using a shared code  
- Real-time leaderboard with live updates  
- Drink tracking system:
  - Beer, cocktail, shot, and water tracking  
  - Undo last drink functionality  
- Points-based scoring system  
- Global leaderboard across sessions  
- Host-controlled session reset  
- Real-time multi-user synchronisation via Supabase  

---

## Tech Stack

- Frontend: Next.js (React, TypeScript)  
- Backend: Supabase (PostgreSQL + Realtime)  
- Styling: CSS  
- State Management: React hooks  

---

## Architecture Overview

The application uses a room-based relational data model.

### Core Tables

- `players`  
  Stores user identity (device-based)

- `rooms`  
  Stores room metadata such as code, host, and active state

- `room_members`  
  Tracks per-user stats within a room:
  - total drinks  
  - water count  
  - total points  

- `drink_events`  
  Stores each action as an event for history tracking and undo functionality  

---

## Scoring System

| Drink Type | Points |
|-----------|--------|
| Beer      | 5      |
| Cocktail  | 1      |
| Shot      | 10     |
| Water     | -1     |

- Scores are stored in `total_points`
- Leaderboards are ranked primarily by points

---

## Setup and Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/drink-counter.git
cd drink-counter

```

### 2. Install dependencies

```bash
npm install

```

### 3. Configure environment variables
Create a .env.local file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

```

These can be found in Supabase under Settings → API.

### 4. Setup the database
Open Supabase → SQL Editor and run your schema file:

supabase/schema.sql

### 5. Run the application

```bash
npm run dev
```

Open in browser:

http://localhost:3000




