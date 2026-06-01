# B Track Documentation Overview

## Travel From Photo

This folder contains the documentation for Jaemin Jeon's B track work in the Travel From Photo project. The shared project documents, A track documents, and general deployment documents are not replaced by these files. These documents only describe the B track features and the testing work connected to those features.

## B Track Scope

The B track focuses on account, social, and management features that support the main image-based search flow.

Included B track features:

- Profile page and profile API
- Settings page and settings API
- Admin Panel and admin APIs
- Tag-based Live Chat lounges
- Chat message database persistence
- WebSocket-based real-time chat
- REST fallback for chat message loading and sending
- B track integration testing
- B track documentation support

## Relationship to A Track

The A track focuses on authentication, image upload, OpenAI-based search, gallery, journal, database structure, and deployment foundation. The B track depends on the A track authentication system because Profile, Settings, Live Chat, and Admin all require a logged-in user.

Important dependency points:

- B track APIs require JWT authentication.
- Admin APIs require `role = admin`.
- Live Chat works for any active authenticated user, including admin and traveler accounts.
- Chat lounge recommendations depend on tags returned by the Search flow.
- Chat messages are stored in PostgreSQL and remain after refresh or re-login.

## Files in This Folder

| File | Purpose |
|---|---|
| `B_TRACK_FEATURE_SPEC.md` | Full feature specification for Profile, Settings, Admin, and Live Chat. |
| `B_TRACK_API_DESIGN.md` | API documentation for the B track endpoints. |
| `B_TRACK_DB_DESIGN.md` | Database tables and relationships used by the B track. |
| `B_TRACK_LIVE_CHAT_DESIGN.md` | Detailed design for the 13 tag-based Live Chat lounges. |
| `B_TRACK_TEST_PLAN.md` | Manual test cases and cross-testing checklist for B track features. |
| `B_TRACK_INTEGRATION_AND_DEPLOYMENT_NOTES.md` | Notes for merge, deployment, authentication, and environment setup. |
| `B_TRACK_PROGRESS_UPDATE.md` | Milestone 4 style progress update for Jaemin Jeon's B track work. |

## Current Beta Status

The B track is working at beta level. The following tests were completed successfully:

- Admin login with `jaemin@example.com / Travel2026!`
- Admin Panel access for admin account
- Traveler login with `mina@example.com / Travel2026!`
- Traveler blocked from Admin Panel
- Profile update and save
- Settings update and save
- Live Chat lounge entry
- Live Chat message sending
- Page refresh preserves chat message visibility
- Direct database check confirms chat messages are stored in `chat_messages`

Remaining work before final release:

- Public deployment testing
- More Search to Tags to Live Chat lounge testing
- Mobile UI polish
- More detailed admin moderation features
- Broader user testing
