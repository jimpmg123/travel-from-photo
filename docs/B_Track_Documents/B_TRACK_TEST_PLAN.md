# B Track Test Plan

## 1. Purpose

This test plan covers the B track features of Travel From Photo:

- Profile
- Settings
- Admin Panel
- Live Chat Tag Lounges
- Chat message database persistence
- B track authentication and authorization behavior

This document is meant for cross-testing. A team member who did not implement a feature should test it and report any bugs through GitHub Issues.

---

## 2. Test Accounts

After running:

```bash
docker compose exec backend python -m app.scripts.seed_complete
```

Use these accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `jaemin@example.com` | `Travel2026!` |
| Traveler | `mina@example.com` | `Travel2026!` |

---

## 3. Profile Tests

### Test P1: Profile Loads

Steps:

1. Login as traveler.
2. Open Profile page.
3. Confirm name, email, role, and account status are visible.

Expected result:

- Profile information loads without error.

Status:

- Beta test completed successfully.

---

### Test P2: Profile Update Saves

Steps:

1. Login as traveler or admin.
2. Open Profile page.
3. Change editable profile fields.
4. Save.
5. Refresh the page.

Expected result:

- Updated values remain after refresh.

Status:

- Beta test completed successfully.

---

## 4. Settings Tests

### Test S1: Settings Load

Steps:

1. Login as traveler.
2. Open Settings page.
3. Confirm display name, privacy, theme, and notification fields load.

Expected result:

- Settings load without error.

---

### Test S2: Settings Save

Steps:

1. Change display name, privacy, or theme.
2. Click Save.
3. Refresh the page.

Expected result:

- Saved values remain after refresh.

Status:

- Beta test completed successfully.

---

## 5. Admin Panel Tests

### Test A1: Admin Can Access Admin Panel

Steps:

1. Login with `jaemin@example.com / Travel2026!`.
2. Open Admin Panel.

Expected result:

- Admin Panel opens.
- Summary, users, or moderation data loads.

Status:

- Beta test completed successfully.

---

### Test A2: Traveler Cannot Access Admin Panel

Steps:

1. Login with `mina@example.com / Travel2026!`.
2. Try to open Admin Panel.

Expected result:

- Traveler is blocked, redirected, or shown an access error.

Status:

- Beta test completed successfully.

---

### Test A3: Admin Data Loads

Steps:

1. Login as admin.
2. Open Admin Panel.
3. Check users and moderation items.

Expected result:

- Admin data loads from backend.

---

## 6. Live Chat Tests

### Test C1: Lounge List Loads

Steps:

1. Login as traveler or admin.
2. Open Live Chat.
3. Confirm all 13 lounges are shown.

Expected result:

- Lounge list loads.
- User is not asked to login again.

---

### Test C2: Enter a Lounge

Steps:

1. Open Live Chat.
2. Click one lounge.

Expected result:

- The room opens.
- Recent messages are loaded.

Status:

- Beta test completed successfully.

---

### Test C3: Send Message

Steps:

1. Enter a Live Chat lounge.
2. Type a message.
3. Click Send.

Expected result:

- Message appears in the chat window.
- Message is saved by backend.

Status:

- Beta test completed successfully.

---

### Test C4: Message Persists After Refresh

Steps:

1. Send a message in a lounge.
2. Refresh the page.
3. Re-enter the same lounge.

Expected result:

- The message is still visible.

Status:

- Beta test completed successfully.

---

### Test C5: Database Confirmation

Run:

```bash
docker compose exec db psql -U travel_user -d travel_db -c "SELECT id, room_id, sender_user_id, message_text, created_at FROM chat_messages ORDER BY created_at DESC LIMIT 20;"
```

Expected result:

- Recently sent chat messages appear in the database.

Status:

- Beta test completed successfully.

---

## 7. Search to Live Chat Recommendation Test

### Test R1: Tags Open Recommended Lounges

Steps:

1. Login as traveler.
2. Upload an image through Search.
3. Confirm tags appear in the Search result.
4. Click Join Lounges.
5. Confirm Live Chat opens and recommended lounges are highlighted.

Expected result:

- Tags connect Search result to Live Chat lounges.

Status:

- Needs more testing with real travel photos.

---

## 8. Known Remaining Testing

- Public deployment testing is still needed.
- More real-photo testing is needed for Search to Tags to Live Chat flow.
- Mobile UI testing is still needed.
- More admin moderation tests can be added before final release.

---

## 9. Bug Reporting Rule

If any test fails:

1. Open GitHub Issues.
2. Create a bug report.
3. Include steps to reproduce.
4. Include expected result and actual result.
5. Add labels such as `frontend`, `backend`, `database`, `auth`, `live-chat`, or `admin`.
6. Assign serious bugs to a team member.
