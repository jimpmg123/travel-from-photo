# B Track Feature Specification

## 1. Overview

The B track of Travel From Photo covers the account, social, and management features that support the main image-based location search experience. The goal is to make the project feel like a complete web application with user profiles, account preferences, live communication, and admin management.

The B track includes four main feature areas:

1. Profile
2. Settings
3. Live Chat Tag Lounges
4. Admin Panel

These features are not separate from the main Search feature. They support the full user flow after a user uploads a photo, receives location candidates, saves the result, and joins related chat lounges.

---

## 2. Profile Feature

### Purpose

The Profile feature allows a logged-in user to view and update basic account information. This gives each user a clear account identity inside the application.

### Target Users

- Logged-in traveler users
- Logged-in admin users

### Main User Actions

- View current profile information
- Update first name
- Update last name
- Update email or display-related fields when allowed
- View role and account status

### Business Rules

- Only authenticated users can access their profile.
- A user can only edit their own profile.
- Admin users can still use the normal profile system.
- Profile data must be saved in the backend and persist after refresh.

### Expected UI Behavior

- The Profile page should show the user's name, email, role, and account status.
- Saved changes should remain after page refresh or re-login.
- If a request fails, the page should show a clear error message.

---

## 3. Settings Feature

### Purpose

The Settings feature lets users manage simple account preferences. This makes the application more personalized and gives users control over privacy and display options.

### Target Users

- Logged-in traveler users
- Logged-in admin users

### Main User Actions

- View current settings
- Update display name
- Change default privacy setting
- Change theme preference
- Toggle email notification preference

### Business Rules

- Only authenticated users can access settings.
- A user can only update their own settings.
- If a settings row does not exist for a user, the backend can create a default one.
- Default privacy should be private unless the user changes it.

### Expected UI Behavior

- Settings should load from the backend when the page opens.
- Clicking Save should persist the updated settings.
- Updated values should remain after refresh.

---

## 4. Live Chat Tag Lounges

### Purpose

The Live Chat feature gives users a way to communicate based on the type of travel photo they uploaded. Instead of creating city-based rooms, the system uses 13 fixed tag-based lounges.

This avoids splitting users into too many empty rooms and connects the chat feature directly to the Search feature.

### Target Users

- Logged-in traveler users
- Logged-in admin users

### Main User Actions

- View all chat lounges
- View recommended lounges based on photo tags
- Enter a lounge
- Load recent messages
- Send a message
- Attach an uploaded image to a message when supported
- Refresh and still see previous messages

### 13 Standard Lounges

| Tag Key | Display Name | Category |
|---|---|---|
| `beach` | Beach & Coast | Nature / Landscape |
| `mountain` | Mountain & Hike | Nature / Landscape |
| `nature` | Nature & Wildlife | Nature / Landscape |
| `desert` | Desert & Plains | Nature / Landscape |
| `urban` | Urban & Street | City / Architecture |
| `historical` | Historical & Heritage | City / Architecture |
| `nightlife` | Nightlife & Lights | City / Architecture |
| `food` | Food & Cafe | Culture / Activity |
| `museum` | Museum & Art | Culture / Activity |
| `market` | Market & Shopping | Culture / Activity |
| `transport` | Transport & Journey | Experience / Other |
| `sunset` | Sunset & Sunrise | Experience / Other |
| `snow` | Snow & Winter | Experience / Other |

### Business Rules

- All 13 lounges always exist.
- Lounges do not disappear when zero users are online.
- Only authenticated active users can enter lounges.
- Admin and traveler users can both use Live Chat.
- Messages are stored in PostgreSQL permanently.
- The latest messages are loaded when a user enters a room.
- WebSocket is used for real-time messages.
- REST endpoints remain available as fallback.

### Expected UI Behavior

- Live Chat should show all 13 lounges.
- Recommended lounges should be highlighted when tags are passed from Search.
- Opening a room should load recent messages.
- Sending a message should display it immediately.
- Refreshing the page should not remove old messages.

---

## 5. Admin Panel

### Purpose

The Admin Panel gives admin users access to system management information. It supports basic user management and moderation workflows for the beta release.

### Target Users

- Admin users only

### Main User Actions

- View dashboard summary
- View user list
- Search users
- Update user role or active status when supported
- View moderation items
- Create or resolve moderation items

### Business Rules

- Only users with `role = admin` can access admin endpoints.
- Traveler users must be blocked from Admin Panel access.
- Admin routes should require a valid JWT.
- Admin actions should not be available to unauthenticated users.

### Expected UI Behavior

- Admin users can open the Admin Panel.
- Traveler users should be redirected or blocked.
- Admin summary, user list, and moderation items should load from the backend.
- If a user is not an admin, the UI should show an access error or redirect.

---

## 6. Feature Dependencies

The B track depends on the following shared project systems:

- Authentication and JWT login
- User database table
- PostgreSQL database
- Alembic migrations
- Frontend route handling
- Search tags for Live Chat recommendations

If authentication is broken, B track features may fail because they require a logged-in user.

---

## 7. Beta Status

The B track features are complete at beta level. Profile, Settings, Admin Panel, and Live Chat were tested after merge. Chat messages were also confirmed in the database.

Remaining improvements are mainly UI polish, broader user testing, and more detailed admin moderation features.
