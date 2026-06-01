# Project Details

This document provides a detailed description of Travel From Photo, covering the project's motivation, the problems it addresses, the implemented solution, and the current feature set as of the final release.

## 1. Project Introduction

Travel From Photo is an AI-powered web application that helps users recover the location of a travel photo using a combination of image metadata, computer vision, and large language model reasoning. Users upload a photo, and the system returns a ranked list of likely location candidates by fusing signals from multiple external APIs and a locally-run vision model. The results can be saved to a personal gallery, used to generate AI-written travel journals, and shared through tag-based live chat lounges.

## 2. Problem

Travelers frequently take photos during trips, but location information is often lost or forgotten once photos are moved between devices or shared on social media. EXIF GPS coordinates may be stripped or simply absent, and the visual appearance of many real-world places is too generic for conventional image recognition to reliably identify.

Existing image search tools tend to treat location identification as a single-step classification task. When the scene lacks obvious landmarks — or when the landmark appears in a visually similar form across many global locations — these tools fail with little explanation and no confidence signal. Users are left with no actionable result and no way to provide additional context to improve accuracy.

There is a need for a system that handles location uncertainty gracefully, incorporates user-provided hints, fuses multiple independent signals, communicates its confidence level honestly, and exploits the fact that a single trip usually produces a cluster of nearby photos.

## 3. Solution

Travel From Photo approaches location identification as a multi-tier signal fusion problem rather than a single classification step. The backend processes each uploaded image through up to four sequential tiers, stopping early when a confident result is found:

- **Tier 0 — EXIF GPS**: If the image contains embedded GPS coordinates, the system resolves the location directly using reverse geocoding and Google Places, bypassing all later tiers.
- **Tier 1 — Visual signals (parallel)**: Google Vision API is queried in parallel for landmark detection, logo detection, OCR text extraction (with country-specific language hints), and web entity matching. Web Detection emits multiple sub-signals (best guess, top entities, page titles) calibrated by match strength. All raw signals pass through a noise filter that rejects file names, mixed-script OCR garbage, and URL fragments before geocoding. The remaining signals are clustered by Google place_id or by proximity (~1 km bucket).
- **Tier 2 — GPT main voter**: Before prompting GPT-4o, the backend calls Google Vision Label Detection and extracts the top visible labels (Bridge, Beach, Mountain, Temple, etc.). These are passed to GPT-4o as a hard visual constraint so candidate proposals must match what is actually in the photo. GPT-4o is invoked as an independent voter that does not see Tier 1's candidates, preventing double-counting.
- **Tier 3 — GPT arbiter**: A second OpenAI call re-ranks the existing candidate set but is not allowed to invent new candidates. This eliminates hallucination risk at the final ranking step.

Each tier has its own outer timeout and falls back to the best-available candidates if a service is unavailable, so the system always returns a usable response.

When the user uploads multiple photos in a single Search call, a frontend post-processing step runs after the per-photo responses arrive:

- It computes the **median latitude/longitude** of every photo whose top candidate was identified confidently.
- It then multiplies the score of every candidate (top and alternates) in every photo by a distance-based factor (5/20/100/500 km bands at ×1.35 / 1.20 / 1.00 / 0.65 / 0.35), pulling weak photos toward the cluster and pushing far-away alternates down.
- Photos whose top candidate still disagrees with the cluster are re-analyzed through Tier 2 with the cluster's dominant country/city forced as the hint.

This cross-image post-processing compensates for the inherent variance of probabilistic Vision APIs — the same place photographed from a different angle can produce very different Web Detection or Landmark Detection responses on its own, but consistent ones across the trip.

## 4. Implemented Features

### 4.1 Travel Photo Search

Users upload one or more travel photos with optional country or city hints. The backend runs the multi-tier pipeline and returns a ranked list of location candidates, each with a place name, address, coordinates, confidence score, the contributing signal sources, and a verdict band (`confident` / `likely` / `suggestions` / `failed`).

The results page shows the top candidate on an interactive Leaflet map and lists alternative candidates below. The user can:

- Edit the top match's place name inline.
- Drop the map pin to a new coordinate (the backend reverse-geocodes the new location).
- Re-search a single weak photo with an extra hint without re-uploading the others.
- Expand a "How we got this result" diagnostic panel that lists every signal source that contributed (✓) or stayed silent (—), with an actionable tip when the result is weak.
- Save individual matches, or use "Save all" to write every top match to the gallery grouped by city.
- Click a recommended chat lounge to jump straight to the matching room.

### 4.2 Personal Gallery

Authenticated users can save any location result from a search to their personal gallery. Each saved place stores the photo, the resolved place name, address, coordinates, the user's collection grouping, and a privacy level (private / unlisted / public).

Gallery behaviors:

- Browse saved places organized into named collections, with each collection card showing a cover thumbnail and the dominant country.
- Create empty collections from the gallery page (kept in local browser storage until the first save lands).
- Rename collections, delete entire collections, or move individual photos between collections.
- Click a photo card to open a full-screen image viewer with left/right keyboard navigation and ESC to close.
- Set a default privacy level in Settings that is automatically applied to new saves.

### 4.3 Travel Journal

Users can select photos from their gallery and request journal generation. Only photos whose original EXIF carried real GPS coordinates are journal-eligible; the picker disables ineligible photos with a "no GPS" label so the constraint is visible upfront. (Date is not required — undated photos are still eligible and placed in API order.)

The system processes each selected photo through a background job:

