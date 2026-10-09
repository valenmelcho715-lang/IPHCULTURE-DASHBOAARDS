# Meta Instagram review checklist

## Integration submitted

Use **Instagram API with Facebook Login**. The application exchanges the OAuth code on the server, resolves the Facebook Page linked to the Instagram professional account, stores the Page access token encrypted, subscribes the Instagram webhook, receives Instagram Direct messages, and lets an assigned team member reply.

Request Advanced Access for the permissions used by this flow:

- `instagram_basic`
- `instagram_manage_messages`
- `pages_show_list`
- `pages_read_engagement`
- `business_management`

Meta's **Instagram API with Facebook Login** setup lists these five permissions for the
messaging flow. `business_management` is used only to authorize and validate the
business-owned Page and linked Instagram professional account; the application does
not manage ads or third-party businesses. Do not request `pages_manage_metadata` for
this Business Login configuration because Meta does not expose it in the configuration
permission selector.

Do not submit `instagram_business_basic` or `instagram_business_manage_messages` while the application uses the Facebook Login flow. Those permissions belong to the separate Instagram Login flow.

## Reviewer access

- Login URL: `https://iphoneculture-atencion.onrender.com/login?review=meta`
- Reviewer email: `meta-review@iphoneculture.com`
- Supply the password only in Meta's protected reviewer-credentials field.
- The reviewer account is restricted to the Instagram connection screen.
- Automatic replies and live outbound messages remain disabled during review.

## Screen recording script

Record a new video in English and add captions or on-screen explanations.

1. Open the reviewer login URL and sign in with the reviewer credentials.
2. Show the English Instagram review screen and the **Automatic replies are OFF** badge.
3. Click **Continue with Facebook**.
4. Show the complete Meta login/authorization flow without cuts.
5. Select the Facebook Page linked to the Instagram professional account and approve every requested permission.
6. Return to the application and show the verified Instagram account, linked Page, and enabled message reception.
7. From a separate Instagram test account, send a new DM to the professional account.
8. Show the DM arriving in the application's inbox.
9. Send one manual reply from the application and show it arriving in the Instagram test account.
10. State that the permissions are used only to authorize the business-owned assets, identify the professional account, subscribe to its webhooks, receive its DMs, and send replies requested by a team member.

The recording must show the same Facebook Login flow and permission names selected in the submission. Do not reuse the rejected recording from October 5, 2026.

## Submission notes

Suggested English text:

> iPhone Culture uses the Instagram API with Facebook Login to connect its own Instagram professional account and the linked Facebook Page. `business_management` is used only to authorize and validate the business-owned assets required by Meta's setup; the app does not manage ads or third-party businesses. The server exchanges the OAuth code, securely stores the Page access token, subscribes the account to Instagram messaging webhooks, receives customer-initiated Instagram Direct messages, and allows an assigned sales representative to reply from the internal inbox. The reviewer video shows the complete Meta authorization flow, a real incoming test DM, and a manual reply. Automatic replies are disabled during review.
