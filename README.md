# Revamped Niche Community Platform – Real-Time, Personalized, and Engaging Experience

A real-time, Firebase-driven community platform where users join niche interest groups (tech, fitness, books, etc.), post content, engage in threaded discussions, and receive personalized recommendations. Socket.io powers instant collaboration and live updates; Firebase provides authentication, Firestore, Cloud Functions, Storage, FCM, and Hosting.

## Core Features
- Interactive discussion boards with threaded comments and media uploads
- Real-time updates for posts, comments, reactions via Socket.io + Firestore snapshots
- Rich text editor (Quill/TipTap), reactions, voting
- Smart discovery: filters, personalized recommendations, interest clusters
- Dynamic feed with animations and customization (Most Recent, Top, Trending)
- Engagement tools: live polls, Q&A, push notifications, achievements/leaderboards
- Onboarding, profile customization, and community admin tools
- Optional AI content moderation via Cloud Functions + external LLM API

## Tech Stack
- Frontend: React (Vite + TypeScript), Tailwind CSS, React Router, Socket.io client, Quill/React-Quill
- Backend: Firebase (Auth, Firestore, Functions, Storage, FCM, Hosting)
- Realtime layer: Node.js Socket.io server (lightweight relay / augmentation)

## Packages / Folders
- web/ — React app (Vite + TS)
- server/ — Socket.io server (Express)

## Development
1. Web: Vite dev server on :5173
2. Server: Socket.io server on :4000 (configurable)

## Environment Variables (Vite)
Create `web/.env` from `.env.sample` before running the web app.

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_SOCKET_URL=http://localhost:4000
```

## Scripts (after scaffolding)
- Web: `npm run dev` (inside `web/`)
- Server: `npm run dev` (inside `server/`)

## Notes
- No secrets are committed; use `.env` locally and keep it private.
- Firebase project setup, Hosting deployment, Functions, and FCM setup can be added after initial UI and Socket layer are in place.