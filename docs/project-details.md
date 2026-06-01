Project Details
This document provides a detailed description of Travel From Photo, covering the project's motivation, the problems it addresses, the implemented solution, and the current feature set as of the final release.

1. Project Introduction
Travel From Photo is an AI-powered web application that helps users recover the location of a travel photo using a combination of image metadata, computer vision, and large language model reasoning. Users upload a photo, and the system returns a ranked list of likely location candidates by fusing signals from multiple external APIs and a locally-run vision model. The results can be saved to a personal gallery, used to generate AI-written travel journals, and shared through tag-based live chat lounges.

2. Problem
Travelers frequently take photos during trips, but location information is often lost or forgotten once photos are moved between devices or shared on social media. EXIF GPS coordinates may be stripped or simply absent, and the visual appearance of many real-world places is too generic for conventional image recognition to reliably identify.

Existing image search tools tend to treat location identification as a single-step classification task. When the scene lacks obvious landmarks — or when the landmark appears in a visually similar form across many global locations — these tools fail with little explanation and no confidence signal. Users are left with no actionable result and no way to provide additional context to improve accuracy.

There is a need for a system that handles location uncertainty gracefully, incorporates user-provided hints, fuses multiple independent signals, and communicates its confidence level honestly when returning results.

3. Solution
Travel From Photo approaches location identification as a multi-tier signal fusion problem rather than a single classification step. The backend processes each uploaded image through up to four sequential tiers, stopping early when a confident result is found:

Tier 0 — EXIF GPS: If the image contains embedded GPS coordinates, the system resolves the location directly using reverse geocoding and Google Places, bypassing all later tiers.
Tier 1 — Visual signals: Google Vision API is queried in parallel for landmark detection, logo detection, label detection, OCR text extraction, and web entity matching. A locally-run CLIP model (ViT-B/32) provides visual similarity scoring. All results are normalized into candidate signals.
Tier 2 — GPT main voter: OpenAI Vision (GPT-4.1-mini) analyzes the image alongside collected signals and proposes candidate locations with reasoning.
Tier 3 — GPT arbiter: A second OpenAI call re-ranks the merged candidate set to produce a final confidence-ordered result.
Each tier has an individual timeout and falls back to best-available candidates if a service is unavailable, ensuring the system always returns a usable response.

4. Implemented Features
4.1 Travel Photo Search
Users upload one or more travel photos with optional country or city hints. The backend runs the multi-tier pipeline and returns a ranked list of location candidates, each with a place name, address, coordinates, confidence score, and the signals that contributed to the result. Multiple photos from the same trip can be uploaded together, and their candidates are cross-weighted to improve accuracy.

After a successful search, the results page shows the top candidate on an interactive map and lists alternative candidates below. The system also produces tag labels (e.g., historical, urban, food) from the analysis, which are used to recommend relevant chat lounges.

4.2 Personal Gallery
Authenticated users can save any location result from a search to their personal gallery. Each saved place stores the photo, the resolved place name, address, coordinates, and the user's collection grouping. Users can:

Browse saved places organized into named collections.
Rename and delete collections.
View saved place photos and map pins.
Set a default privacy level (private, unlisted, public) that is automatically applied to new saves.
4.3 Travel Journal
Users can select photos from their gallery and request journal generation. The system processes each photo through a background job that:

Runs CLIP inference to classify the photo's subject, atmosphere, and activity characteristics.
Calls OpenAI Vision (GPT-4.1-mini) to generate a narrative journal entry for each photo based on the CLIP labels and location context.
Stores the structured output (CLIP labels, GPT categorical fields, and narrative text) per entry.
The resulting journal is presented as a visual diary, one photo and text per entry, with a route map for entries that have GPS coordinates. Users can edit the journal title and individual entry texts after generation.

The Journal section also includes a statistics dashboard showing travel patterns across all journals (countries visited, cities, photo count, total distance, and distribution charts for subject and atmosphere labels), and an AI-generated destination recommendation based on the user's travel history.

4.4 Tag-Based Live Chat
The Live Chat feature provides 13 permanent tag-based lounges organized into four categories (Nature, Urban, Culture, Experience). Each lounge corresponds to a travel tag key (e.g., beach, historical, food, sunset). After a Search result is returned, the results page links directly to the lounge matching the photo's tags so users can discuss related travel experiences.

Chat uses WebSocket connections for real-time message delivery with automatic fallback to REST polling when WebSocket is unavailable. Users can also attach photos from their personal gallery to chat messages, with server-side ownership verification. All lounge messages are stored in PostgreSQL and persist between sessions even when no users are online.

4.5 Profile and Settings
Each user has a profile with a display name, bio, and email. The Settings page allows users to:

Update their display name, default gallery privacy level, and interface theme (light, dark, or system).
Submit bug reports that are routed to the admin moderation queue.
The selected theme is applied immediately when saved and restored on the next login.

4.6 Admin Panel
Admin users have access to a separate management panel that provides:

A summary dashboard showing total users, active users, disabled accounts, and open moderation items.
A user management table with search, role assignment (traveler or admin), and account enable/disable controls.
A moderation queue displaying all submitted bug reports and admin-created moderation cases, with the ability to resolve individual items.
Admin access is enforced by role-based authorization on both the frontend routing and every backend admin endpoint.

5. User Roles
Traveler (Default)
Register an account and log in via email OTP verification.
Upload travel photos for location analysis.
Save location results to a personal gallery organized into collections.
Generate AI travel journals from gallery photos.
View travel statistics and receive destination recommendations.
Join tag-based live chat lounges and share gallery photos in chat.
Manage profile, display settings, and privacy defaults.
Submit bug reports to the admin team.
Admin
All traveler capabilities.
Access the admin panel to view user accounts and assign or revoke admin roles.
Enable or disable user accounts.
View and resolve the moderation queue, including bug reports submitted by users.
6. Features Not in Current Release
The following items were considered during early planning but are not part of the current implementation:

Food photo / restaurant search: Early designs included a separate pipeline for identifying restaurants from food photos. This was descoped to keep the Search pipeline focused on travel location identification.
Route generation: Routing from a detected location to a destination was planned but not implemented in the final release. Map visualization of saved places and journal GPS data is included instead.
Manual destination entry: Direct text-based destination lookup without an image upload is not currently supported. Users provide country and city hints alongside an image to improve accuracy.
7. Related Documents
README.md — Setup, build, and test instructions for new developers.
docs/API_DESIGN_FINAL.md — Full API endpoint reference.
docs/LIVE_CHAT_TAG_LOUNGES.md — Live Chat tag system design and lounge definitions.
docs/FINAL_DEPLOYMENT_CHECKLIST.md — Pre-deployment verification checklist.
docs/FINAL_TEST_PLAN.md — Manual test plan for all major features.