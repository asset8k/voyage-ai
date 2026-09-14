# Voyage AI

> An AI-assisted travel planner that turns a structured trip brief and optional inspiration files into a practical, map-ready itinerary.

**Live application:** [voyage-ai-kz.vercel.app](https://voyage-ai-kz.vercel.app/)

Voyage AI is an end-to-end applied AI project built around a simple product question: how do you make an LLM itinerary useful enough to save and follow? The answer is not just a prompt. The application combines structured generation, deterministic validation, live tool data, place resolution, authentication, persistence, and a React interface for exploring or managing trips.

**Python 3.12 · FastAPI · Pydantic v2 · OpenAI Responses API · PostgreSQL · async SQLAlchemy · Alembic · React 19 · TypeScript · Google Maps & Places**

## Contents

- [What the product does](#what-the-product-does)
- [Product screenshots](#product-screenshots)
- [Architecture](#architecture)
- [AI generation pipeline](#ai-generation-pipeline)
- [API and product behaviour](#api-and-product-behaviour)
- [Security and data handling](#security-and-data-handling)
- [Observability, testing, and known limits](#observability-testing-and-known-limits)
- [Run locally](#run-locally)
- [Project structure](#project-structure)

## What the product does

A traveller provides a destination, date range, budget, currency, number of travellers, pace, and free-text preferences. They can optionally attach up to three JPG, PNG, or PDF files as inspiration. Voyage AI returns a complete plan with:

- a dated, chronological schedule of activities;
- daily and whole-trip cost estimates in the requested currency;
- packing guidance, caveats, and planning assumptions;
- optional current weather and exchange-rate context where useful;
- map-ready locations resolved to real Google Places coordinates; and
- an interactive map, public community feed, saved-trip library, refinement flow, and owner controls.

Visitors can generate plans without an account. Registering enables saving plans, changing a saved trip’s title or public visibility, refining its itinerary, and deleting it. Public trips can be viewed in the feed by anyone; private trips remain visible only to their owner.

## Product screenshots

### Structured trip input

![Trip-planning form with destination, dates, budget, traveller count, preferences, and optional inspiration files](docs/screenshots/plan-trip-form.png)

Generation begins with explicit, typed inputs rather than an open-ended chat box. The form submits `multipart/form-data`, so a traveller can add visual or PDF inspiration alongside the trip brief without making those files persistent user content.

### Account and saved-trip access

![Voyage AI sign-in screen](docs/screenshots/authentication.png)

Signing in restores the current user and unlocks the personal trip library. From a saved itinerary, an owner can rename it, choose whether it appears in the public feed, refine the itinerary with AI, or delete it. Those state-changing controls are deliberately absent from public trip pages.

### Community feed

![A populated Voyage AI community feed with public journeys](docs/screenshots/explore-feed.png)

The feed is sourced from `GET /api/trips/feed`, which returns only trips whose owners explicitly enabled `is_public`. It intentionally exposes a smaller public view of each plan rather than the owner’s editable record.

### Map-ready itinerary

![A public Lisbon itinerary with selectable day schedule and mapped locations](docs/screenshots/itinerary-map.png)

The map is not based on coordinates invented by the model. The planner produces narrow `map_queries` only for fixed places; the backend then resolves them with Google Places Text Search and sends the resulting coordinates to the frontend. The same route opens in a full-screen dialog with numbered stops and direct Google Maps links.

### Expanded route map

![Full-screen Lisbon route map with three numbered, map-ready stops](docs/screenshots/fullscreen-map.png)

The expanded view keeps the itinerary visible in the background while focusing on the active day’s route. Each numbered stop matches the list below the map and links to the corresponding real place in Google Maps.

### Multimodal inspiration

![Trip form showing optional JPG, PNG, and PDF inspiration files before generation](docs/screenshots/multimodal-input.png)

The same request can include up to three JPG, PNG, or PDF files. The API validates type, file signature, count, and size before passing the attachment bytes to the model as temporary reference context. Attachments are not stored with the saved trip.

## Architecture

```mermaid
flowchart LR
    browser[React + TypeScript client]
    api[FastAPI API]
    validation[Pydantic request and plan validation]
    planner[Planner and refiner]
    openai[OpenAI Responses API\nstructured TripPlan output]
    weather[Open-Meteo\nweather forecast]
    rates[Frankfurter\nexchange rates]
    places[Google Places\nText Search]
    db[(PostgreSQL)]

    browser -->|multipart generation request| api
    api --> validation
    validation --> planner
    planner -->|structured generation| openai
    openai <-->|function calls| planner
    planner --> weather
    planner --> rates
    planner -->|validated plan + map queries| places
    places -->|enriched TripPlan| api
    api --> browser

    browser -->|JWT-authenticated save, refine, edit, delete| api
    api <--> db
```

The backend owns the boundary between probabilistic and deterministic work:

| Concern | Design decision |
| --- | --- |
| Itinerary content | LLM generates a typed `TripPlan`, not free-form prose. |
| Business invariants | Pydantic validates dates, totals, daily costs, field sizes, and output shape. |
| Live facts | The model may call weather and currency tools; provider failures become explicit unavailable context rather than application failures. |
| Map data | The model suggests searchable place queries; Google Places supplies IDs, addresses, and coordinates. |
| User data | PostgreSQL stores original input and the final JSON plan; uploaded files are temporary generation context only. |
| Access control | JWT-protected owner routes enforce save, update, refine, and delete permissions. |

## AI generation pipeline

### 1. A validated input, not an unbounded chat message

`TripGenerationRequest` is assembled from a multipart form request. It requires a destination, valid date range, positive decimal budget, ISO-style three-letter currency, traveller count, pace, and preferences. This makes the model’s input predictable and keeps the generated output tied to a concrete brief.

Optional inspiration attachments are validated before they reach the model:

- at most three files;
- JPG, PNG, or PDF only;
- a 10 MB limit per file; and
- file-signature checks in addition to the submitted MIME type.

Files are encoded for the OpenAI request and are never stored in the application database.

### 2. Modular prompt policy

[`src/voyage_ai/ai/prompts.py`](src/voyage_ai/ai/prompts.py) separates shared constraints from the planner and refiner roles. The instructions cover scheduling, costs, uncertainty, map-query quality, uploaded-file boundaries, and tool use.

The original request is the source of truth. In particular, refinement updates the itinerary but preserves the original destination, travel dates, traveller count, currency, and budget. A traveller who needs to change those settings creates a new plan instead of silently changing the saved trip’s brief.

### 3. Structured output and semantic checks

The OpenAI Responses API is asked to parse directly into the Pydantic `TripPlan` schema. The application then enforces cross-field rules that a JSON schema alone cannot guarantee:

- each day’s estimated cost must cover its listed activity costs;
- the budget categories must add up to `budget.total`; and
- the sum of every daily cost must equal `budget.total` within a small rounding tolerance.

If the model returns an otherwise complete plan with inconsistent arithmetic, the backend makes **one** bounded repair request containing the rejected draft and the original context. The correction prompt only asks it to reconcile totals while preserving useful itinerary content. A second invalid response is rejected instead of retried indefinitely.

### 4. Tool-grounded travel context

The first model response can request function calls. The backend executes supported tools, returns their JSON output to the same response chain, then asks the model for the final typed plan.

| Tool | Why it exists | Failure behaviour |
| --- | --- | --- |
| Open-Meteo weather | Informs packing and outdoor planning for dates within the available forecast window. | Returns an `available: false` result for unavailable dates, locations, or provider errors. |
| Frankfurter exchange rate | Gives the model current local-price context when the requested budget currency differs from the local currency. | Returns an unavailable result; all itinerary prices still remain in the user’s requested currency. |
| Google Places Text Search | Resolves planner-supplied fixed places into real names, IDs, addresses, latitude, and longitude. | A failed lookup leaves that place off the map without failing trip generation. |

Place resolution is deliberately post-generation rather than an LLM tool call for every activity. This avoids paying for model reasoning around generic actions such as “walk around the neighbourhood,” while still mapping landmarks, squares, museums, parks, and meaningful terminals.

### 5. Persist and refine

When an authenticated user saves a plan, the application stores both the **original generation request** and the **current trip plan** as JSONB. The original brief remains available during refinement, so the refiner has a reliable constraint set instead of trusting the editable current itinerary alone. Every refined result is validated and passed through place enrichment again.

## API and product behaviour

FastAPI provides interactive OpenAPI documentation locally at [`/docs`](http://localhost:8000/docs).

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | Health check for hosting. |
| `POST` | `/api/auth/register` | No | Create a username/password account. |
| `POST` | `/api/auth/login` | No | Receive a bearer access token. |
| `GET` | `/api/auth/me` | Bearer token | Restore the current user. |
| `POST` | `/api/trips/generate` | No | Generate a transient plan from multipart form fields and optional files. |
| `POST` | `/api/trips` | Bearer token | Save a generated request and plan. |
| `GET` | `/api/trips/mine` | Bearer token | List the current user’s saved trips. |
| `GET` | `/api/trips/feed` | No | List public trip summaries. |
| `GET` | `/api/trips/{trip_id}` | Optional token | Read a public trip, or a private trip as its owner. |
| `PATCH` | `/api/trips/{trip_id}` | Bearer token | Update a trip title and/or public visibility. |
| `DELETE` | `/api/trips/{trip_id}` | Bearer token | Delete an owned trip. |
| `POST` | `/api/trips/{trip_id}/refine` | Bearer token | Apply a text refinement to an owned trip. |

`POST /api/trips/generate` is deliberately separate from `POST /api/trips`: generation is available to guests and does not create a database record. Saving is an explicit authenticated action from the UI.

## Security and data handling

- Passwords are hashed with Argon2 through `pwdlib`; plaintext passwords are never stored.
- Authentication uses signed JWT bearer tokens with an expiry configured through environment variables.
- Private trips return `404` to non-owners, avoiding disclosure of private record existence.
- CORS origins are environment-configured rather than hard-coded in the deployed API.
- Secrets live in `.env`, which is gitignored. The repository contains only `.env.example` templates.
- The browser Maps key is necessarily visible to the browser, so it should be restricted in Google Cloud to approved frontend origins and the Maps JavaScript API.

## Observability, testing, and known limits

### Runtime signals

Each generation and refinement logs the selected model, end-to-end latency, API-call count, tool-call count, and input/output/total token counts. This makes the two-call tool flow and the bounded repair path observable in production logs without exposing those internal details to end users.

### Automated tests

The backend suite covers:

- authentication, duplicate users, invalid credentials, and JWT-protected current-user access;
- generation request validation, multipart attachment forwarding, and provider failures;
- public/private visibility plus owner-only update, delete, and refine actions;
- output-schema and cross-field budget invariants;
- planner tool-loop behaviour and invalid-plan repair; and
- upload validation and Google Places response handling.

The frontend Vitest suite covers API calls, auth restoration, generated-plan saving, trip management, map interaction, form controls, page transitions, and error states.

### Deliberate limits and next improvements

- Weather data is a forecast, not historical weather; dates outside the provider’s forecast window are clearly represented as unavailable.
- The UI gives feedback while generation runs, but the backend does not yet stream model tokens or fine-grained progress events.
- There is no formal human-rated itinerary-quality evaluation set or model-comparison benchmark yet. The current quality guardrails are schema tests, deterministic validation, and manual product checks.
- JWTs are bearer tokens; a production system with broader exposure should consider refresh-token rotation and HTTP-only cookie storage.
- Rate limiting is not yet distributed. An in-memory limiter would not coordinate across multiple API instances.
- Google and OpenAI integrations require billing/quota controls and properly restricted API keys in a real deployment.

## Run locally

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- PostgreSQL
- OpenAI and Google Cloud API keys

### 1. Configure and run the API

```bash
git clone https://github.com/asset8k/voyage-ai.git
cd voyage-ai

uv sync
cp .env.example .env
```

Set the following values in `.env`:

```dotenv
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/voyage_ai
JWT_SECRET_KEY=generate-with-openssl-rand-hex-32
OPENAI_API_KEY=...
GOOGLE_PLACES_API_KEY=...
CORS_ORIGINS=http://localhost:5173
```

Then migrate and start FastAPI:

```bash
uv run alembic upgrade head
uv run uvicorn voyage_ai.main:app --reload
```

The API is available at `http://localhost:8000`; interactive API documentation is at `http://localhost:8000/docs`.

### 2. Configure and run the web client

Open a second terminal:

```bash
cd frontend/app
npm ci
cp .env.example .env
```

Set the frontend environment variables:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
VITE_GOOGLE_MAPS_API_KEY=...
```

Start Vite:

```bash
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`).

### 3. Run checks

```bash
# Repository root
uv run pytest -q

# Frontend
cd frontend/app
npm run test
npm run lint
npm run build
```

## Project structure

```text
.
├── src/voyage_ai/
│   ├── ai/          # Prompts, structured schemas, planner, tools, upload validation
│   ├── auth/        # Registration, login, JWT dependencies, password security
│   ├── places/      # Google Places resolution and plan enrichment
│   ├── trips/       # API routes, service layer, persistence model, API schemas
│   ├── users/       # User ORM model and response schemas
│   ├── config.py    # Environment-backed settings
│   ├── database.py  # Async SQLAlchemy engine and sessions
│   └── main.py      # FastAPI application and CORS setup
├── migrations/       # Alembic PostgreSQL migrations
├── tests/            # Backend unit and API tests
├── frontend/app/
│   └── src/          # React pages, auth state, API client, maps, component tests
├── docs/screenshots/ # Portfolio screenshots used in this README
├── .env.example
└── pyproject.toml
```

---

Built as an applied AI engineering portfolio project: the goal is not merely to call a model, but to make model output observable, constrained, useful in a product flow, and safe to persist.
