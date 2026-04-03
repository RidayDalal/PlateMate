# PlateMate

**PlateMate** is a full-stack “editorial kitchen” web app that turns ingredients in your fridge into dish ideas and detailed recipes—optionally anchored to a real cooking video so written steps and what you watch stay aligned.

Built for **intentional cooking**: clear structure, optional **visual learning**, **allergy- and diet-aware** AI, and a **personal cookbook** that stores the exact recipe HTML and video reference you saved.

---

## At a glance

| Aspect | Summary |
|--------|---------|
| **Stack** | Node.js (ESM), Express, PostgreSQL, OpenRouter LLM, YouTube Data API |
| **Auth** | Session cookies, bcrypt password hashing, gated UI |
| **Frontend** | Static HTML/CSS/JS, Tailwind + DaisyUI (CDN) |

---

## System architecture

End-to-end flow for the **video masterclass** path (text-only recipe skips YouTube/transcript steps):

```text
User search / dish selection
        ↓
YouTube Data API (search + duration filter, embeddable videos)
        ↓
Transcript extraction (captions via youtube-transcript)
        ↓
LLM refinement (OpenRouter — structured recipe from transcript + user constraints)
        ↓
PostgreSQL storage (video cache, optional saved recipe snapshots)
```

| Stage | Role |
|-------|------|
| **User search** | Ingredient/cuisine-driven **Find Recipes** (up to six dishes) and per-dish **Explain** with optional video. |
| **YouTube API** | Resolves a tutorial `video_id`, with server-side caching to limit repeat API calls. |
| **Transcript extraction** | Pulls captions when available so the model can ground the recipe in what the video actually shows. |
| **LLM refinement** | Produces HTML recipe text with allergy/diet context from the user profile. |
| **PostgreSQL** | Persists users, `recipe_requests` cache (`recipe_name` → `video_id`), and **saved recipes** (HTML + `video_id`). |

---

## Performance and optimization

| Technique | What it does |
|-----------|----------------|
| **`Promise.all`** | The client **auth loading** overlay runs the minimum display timer and the auth/network `task()` **in parallel**, so the UI is not blocked on an artificial delay alone (`public/auth-loading.js`). |
| **Ordered server pipeline** | The video masterclass route **sequences** YouTube lookup → transcript → LLM so the recipe stays faithful to the selected video; this is intentional, not parallel AI + video on the wire. |
| **SQL `ON CONFLICT`** | **Video cache:** `INSERT … ON CONFLICT (recipe_name) DO UPDATE` on `recipe_requests` upserts cached `video_id` values. **Saved recipes:** upsert on `(user_id, recipe_name)` avoids duplicate rows and supports idempotent saves. |

Together, caching and upserts cut redundant YouTube and duplicate rows; the client uses `Promise.all` where independent promises can safely run together.

---

## Security

| Measure | Details |
|---------|---------|
| **Password hashing** | Passwords are hashed with **bcrypt** (`bcryptjs`) before storage; plaintext passwords are not persisted. |
| **Secrets and API keys** | **`.env`** holds `OPENROUTER_API_KEY`, `YOUTUBE_API`, `SESSION_SECRET`, and database credentials. The file is **gitignored**—never commit real secrets. |
| **Sessions** | `express-session` with a configurable secret; use HTTPS and strict cookie settings in production. |

---

## Features (product)

- **Sign up / log in** — Editorial-style gated shell; **allergies** (multi-select) and **dietary restriction** feed the AI on every session.
- **Find Recipes** — Cuisine, servings, ingredients; server enforces **at most six** dish suggestions.
- **Generate Text Recipe** — Fast path without YouTube.
- **Generate Video Masterclass** — Embeddable tutorial, duration filter, transcript-grounded recipe when captions exist; fallback recipe if no transcript.
- **Save recipes** — Stores name, HTML body, and `video_id` for instant reload without re-calling the AI or YouTube.
- **Profile** — Edit name, email, allergies, diet (password changes not on that page).

---

## Prerequisites

- **Node.js** v18+ (v20+ is fine)
- **PostgreSQL** 11+
- API keys: **OpenRouter**, **YouTube Data API v3**

---

## Setup guide

### 1. Install dependencies

```bash
cd PlateMate
npm install
```

### 2. Environment variables

