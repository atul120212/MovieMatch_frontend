# MovieMatch 🍿 — Next.js Frontend

This is the client-side Next.js web application for MovieMatch, providing a premium, high-fidelity user interface featuring glassmorphic design, dynamic touch/keyboard gestures, real-time feedback, and high-performance rendering.

---

## ✨ Features

- **Interactive Lobby:** Select your movie vibes (favorite genres) to customize the group recommendation pool in real-time.
- **WebSocket Synchronization:** Instant updates showing which players have joined, their genre preferences, and live swiping progress.
- **Premium Swipe Deck:** High-fidelity gesture-ready swiping interface with full keyboard support (`←` for Dislike, `→` for Like).
- **Match Reveal Animations:** Visual confetti bursts and a premium card layout displaying the unanimous match or top scoring runner-ups.
- **Robust Asset Loading:** Automatic image loading error detection that swaps in clean fallback cards if TMDB movie posters fail to render.

---

## 📂 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root HTML layout and Google Fonts (Outfit, Inter)
│   │   ├── globals.css        # Core stylesheet (CSS Variables, glassmorphism)
│   │   ├── page.tsx           # Home view: create room and guest direct join
│   │   └── room/[code]/
│   │       └── page.tsx       # Main room component (handles WebSocket connection & page states)
│   └── components/
│       ├── SwipeDeck.tsx      # Movie card swiper with keyboard events and status updates
│       └── Confetti.tsx       # Canvas confetti renderer for matches
├── public/                    # Static assets
├── vercel.json                # Vercel security headers and clean URL configuration
└── tsconfig.json              # TypeScript compilation setup
```

---

## 🛠️ Getting Started

### 1. Install Dependencies
Make sure you have Node.js (v18+) installed, then run:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the `frontend/` directory:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```
*(Make sure there is no trailing slash on the backend URL).*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🚀 Deployment (Vercel)

The Next.js frontend is fully optimized for **Vercel**:
1. Connect your repository to Vercel.
2. Select `frontend` as the **Root Directory**.
3. In **Environment Variables**, configure:
   - `NEXT_PUBLIC_BACKEND_URL`: URL of your deployed backend (e.g., `https://moviematch-backend.onrender.com`).
4. Click **Deploy**.
