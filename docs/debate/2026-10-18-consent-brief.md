# Brief: first-launch data notice for Rhythme (independent review)

Rhythme is a Singapore women's cycle and wellbeing app (installable web app today, possibly App Store and
Google Play later). Users log periods, symptoms, pain, mood, sleep, meals and food photos, mindfulness minutes,
weight, and onboarding answers about pregnancy, hormones and medicines, diagnoses, family history and body signals.
This is health data, so it is sensitive. Adults are the audience; people aged 13 to 16 can use it with extra
safeguarding (a parent or guardian note, pregnancy-crisis support, forecasts paused). Under-13s are told to set it up
with a parent.

## What actually happens today
- The diary is stored in the browser on the phone. No accounts, no cloud sync yet, no analytics, no advertising.
- Luna (the in-app helper) sends a note the on-device rules cannot read, or a food photo, to Rhythme's own server
  functions, which pass it to a third-party AI service hosted outside Singapore (in China) and return structured
  entries. No name is attached; the text itself may contain health details. Nothing is stored on the way.
- Journal readings send a summary of the last 7 or 28 days (entries, cycle day, onboarding answers, no name) the same way.
- The owner chose not to name the AI vendor or model in the app.
- Using a premium access code records the code use and a hashed network address to stop misuse.
- Hosting: GitHub Pages (normal server logs); fonts load from Google.
- Settings let people switch Luna's reading off; export and delete-everything exist in the app.

## What the owner now plans
"We plan to collect data." Intent: store users' data on Rhythme's servers (backup and sync across phones) and use
de-identified patterns to improve predictions and the product, possibly research later. A separate detailed privacy
policy will be written by the owner. The first-launch notice is required ("no accept, no use"), friendly, short
cards, and turns Luna's reading on by default after acceptance. A "Help make Rhythme better" choice is shown
pre-ticked and can be changed later.

## Current notice text
Title "Before your room opens". Sub: "What Rhythme keeps, why, and how we look after it."
1. What we collect: What you log: periods, symptoms, sleep, meals and food photos, mood and calm minutes, plus your getting-to-know-you answers.
2. Why we collect it: To predict your cycle, notice patterns over time, and let Luna understand your notes and food photos and write your journal readings.
3. Where it goes: Your diary is saved on this phone. When Luna reads a note or a photo, that piece goes to Rhythme's service without your name, and her answer comes straight back.
4. How we look after it: We never sell your data or use it for ads, and nobody at Rhythme browses your diary.
5. A friend, not a doctor: Rhythme helps you notice patterns. It does not diagnose and never replaces care. In an emergency, call 995.
6. Always your choice: Switch Luna's reading off in her settings, and export or delete your records any time from You.
Choice (pre-ticked): Help make Rhythme better. Share de-identified patterns, never your name or the words in your diary, so predictions improve for everyone. You can change this in Luna's settings.
Note: Under 16? Please read this with a parent or guardian.
Button: I agree, open my room. Small print: By tapping, you agree to the privacy notes and terms. Rhythme needs your OK to work, so the room stays closed until then. Nothing has been saved yet.

## Please answer (markdown, at most 900 words, no em dashes)
1. Problems with the current text: anything inaccurate today, anything that will become inaccurate once server
   collection starts, promises that are risky to make, and gaps under Singapore's PDPA (consent, purpose limitation,
   notification, overseas transfer, sensitive health data, withdrawal, minors), PDPC guidance, Apple App Store 5.1.1
   to 5.1.3 and Google Play health app rules.
2. What must be optional rather than a condition of using the app, and whether "pre-ticked" is acceptable for the
   improvement and research choice in Singapore and on the app stores.
3. How to describe overseas AI processing honestly without naming the vendor.
4. A full replacement: title, sub, up to 7 cards (heading plus one or two plain sentences each), the choices (with
   default state), the under-16 note, button and small print. Plain, warm, specific; no legal jargon; accurate today
   and with a clear way to stay accurate when cloud storage arrives (for example a versioned notice that asks again).
5. Three things the app must never say.
