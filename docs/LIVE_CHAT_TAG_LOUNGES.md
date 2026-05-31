# Live Chat Tag Lounges

The Live Chat feature now uses 13 permanent tag-based lounges instead of creating city-level rooms. This keeps users from being split across too many small rooms and connects Search results directly to the chat experience.

## Flow

1. User uploads a photo in Search.
2. Search analysis returns raw visual clues, candidates, and standard lounge tags.
3. The frontend shows a **Join Lounges** section on the result card.
4. The user opens `/chat?tags=historical,urban,sunset`.
5. Live Chat highlights the matching lounge rooms.
6. The last 50 messages are loaded from PostgreSQL.
7. New messages are sent through WebSocket. REST POST remains as fallback.

## Standard Lounge Tags

- beach: Beach & Coast
- mountain: Mountain & Hike
- nature: Nature & Wildlife
- desert: Desert & Plains
- urban: Urban & Street
- historical: Historical & Heritage
- nightlife: Nightlife & Lights
- food: Food & Cafe
- museum: Museum & Art
- market: Market & Shopping
- transport: Transport & Journey
- sunset: Sunset & Sunrise
- snow: Snow & Winter

## Backend Endpoints

- `GET /api/chat-rooms`
- `GET /api/chat-rooms/recommendations?tags=historical,urban,sunset`
- `POST /api/chat-tags/normalize`
- `GET /api/chat-rooms/{room_id}/messages?limit=50`
- `POST /api/chat-rooms/{room_id}/messages`
- `WS /api/ws/chat/{room_id}?token=JWT`

Legacy endpoints still work:

- `GET /api/chat/messages?roomId=urban`
- `POST /api/chat/messages?roomId=urban`

## Data Model

- `image_metadata.tags`: JSON list of standard tag keys.
- `chat_rooms`: 13 permanent lounge rows.
- `chat_messages`: messages stored forever with room, sender, optional image attachment, and timestamp.

## Notes

- Chat rooms are always present, even with zero users online.
- Messages are stored in PostgreSQL and stay available for the next user.
- Seed data creates sample messages for the beta/demo environment.
