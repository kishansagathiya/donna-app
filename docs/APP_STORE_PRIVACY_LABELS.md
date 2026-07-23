# App Store Connect — Privacy Nutrition Labels

Fill App Store Connect → App Privacy to match [`ios/Donna/PrivacyInfo.xcprivacy`](../ios/Donna/PrivacyInfo.xcprivacy) and the in-app privacy policy.

**Data used to track you?** No  
**Data linked to you?** Yes (types below)  
**Data not linked to you?** None beyond what Apple’s form requires

| Data type | Collected | Linked to user | Used for tracking | Purposes |
|-----------|-----------|----------------|-------------------|----------|
| Email Address | Yes (if shared via Sign in with Apple / Google) | Yes | No | App Functionality |
| Name | Yes (if shared via sign-in) | Yes | No | App Functionality |
| User ID | Yes (account identifier) | Yes | No | App Functionality |
| Audio Data | Yes (mic / device voice captures) | Yes | No | App Functionality |
| Photos or Videos | Yes (only when user adds a photo to memory) | Yes | No | App Functionality |
| Other User Content | Yes (transcripts, replies, notes, memory items) | Yes | No | App Functionality |

Do **not** declare advertising, analytics-for-ads, or tracking SDKs unless you add them later.

Third parties that process data for app functionality (disclose in privacy policy, not as tracking):

- Supabase — auth, database, file storage  
- OpenRouter — STT / LLM  
- OpenAI, Cartesia, or ElevenLabs — TTS (one configured provider)
