# Privacy Policy for ClipCut

**Effective Date:** November 22, 2026  
**Last Updated:** November 22, 2026  
**Website:** [https://clipcut.ai](https://clipcut.ai)  
**Contact:** privacy@clipcut.ai  

---

## 1. Introduction

ClipCut ("we," "our," or "us") respects your privacy and is committed to protecting the personal data of users who interact with our AI Stream Clipper platform. This Privacy Policy describes how we collect, use, store, share, and protect your information when you access or use ClipCut, connect your YouTube channel, or use our autonomous publishing pipeline.

By using ClipCut, you agree to the collection and use of information in accordance with this policy.

---

## 2. Google API Services & YouTube User Data

ClipCut integrates with Google APIs and YouTube Data API v3 to provide autonomous vertical video publishing and stream analysis services.

### 2.1 YouTube Data API v3 Compliance
ClipCut uses the YouTube API Services. By using our service to connect your YouTube channel or publish clips, you acknowledge and agree that:
- You are bound by the [YouTube Terms of Service](https://www.youtube.com/t/terms).
- Your data is handled in accordance with the [Google Privacy Policy](https://policies.google.com/privacy).
- You may revoke ClipCut's access to your YouTube and Google account data at any time via the [Google Security Settings Page](https://security.google.com/settings/security/permissions).

### 2.2 Limited Use Disclosure
ClipCut's use and transfer of information received from Google APIs to any other app adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

We only request the minimum permissions required for our application to function:
- **`openid`, `email`, `profile`**: To securely authenticate your identity and display your channel or profile name.
- **`https://www.googleapis.com/auth/youtube.upload`**: To publish user-approved vertical video clips (Shorts) directly to your authorized YouTube channel.
- **`https://www.googleapis.com/auth/youtube.readonly`**: To retrieve your channel ID, channel title, avatar, and verify upload statuses.

### 2.3 What We Do NOT Do
- We do **never** sell your YouTube or Google account data to third parties, data brokers, or advertisers.
- We do **never** use your video transcripts, stream audio, or channel metadata to train third-party public machine learning models without your explicit consent.
- We do **never** access, modify, or delete existing videos on your channel that were not created through ClipCut.

---

## 3. Information We Collect

### 3.1 Information You Provide
- **Account Information:** Name, email address, password hash (salted using PBKDF2-HMAC-SHA256).
- **OAuth Credentials:** If self-hosting, Google Cloud OAuth Client ID and Client Secret stored encrypted on your server instance.
- **Video Source URLs:** Public YouTube video or livestream URLs that you submit for clipping and analysis.
- **Publishing Metadata:** Custom title templates, description formats, hashtags, and schedule preferences.

### 3.2 Automatically Collected Information
- **Session Telemetry:** JWT session tokens stored in your browser's local storage for authentication.
- **Hardware Telemetry:** Local engine diagnostics (CPU core count, RAM allocation, GPU acceleration availability) used exclusively to optimize FFmpeg rendering performance.
- **Log Data:** IP addresses and request timestamps used solely for security protection and rate-limiting against brute-force attacks.

---

## 4. How We Use Your Information

We use the information we collect strictly to:
1. Authenticate your account and provide multi-user data isolation.
2. Download and analyze authorized livestream segments to detect exciting moments.
3. Render vertical 9:16 video clips with subtitles and facecam composition.
4. Schedule and publish vertical clips directly to your connected YouTube channel according to your cadence preferences.
5. Provide automatic upload recovery when network connectivity drops.

---

## 5. Data Storage, Security & Retention

- **Database:** User records, project metadata, and clip configurations are stored securely in SQLite or PostgreSQL with strict foreign-key user constraints.
- **Tokens:** Google and YouTube OAuth refresh tokens are stored server-side and are never exposed in frontend network requests.
- **Video Artifacts:** Downloaded streams, sliced sections, and temporary subtitle files are stored locally in the server's workspace and are automatically cleaned up according to your configured retention policy (`AUTO_CLEANUP_TEMP=true`).
- **Data Deletion:** You can delete any project, clip, or disconnected YouTube channel at any time directly through the interface, which immediately purges the associated database records and disk files.

---

## 6. Cookies and Browser Storage

ClipCut does not use tracking or advertising cookies. We utilize browser `localStorage` solely for:
- Secure JWT session token persistence (`clipcut_auth_token`).
- Active user display details (`clipcut_auth_user`).
- Interface preferences (sidebar collapsed state, theme preferences).

---

## 7. Your Rights

Depending on your jurisdiction (such as GDPR in Europe or CCPA in California), you have the right to:
- Access the personal data we hold about you.
- Request correction of inaccurate data.
- Request total erasure of your user account, projects, clips, and OAuth credentials.
- Revoke OAuth access at any time through Google Account permissions.

---

## 8. Changes to this Privacy Policy

We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated "Last Updated" date.

For questions or data deletion requests, contact us at **privacy@clipcut.ai**.
