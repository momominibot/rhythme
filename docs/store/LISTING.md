# Rhythme App Store listing (draft, 22 Oct 2026; submission on hold until the review sign-in is decided)

App: Rhythme 1.0.0 (build 1). Bundle ID: ai.ranklore.rhythme (registered 22 Oct, team X534KT8F6Z). Publisher: Ranklore Pte Ltd.
Price: Free download (Jamie, 22 Oct: "we can set the download to free"; the earlier USD 29.99 is dropped). No ads. No in-app codes: Apple
guideline 3.1.1 does not allow an app's own codes to unlock paid features, so the Plus code box is hidden in the
iPhone build; testers use TestFlight, and Apple promo codes give free downloads after release.
Availability: Singapore to start (care numbers and food guides are Singapore's). Widen later if Jamie wants.
Privacy policy URL: https://momominibot.github.io/rhythme/privacy.html
Support URL: https://momominibot.github.io/rhythme/ (needs a support section or page before submitting)
Contact: hello@ranklore.ai. Copyright: 2026 Ranklore Pte Ltd.

## Text

Name (30): Rhythme: Cycle & Calm Diary
Subtitle (30): Your cosy health diary room

Description:

Rhythme is a cosy little world where looking after yourself feels gentle. Log your cycle, sleep, mood, meals and water
by tapping the things around your room, and earn hearts to grow a garden, a farm and a home.

LOG WHAT MATTERS
- Periods and symptoms on a calendar, sleep with simple sleep details, meals and water, movement and calm minutes.
- Bring in your sleep and cycle data from Apple Health if you choose.

SEE YOUR PATTERNS
- Cycle wellness and circadian rhythm scores, each part shown, with graphs of your cycles and your sleep.
- A four-week summary and a PDF for your doctor.

CALM, WITH ERIN
- Short mindfulness practices voiced by mindfulness coach Erin Lee: breathing, a morning start, everyday moments.
- A secret spring to sit by, with rain, a stream, waves or a gentle tone.

A WORLD TO GROW
- A garden and greenhouse, a farm with Clover the cow and the hens, a harbour to fish (every fish goes back),
  a kitchen, a lane of little shops, and villagers to befriend.

YOUR DATA, YOUR CHOICE
- Your diary is kept on your phone. Cloud backup is a separate choice, off unless you turn it on.

Rhythme is for adults 18 and over. It is a wellness diary, not a medical device: it does not diagnose, treat or work
as contraception. In an emergency, call your local emergency number.

Keywords (100): period,cycle,tracker,sleep,mindfulness,diary,wellness,pcos,menopause,women,calm,journal,cosy

Promotional text (170): A cosy diary room for your cycle, sleep and calm, with Erin's mindfulness, a garden, a farm and
a harbour to explore. Your diary stays on your phone.

## App Store Connect

- Primary category: Health and Fitness. Secondary: Lifestyle.
- Age rating: 18+ override (the app is for adults; medical or treatment information: infrequent).
- App Privacy: to answer from the privacy notice (health and fitness data collected only with cloud backup; email for
  the account; no tracking, no ads). Needs Jamie in a signed-in browser (no API for this part).
- Review notes: how to sign in (see "Open questions" below), where the main features are, that the AI help is paused,
  that hearts are earned by logging and are not purchasable.

## Open questions before submitting

1. Sign-in for App Review. The app opens with a sign-in wall. Google and Apple sign-in need deep links to work inside the
   iPhone app (not built yet), and the email code depends on Supabase's built-in mailer (2 emails an hour). Choices:
   (a) a "Use on this phone only" path in the iPhone build, so a reviewer can use the diary without an account; or
   (b) a custom email service for Supabase (Resend or similar) plus a review account Jamie controls.
2. Availability: Singapore only, or more countries.

## Update, 24 Oct 2026 (store setup started)

- The app ID is now sg.rhythme.app (chosen in PR 93 before any store record existed); ai.ranklore.rhythme stays
  registered but unused. HealthKit is on for sg.rhythme.app. Signing team X534KT8F6Z, iPhone only (no iPad screenshots).
- Native shells: Rhythme icon (the watercolour brain and heart, 1024 px), lavender splash, the camera prompt names
  Rhythme, ITSAppUsesNonExemptEncryption = NO. Release iPhone archive and a signed Android bundle are built (upload key in
  ~/.config/rhythme, outside the repo).
- Google Play: a Rhythme draft exists in the ranklore.ai developer account (app id 4972892310757677443). Nothing is
  published or sent for review.
- App Store Connect: the app record still needs Jamie's Apple sign-in in Chrome (the API cannot create it).
- Privacy policy URL for both stores: https://momominibot.github.io/rhythme/terms.html (the full policy, with
  hello@ranklore.ai); the in-app notice is privacy.html.
- Android images (1080 x 1920) and the Play feature graphic were made from real screens of the current build; the
  iPhone set stays the 21 Oct frames.
- Blocker found: inside the phone apps, the Apple and Google buttons cannot finish (the sign-in page leaves the app's
  web view and Google refuses embedded web views), so only the emailed code works there, capped at 2 emails an hour by
  Supabase's built-in mailer. Open question 1 above is still the gate for submitting.
