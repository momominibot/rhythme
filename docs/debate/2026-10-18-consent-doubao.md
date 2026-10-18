# Independent review

## 1. Problems with the current text

### Inaccurate or incomplete today

- “Your diary is saved on this phone” is misleading. Luna sends individual notes and food photos, plus 7 or 28 day journal summaries containing entries, cycle day and onboarding answers, to Rhythme’s server and then to a third-party AI provider hosted in China.
- “Without your name” does not mean anonymous. Notes, photos, photo metadata, rare symptoms, diagnoses, medicines and network information can identify someone.
- “Her answer comes straight back” omits the third-party AI provider, the overseas location, retention, model training, legal access and contractual safeguards.
- “Nothing has been saved yet” is unsafe while GitHub Pages and Google Fonts may receive IP addresses and request data before the button is tapped. Premium redemption also records code use and a hashed network address.
- The collection list omits pain, weight, medicines, diagnoses, pregnancy and hormone information, family history and other sensitive onboarding answers.
- “Nobody at Rhythme browses your diary” is an absolute promise that support logs, error logs or future administrative tools could break.
- The improvement choice describes processing that does not exist today and says it can be changed in Luna settings, although it is a separate privacy purpose.

### Will become inaccurate once collection starts

- Cloud backup and sync will make “saved on this phone” false. Existing diaries should not be migrated until a new notice is shown and separate consent obtained.
- De-identified health patterns may still be identifiable or re-identifiable. “Never your name or words” must be technically and contractually enforced.
- Delete-everything must cover Rhythme servers, backups, logs and the AI provider’s processing, not only browser data.

### PDPA and app-store gaps

A complete privacy policy is required now, not later. It must include the DPO contact, exact purposes, categories of recipients, retention, security, access and correction rights, withdrawal and its consequences, breach handling and section 26 overseas-transfer safeguards.

Consent must be specific and unbundled. Health data is not a separate statutory category under the PDPA, but it is high-risk and the PDPC expects clear, granular protection and consent. The under-16 sentence is not a consent mechanism. Users aged 13 to 16 need age-appropriate information and documented guardian involvement; under-13 use requires parental setup and verifiable consent where applicable.

Apple 5.1.1 to 5.1.3 require a privacy policy, data minimisation, affirmative consent, clear third-party disclosure, no unrelated advertising or data mining, restricted health research with appropriate ethics approval, and compliance with iCloud limits. Google Play health rules require prominent disclosure, explicit consent, use limited to requested features, no sale or advertising use, accurate Data Safety information, deletion pathways and Families compliance where children are involved.

## 2. What must be optional

The following must not be conditions of basic use:

- Luna AI reading of notes, photos or journal summaries.
- Cloud backup and sync, if a local mode remains available.
- Product improvement using de-identified patterns.
- Any future research.

Premium-code fraud checks may be required only to redeem a code. Basic hosting connections may be necessary, but they should be minimised; self-host fonts or delay third-party font loading until consent.

A pre-ticked box is not acceptable for improvement or research. PDPA consent must be voluntary, clear and unambiguous; silence or a preselected option is not sufficient for secondary, sensitive processing. Apple and Google likewise require affirmative, explicit consent for health data and optional sharing.

## 3. Describing overseas AI processing without naming the vendor

The trade name may be omitted from a short card, but the third-party role, country and processing limits must not be. Use language such as:

> Luna uses a third-party AI provider hosted in China. If you turn Luna on, Rhythme sends only the note, photo or summary you ask her to process, without an account name. The provider may use it only to return Luna’s answer and is contractually prohibited from retaining it or using it for model training, except where law requires otherwise. Provider details and safeguards are in the privacy policy.

Do not use the retention or training prohibition unless the contract and technical configuration actually support it. The full policy should identify the provider or maintain an up-to-date subprocessor list with a contact for details.

## 4. Replacement first-launch notice

**Title:** Before your room opens  
**Subtitle:** What Rhythme stores, why, where it goes, and the choices that stay yours.

1. **Your room is on your phone**  
   Today, your periods, symptoms, pain, mood, sleep, meals and food photos, mindfulness minutes, weight and onboarding answers stay in this browser. There is no account and no Rhythme cloud yet.

2. **Luna is optional**  
   Luna is off by default. If you turn her on, your selected note or photo, or a 7 or 28 day summary, goes to Rhythme’s server and a third-party AI provider hosted in China. No account name is attached, but the item may contain identifying health information.

3. **How Luna’s provider may use it**  
   The provider may process the item only to return Luna’s answer. It is contractually prohibited from retaining it or using it for model training, except where law requires otherwise.

4. **Limited service information**  
   Redeeming a premium code records the code and a hashed network address only to prevent misuse. GitHub Pages and Google Fonts create standard connection logs; we use no analytics or advertising.

5. **Improvement and research are separate**  
   Product improvement is off by default. If you opt in, Rhythme may upload de-identified patterns, but not notes, photos, journal text, names or account details. We will ask separately before any research.

6. **You stay in control**  
   Turn Luna off, export your data or delete everything on this device at any time. Before cloud backup or sync starts, we will show a new versioned notice and ask before upload, including how to delete server data.

7. **A friend, not a doctor**  
   Rhythme helps you notice patterns, but it does not diagnose or replace medical care. Call 995 in an emergency.

**Choices**

- [ ] **Enable Luna readings.** Send selected notes, photos or summaries to an AI provider in China. Default: off.
- [ ] **Help improve Rhythme.** Share de-identified patterns, not notes, photos, journal text or name. Default: off.
- **Cloud backup and sync:** not available yet; default: ask before enabling.
- **Research:** no permission requested now; Rhythme will ask separately later.

**Under-16 note:** If you are 13 to 16, a parent or guardian must complete setup with you and confirm the extra safeguards. If you are under 13, a parent or guardian must set up and agree to the app for you.

**Button:** I agree, open my room

**Small print:** By tapping, you agree to the Privacy Notes and Terms. Optional features remain off until you choose them. Version 1.0, [date]. Full privacy policy and DPO contact: [link]. We will ask separate consent before cloud storage, new recipients, research or materially different uses.

## 5. Three things the app must never say

1. “Your data is anonymous because no name is attached.”
2. “Everything stays on your phone” while Luna, hosting, fonts or cloud transfers are operating.
3. “By tapping, you consent to all future uses, including research or marketing, without further notice.”