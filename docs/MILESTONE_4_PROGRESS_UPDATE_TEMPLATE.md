# Milestone 4 Progress Update

## Individual Progress Update: Jaemin Jeon

### Scheduled tasks by this milestone

- Profile and Settings UI
- Profile and Settings API integration
- Live Chat feature
- Tag-based Live Chat lounge design
- Admin Panel UI and API integration
- Gallery and Journal UI support
- Database support for B-track features
- Deployment support and integration testing
- Documentation updates

### Completed tasks

- Implemented Profile and Settings pages.
- Connected Profile and Settings to authenticated backend APIs.
- Implemented Live Chat with 13 permanent tag-based lounges.
- Added WebSocket live messaging and REST fallback for chat.
- Added database tables for `user_settings`, `chat_rooms`, `chat_messages`, and `moderation_items`.
- Added Admin Panel for user management and moderation.
- Integrated B-track features with JWT authentication.
- Added Alembic migration for B-track social tables.
- Updated deployment configuration with Docker Compose, backend Dockerfile, frontend Dockerfile, and nginx proxy.
- Added documentation for deployment, API design, bug tracking, and final testing.

### Partially completed or still in progress

- Final server deployment testing after the team merge is still in progress.
- Full external API testing depends on valid API keys in the deployment environment.
- Final bug verification with another team member is still in progress.

### Next steps

- Run the final merged project through Docker Compose.
- Verify Search, Gallery, Journal, Live Chat, Profile, Settings, and Admin flows.
- Open GitHub Issues for any bugs found.
- Deploy the project and add the public link to the submission.

## Group Progress Update

### Current status

The project is close to beta release level. Core features are implemented, including Auth, Search, Gallery, Journal, Profile, Settings, Live Chat, Admin, Database, and Docker-based deployment setup. The remaining work is final deployment testing, bug fixing, and checking external API behavior with real keys.

### Progress grade

We feel our progress is a B+/A- because the main implementation is mostly complete and deployment setup exists, but final public deployment and cross-feature bug verification still need to be completed.

### Schedule adjustment

The team simplified the original location-search design and focused on a more realistic beta release. The Search flow now emphasizes likely candidates and confidence scores instead of guaranteed exact location recovery. Live Chat was redesigned from city-based rooms into 13 tag-based permanent lounges connected to Search results.

### Risks and blockers

- External API keys must be configured correctly.
- The deployment server must support Docker Compose or equivalent services.
- Search quality depends on image clues and external API responses.
- WebSocket routing must be checked after deployment.