Create a **`.env`** file in the **`PlateMate/`** directory (same level as `package.json`). Do not commit it.

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `YOUTUBE_API` | Yes | YouTube Data API v3 key |
| `SESSION_SECRET` | Strongly recommended | Secret for signing session cookies |
| `DB_USER` | Optional | PostgreSQL user (default: `postgres`) |
| `DB_PASSWORD` | Optional | PostgreSQL password |
| `DB_HOST` | Optional | Host (default: `localhost`) |
| `DB_DATABASE` | Optional | Database name (default: `platemate`) |
| `PORT` | Optional | HTTP port (default: `3000`) |
| `OR_MODEL_ID` | Optional | OpenRouter model id |

Example skeleton:

```env
OPENROUTER_API_KEY=sk-or-...
YOUTUBE_API=...
SESSION_SECRET=change-me-to-a-long-random-string
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_DATABASE=platemate
PORT=3000
```

### 3. Initialize PostgreSQL

1. Create an empty database (e.g. `createdb platemate` or via your admin tool).
2. Apply the **repository-root** `schema.sql` (one directory **above** `PlateMate/`) to create the `recipe_requests` video cache table:

   From the **kitchen** repo root:

   ```bash
   psql -U postgres -d platemate -f schema.sql
   ```

   From inside **`PlateMate/`**:

   ```bash
   psql -U postgres -d platemate -f ../schema.sql
   ```

3. Apply SQL migrations under **`PlateMate/migrations/`** for users and saved recipes (run in order; `002` is the main gated-app schema):

   ```bash
   psql -U postgres -d platemate -f migrations/002_gated_users_saved_recipes.sql
   ```

   Use `001_saved_recipes_recipe_text_video_id.sql` only if you are upgrading an older database.

Alternatively, after `.env` is set:

```bash
node scripts/apply-gated-schema.js
```

The server may add missing profile columns on startup; for a clean install, applying the SQL above is the most reliable approach.

### 4. Run the app

```bash
npm run dev
```

Open **http://localhost:3000** (or your `PORT`). Use `npm start` for production-style run without nodemon.

---

## Project layout

```
PlateMate/
├── server.js              # Express, routes, AI, YouTube, DB
├── package.json
├── .env                   # Local secrets (gitignored)
├── migrations/            # PostgreSQL migrations
├── scripts/               # Optional DB helpers
└── public/                # Static UI (index, profile, app.js, auth-loading.js, …)
```

`schema.sql` for `recipe_requests` lives at **`../schema.sql`** relative to `PlateMate/` (repository root).

---

## API overview

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/register` | Register + session |
| `POST` | `/api/login` | Login + session |
| `POST` | `/logout` | Destroy session |
| `GET` | `/me` | Current user or `null` |
| `PATCH` | `/api/profile` | Update profile (not password) |
| `POST` | `/find-recipes` | Auth required; dish suggestions |
| `POST` | `/explain-dish` | Auth required; recipe body + optional `video_id` |
| `POST` | `/api/save-recipe` | Save recipe snapshot |
| `GET` | `/api/saved-recipes` | List saved |
| `GET` | `/api/saved-recipe/:id` | Load one from DB |
| `DELETE` | `/api/saved-recipe/:id` | Remove saved |

Use `credentials: 'same-origin'` on the client for cookie-backed routes.

---

## Screenshots (Editorial UI)

Drop final assets under e.g. `docs/screenshots/` and wire them into this section (or use your repo’s preferred path).

| Screen | Placeholder |
|--------|-------------|
| **Home Page** | *Add `docs/screenshots/home.png` — editorial gated home / recipe dashboard.* |
| **Search Results** | *Add `docs/screenshots/search-results.png` — Find Recipes result list.* |
| **Recipe Masterclass** | *Add `docs/screenshots/masterclass.png` — embedded video + recipe panel.* |

Example markdown once files exist:

```markdown
![PlateMate home](docs/screenshots/home.png)
```

---

## Limitations

- Recipe quality depends on the **LLM** and prompts; verify food safety and allergens yourself.
- YouTube **transcripts** are not available on every video; the app may fall back to a generated recipe while still showing a video.
- **OpenRouter** and **YouTube** quotas and pricing apply—monitor provider dashboards.

---

## License

ISC (see `package.json`). Add your name and year if you publish formally.

---

*PlateMate — cook with precision, plate with confidence.*
