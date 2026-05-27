# B Track Demo Script

This script is for a short demo of Jaemin's B-track work.

## Demo Flow

### 1. Sign in or stay in the demo account

Explain that the B-track pages are designed for authenticated users. The frontend keeps a simple mock account for the demo, and the final version can connect this to the A-track authentication system.

### 2. Open Profile

Show that the user can view and edit profile information. Edit the name, email, or short bio. Save the change and explain that the backend profile API supports reading and updating the current user.

Important endpoints:

- `GET /api/users/me`
- `GET /api/profile`
- `PUT /api/profile`

### 3. Open Settings

Change display name, privacy, theme, or email notification preference. Save the setting. Explain that this supports the SDD requirement for account preference management.

Important endpoints:

- `GET /api/settings`
- `PATCH /api/settings`

### 4. Open Live Chat

Send a short message such as:

```text
I need help checking why my photo location result looks wrong.
```

Explain that the chat page shows sender, message text, and timestamp. It also stores messages through the backend API.

Important endpoints:

- `GET /api/chat/messages`
- `POST /api/chat/messages`

### 5. Open Admin Panel

Show the summary cards first. Then search for a user, change user status, and resolve one moderation item.

Important endpoints:

- `GET /api/admin/summary`
- `GET /api/admin/users`
- `PATCH /api/admin/users/{user_id}`
- `GET /api/admin/moderation`
- `PATCH /api/admin/moderation/{item_id}`

### 6. Reset demo data if needed

Click Reset demo data if the demo state needs to go back to the original sample data.

Important endpoint:

- `POST /api/admin/reset-demo-data`

## Short Presentation Explanation

My part is the B track. It focuses on the user and social side of the project. I completed the profile and settings pages, live chat, and admin panel. These pages connect to backend APIs, and the demo data persists while the backend is running. This part supports user management, basic support communication, moderation, and account preferences. After our A-track code is merged, the same API structure can be connected to the final authentication and database layer.