- CLIP (ViT-B/32) runs locally and produces multi-label classifications for three axes: subject, atmosphere, and activity, using a fixed vocabulary.
- OpenAI Vision (GPT-4.1-mini) generates a narrative journal entry for each photo conditioned on the CLIP labels and the resolved place name.
- The structured output (CLIP arrays, GPT categorical fields, and narrative text) is stored as one row in `journal_entries`.

The resulting journal is presented as a diary-style viewer: one photo and one narrative entry per page, with prev/next arrow navigation, keyboard support, a dot indicator, and an inline-editable title. A "View on map" overlay shows numbered pins for every entry with GPS, connected by a dotted route line; hover tooltips display the place name and a journal text excerpt.

The Journal section also includes:

- A **stats dashboard** showing travel patterns across all of the user's journals (countries, cities, photo count, total distance traveled), rendered as four gamified level bars (Lv 1–5 each) so the user has a long-term progression target.
- A **pie chart** view of the subject / atmosphere / activity label distributions.
- An **AI-generated destination recommendation** based on the user's travel history, with each recommendation accompanied by a representative photo fetched from Wikipedia (summary API + search API fallback for fuzzy matches).

### 4.4 Tag-Based Live Chat

The Live Chat feature provides 13 permanent tag-based lounges organized into four categories (Nature, Urban, Culture, Experience). Each lounge corresponds to a travel tag key (e.g., beach, historical, food, sunset). After a Search result is returned, the results page links directly to the lounge matching the photo's tags so users can discuss related travel experiences with people interested in the same kind of place.

Chat uses WebSocket connections for real-time message delivery with automatic fallback to REST polling when WebSocket is unavailable. Users can attach photos from their personal gallery to chat messages; server-side ownership verification rejects attempts to attach photos that do not belong to the sender. All lounge messages are stored in PostgreSQL and persist between sessions even when no users are online.

### 4.5 Profile and Settings

Each user has a profile with a display name, bio, and email. The Settings page allows users to:

- Update display name, bio, and email.
- Change the default gallery privacy level (private / unlisted / public) used for new saves.
- Switch the interface theme (light / dark / system); the new theme is applied immediately on save and restored on the next login.
- Toggle email notifications.
- Submit bug reports that are routed to the admin moderation queue.

### 4.6 Admin Panel

Admin users have access to a separate management panel that provides:

- A summary dashboard showing total users, active users, disabled accounts, open moderation items, and total chat messages.
- A user management table with case-insensitive search, role assignment (traveler or admin), and account enable/disable controls. The handler refuses to disable the caller's own account to prevent self-lockout.
- A moderation queue displaying all submitted bug reports and admin-created moderation cases, with the ability to resolve individual items.

Admin access is enforced at two layers: the frontend route guard (`/admin` redirects non-admins to the home page) and a `require_admin` FastAPI dependency on every admin endpoint, so a UI bypass cannot escalate privilege.

## 5. User Roles

### Traveler (Default)
- Register an account and log in via email OTP verification.
- Upload travel photos for location analysis (single or batch).
- Save location results to a personal gallery organized into collections.
- Generate AI travel journals from gallery photos (subject to the EXIF GPS eligibility rule).
- View travel statistics with progression levels and receive destination recommendations.
- Join tag-based live chat lounges and share gallery photos in chat.
- Manage profile, display settings, and privacy defaults.
- Submit bug reports to the admin team.

### Admin
- All traveler capabilities.
- Access the admin panel to view user accounts and assign or revoke admin roles.
- Enable or disable user accounts (except their own).
- View and resolve the moderation queue, including bug reports submitted by users.

## 6. Features Not in Current Release

The following items were considered during early planning but were descoped from the final implementation. They are listed here so reviewers can compare the original plan to the shipped product without spelunking through commit history.

- **Food / restaurant-specific search pipeline**: Early designs included a dedicated pipeline for restaurant identification from food photos. The general Search pipeline handles food photos as long as a logo or menu OCR triggers; the dedicated branch was descoped to keep the main flow strong.
- **Route generation (Google Directions)**: Routing from a detected location to a destination was planned but not implemented. The product turned out to be about *recovering* past locations rather than navigating to new ones. Map visualization of saved places and journal GPS data is included instead.
- **Manual destination entry**: Direct text-based location lookup without an image upload is not currently supported. Users provide country and city hints alongside an image to improve accuracy.
- **Burst-shot Observation Layer and stay/transit segment classifier**: The early Journal design included a multi-stage observation/segment classifier with POI enrichment and document understanding. This was simplified to a per-photo pipeline because the test photo set lacked the second-precise EXIF timestamps required for reliable burst detection.
- **Weather lookup in journal entries**: `weather_service.py` exists but is not yet wired into journal generation. Marked as a future extension.

A more complete deferral table with reasons is provided in Section 12 of `docs/system-architecture.md`.

## 7. Related Documents

- `README.md` — Setup, build, and test instructions for new developers.
- `docs/system-architecture.md` — Technology stack, backend module map, full Search pipeline, database schema, deployment topology, and original-vs-implemented descope table.
- `docs/API_DESIGN_FINAL.md` — Full API endpoint reference.
- `docs/LIVE_CHAT_TAG_LOUNGES.md` — Live Chat tag system design and lounge definitions.
- `docs/COMPLETE_DEPLOYMENT_GUIDE.md` — End-to-end deployment walkthrough.
- `docs/FINAL_DEPLOYMENT_CHECKLIST.md` — Pre-deployment verification checklist.
- `docs/FINAL_TEST_PLAN.md` — Manual test plan for all major features.
- `docs/BUG_TRACKING.md` — Bug-reporting process and severity labels.
