# Clinic Note

## Overview
Clinic Note is an appointment-driven memo system designed to aggregate preparation notes between clinic appointments.

## Algorithm
1. User registers appointment dates.
2. User writes daily preparation memos.
3. On appointment date, system aggregates memos since previous appointment.

## Flowchart
[User] → [Calendar Select] → [Memo Input] → [Save] → [Database]

## Arrow Diagram
Frontend → Backend API → PostgreSQL → Analytics → Frontend

## Deployment

### Vercel
- Root Directory: `frontend`
- Build Command: *(none)*
- Install Command: *(none)*
- Output Directory: `.`

### Render (Backend)
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `node index.js`
- Region: Singapore (example)

### Render PostgreSQL
- Name: clinic-note-db
- Database: clinic_note
- User: clinic_user
- PostgreSQL Version: 15

### Environment Variables
- DATABASE_URL (Internal URL)
- NODE_ENV=production

### Monitoring
- Datadog API Key: Set in Render
- Datadog Region: US

## Developer
***Hirotoshi Uchida***
