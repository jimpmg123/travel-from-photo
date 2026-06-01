# Jaemin Jeon Individual Progress Update

## 1. Scheduled Tasks

By Milestone 4, I was scheduled to work mainly on my track of the Travel From Photo project. My assigned work focused on the user-facing account, social, and management features. According to our project schedule and role division, I was responsible for the following tasks:

- Profile page and profile API
- Settings page and settings API
- Live Chat feature
- Admin Panel
- Documentation updates
- Integration testing
- Deployment support

These tasks were connected to the main project goal because they support the user experience after the image search process. While the Younghak Yoo track focused more on authentication, search, OpenAI API integration, gallery, journal, database, and deployment structure, my track focused on the features that help users manage their account, communicate through chat, and allow admins to manage the system.

---

## 2. Completed Tasks

I completed the main features assigned to me for the beta release.

First, I worked on the Profile and Settings features. I built the Profile page and Settings page and connected them with backend API support. Through these pages, users can view and update their profile information and account preferences. The Settings page also supports basic options such as display name, privacy setting, and theme. These features are not the main search function, but they are still important because users need a place to manage their account and preferences.

Second, I worked on the Admin Panel. The Admin Panel allows an admin user to view system-related information, including user data, moderation items, and summary data. I also connected the admin page with backend APIs. After that, I tested the access control and confirmed that an admin account can access the Admin Panel, while a normal traveler account cannot. This was important because admin features should not be available to regular users.

Third, I worked on the Live Chat feature. At first, the chat feature was more general, but we changed it into a tag-based lounge system that fits our project better. Instead of making chat rooms for every city, the system now uses 13 fixed travel-related lounges, such as Food & Cafe, Historical & Heritage, Urban & Street, Beach & Coast, and Sunset & Sunrise. This design connects the chat feature to the photo search feature because users can join lounges based on the tags generated from their uploaded photo.

I also helped add backend support for chat rooms and chat messages. Chat messages are stored in the database, so users can still see past messages after refreshing the page or entering the lounge again later. The system also supports WebSocket-based real-time chat, with REST fallback support for loading and sending messages.

Besides feature work, I also helped with documentation and integration. I helped update the README, API documentation, deployment checklist, test plan, bug tracking instructions, and Milestone 4 documentation. I also helped merge my part with Younghak's part into one deployment-ready version of the project.

---

## 3. Completed Testing

After Younghak's part and my part were merged, I tested my assigned features and related user flows. The following tests were completed successfully without errors:

- Logged in with the admin account: `jaemin@example.com / Travel2026!`
- Confirmed that the Admin Panel is accessible for the admin account.
- Logged in with the normal traveler account: `mina@example.com / Travel2026!`
- Confirmed that a normal traveler account cannot access the Admin Panel.
- Updated the Profile page and confirmed that the changes were saved.
- Updated the Settings page and confirmed that the changes were saved.
- Entered a Live Chat lounge successfully.
- Sent a Live Chat message successfully.
- Refreshed the page and confirmed that the chat message was still visible.
- Checked the `chat_messages` table in the database and confirmed that the message was saved correctly.

These tests confirmed that the Profile, Settings, Admin authorization, Live Chat lounge, and chat message persistence features are working properly for the beta release.

---

## 4. Partially Completed or In-Progress Tasks

Most of my assigned features are completed and tested. The remaining work is mostly related to final release testing and polish.

- Final public deployment testing is still in progress.
- More testing is needed for the full Search to Tags to Live Chat lounge recommendation flow.
- The Admin tools are working for the beta version, but more detailed moderation features could be added later.
- The mobile UI can still be improved before the final release.

---

## 5. Estimated Completion

I estimate that my assigned tasks are about 95% complete.

The main parts of my work are implemented and tested. Profile, Settings, Admin Panel, Live Chat lounges, database-backed chat message storage, and documentation support are all working at the beta level. The remaining work is mainly final deployment testing, mobile UI polish, and small improvements based on more user testing.

---

## 6. Next Steps

Before the final release, my next steps are:

- Test the final deployed version from a real browser.
- Continue testing the full user flow after deployment.
- Confirm that chat messages remain saved after refresh and re-login.
- Confirm that admin-only pages stay blocked for normal users.
- Test the Search to Tags to Live Chat lounge recommendation flow.
- Report any new bugs through GitHub Issues.
- Help fix bugs found during beta testing.
- Help prepare the final presentation and demo.
