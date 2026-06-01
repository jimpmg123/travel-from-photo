# B Track Live Chat Tag Lounge Design

## 1. One-Line Summary

The Live Chat feature uses 13 permanent tag-based lounges connected to the Search result tags.

Instead of creating rooms by city, the system uses a fixed set of travel-related tags. This keeps users from being split across too many empty rooms and makes Live Chat feel connected to the photo search feature.

---

## 2. Why Tag-Based Lounges

City-based rooms can grow too quickly. If the system creates a room for every city, many rooms may have zero users or only one message. This makes the chat feature feel empty and hard to manage.

Tag-based lounges solve this problem because there are only 13 fixed rooms. Users with similar types of travel photos can join the same lounge even if their photos were taken in different countries.

Example:

- A cafe photo in Paris and a ramen photo in Tokyo can both lead to Food & Cafe.
- A palace photo in Korea and a castle photo in Europe can both lead to Historical & Heritage.
- A city street photo in Seoul and a street photo in Prague can both lead to Urban & Street.

---

## 3. User Flow

```text
1. User uploads a photo.
2. Search analysis runs.
3. Search returns location candidates and standard tags.
4. Frontend shows Join Lounges section.
5. User clicks a recommended lounge.
6. Live Chat opens with matching lounges highlighted.
7. Recent 50 messages load from PostgreSQL.
8. User sends a message.
9. Message is saved in PostgreSQL.
10. Other connected users receive the message through WebSocket.
```

---

## 4. 13 Standard Lounges

### Nature / Landscape

- Beach & Coast (`beach`)
- Mountain & Hike (`mountain`)
- Nature & Wildlife (`nature`)
- Desert & Plains (`desert`)

### City / Architecture

- Urban & Street (`urban`)
- Historical & Heritage (`historical`)
- Nightlife & Lights (`nightlife`)

### Culture / Activity

- Food & Cafe (`food`)
- Museum & Art (`museum`)
- Market & Shopping (`market`)

### Experience / Other

- Transport & Journey (`transport`)
- Sunset & Sunrise (`sunset`)
- Snow & Winter (`snow`)

---

## 5. Tag Extraction Logic

The Live Chat system does not run a separate tag-only AI model. Instead, it uses the Search analysis result payload.

The backend collects text clues from the Search result, such as:

- Candidate place names
- Candidate regions
- Short candidate reasons
- Image analysis descriptions
- Labels or scene clues when available
- Places-related types when available

Then it normalizes those clues into 1 to 3 standard lounge tags through keyword matching.

Examples:

| Raw Clues | Standard Tags |
|---|---|
| restaurant, cafe, ramen, sushi | `food` |
| street, city, building, skyline | `urban` |
| palace, temple, castle, tower, landmark | `historical` |
| beach, ocean, coast, island | `beach` |
| sunset, sunrise, golden hour | `sunset` |
| snow, winter, ski, ice | `snow` |

Relevant backend files:

```text
backend/app/routers/image.py
backend/app/services/chat_tags.py
```

Expected output fields in Search response:

```json
{
  "tags": ["historical", "urban", "sunset"],
  "chat_lounges": [
    { "tagKey": "historical", "displayName": "Historical & Heritage" },
    { "tagKey": "urban", "displayName": "Urban & Street" },
    { "tagKey": "sunset", "displayName": "Sunset & Sunrise" }
  ]
}
```

---

## 6. Message Persistence

All messages are stored in PostgreSQL.

Rules:

- Messages stay even if nobody is online.
- Messages stay after browser refresh.
- Messages stay after logout and login.
- Each lounge loads recent messages when opened.
- WebSocket and REST fallback both save messages to the same database table.

Database table:

```text
chat_messages
```

Important fields:

```text
id
room_id
sender_user_id
message_text
image_id
created_at
read_at
```

---

## 7. Authentication Rules

Live Chat is not admin-only. It works for both admin and traveler users.

Allowed:

```text
logged-in admin user -> can use Live Chat
logged-in traveler user -> can use Live Chat
```

Blocked:

```text
not logged-in user -> cannot use Live Chat
invalid JWT token -> cannot use Live Chat
inactive user -> cannot use Live Chat
```

For REST API calls, the token is sent as:

```text
Authorization: Bearer <JWT>
```

For WebSocket, the token is passed in the URL:

```text
/ws/chat/{room_id}?token=JWT
```

---

## 8. Failure Handling

| Failure Case | Expected Behavior |
|---|---|
| User is not logged in | Show login-required or authentication error. |
| Token is missing in WebSocket | Close WebSocket connection. |
| Room does not exist | Show room not found or fallback to default room. |
| Message is empty | Reject the message. |
| WebSocket fails | Use REST fallback if available. |
| Search does not return tags | Recommend default lounge, usually Urban & Street. |

---

## 9. Beta Status

The following Live Chat tests were completed successfully:

- Entered Live Chat lounge.
- Sent a message.
- Refreshed the page.
- Confirmed the message remained visible.
- Checked the `chat_messages` table and confirmed the message was saved.

Live Chat is working at beta level. Remaining improvements are mainly broader user testing, mobile UI polish, and more detailed moderation/reporting behavior.
