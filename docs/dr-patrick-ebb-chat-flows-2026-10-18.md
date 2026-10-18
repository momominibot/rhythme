# Dr Patrick's input: "Ebb cycle chat flows" (captured 2026-10-18)

Source: Claude design artifact shared by Jamie, https://claude.ai/artifact/JyaQj91q6gMDiv6aKm4YNu (12 phone screens, 390x844, titled *Ebb cycle chat flows*). Text below is the on-screen copy of each screen, extracted from the design's HTML on 2026-10-18. Raw HTML per screen is kept outside the deploy repo in `ovumind-art-src/ebb-chat-flows-2026-10-18/`.

This is reference material from a third party. It describes a chat-first cycle companion called **Ebb** with an optional 60-second camera HRV scan. It is not a spec we have agreed to; the mapping to Ovumind lives in `docs/ebb-to-ovumind-mapping-2026-10-18.md`.


## 1 · Onboarding in chat

### 1a Welcome and first question  (`Main.dc.html`)

```text
E

Ebb

Your cycle companion · setting up

1 of 3

Hi, I'm Ebb. I help you chart your cycle just by talking to me. No forms to fill in.

Everything you tell me stays private to you. You can export or delete it at any time.

To start: when did your last period begin?

Today
A few days ago
Pick a date
Not sure

around 4 Oct I think

I'll save this

Last period startedSat 4 Oct

CertaintyApproximate

Looks right
Change

Approximate is fine. I'll get more precise as you log.

Message Ebb
```

### 1b Goals and context  (`Onboard-Goals.dc.html`)

```text
E

Ebb

Your cycle companion · setting up

2 of 3

Thanks. What would you like help with? Pick as many as fit.

Understand my body
Manage symptoms
Trying to conceive
Perimenopause
Something else

Mostly cramps, and mood swings the week before my period

That's really common, and charting helps a lot with both. I'll watch for patterns and tell you what I see.

Are you using any hormonal contraception? It changes how I read your cycle.

No
The pill
Hormonal IUD
Implant or injection
Prefer not to say

You can change any of this later just by telling me.

Message Ebb
```

### 1c Connect Ebb and consent  (`Onboard-Ebb.dc.html`)

```text
E

Ebb

Your cycle companion · setting up

3 of 3

One more thing. A 60-second scan with your phone camera lets me read your heart-rate variability, stress and recovery.

It helps me see where you are in your cycle, even on days you don't log anything.

How would you like to scan?

Face

Fingertip

You decide what I use

Use my HRV, stress and sleep for cycle insights[x]
Contribute de-identified data to women's health research[ ]

Camera video is processed on your phone and never uploaded. Only the readings are kept.

Start first scan
Skip for now

Message Ebb
```


## 2 · Logging by talking

### 2a Quick log with confirm card  (`Log-Quick.dc.html`)

```text
1

Day 1 · Period

Fri 31 Oct · inside predicted range

Today 8:12 am

started bleeding this morning, light, cramps maybe 5/10, slept badly

Got it. Day 1 of a new cycle.

I'll save this

Period startedToday, about 7:00

FlowLight

Cramps5 / 10

SleepPoor

Looks right
Edit

Right on time. It's inside the 31 Oct to 3 Nov range I predicted. Your cycle that just ended was 27 days, within your usual 27 to 30.

Add a symptom
Took a painkiller
Done for today

Message Ebb
```

### 2b One clarifying question  (`Log-Clarify.dc.html`)

```text
27

Day 27 · Late luteal

Period likely in 1 to 4 days

Thu 30 Oct · 6:40 pm

bit of brown discharge today

Noted. Is this the start of your period, or spotting?

Period started
Just spotting
Not sure yet

I'm asking because it decides the start date of your next cycle.

Just spotting

**Saved** · Spotting, brown · today
Undo

Spotting a day or two before a period is common for you: it happened in 2 of your last 3 cycles. I'll check in tomorrow morning.

Message Ebb
```

### 2c Correction and backfill  (`Log-Correct.dc.html`)

```text
8

Day 8 · Follicular

Next period likely 28 Nov to 1 Dec

Fri 7 Nov · 9:05 pm

actually my period ended on Tuesday not Wednesday

Updated

Period endedWed 5 Nov Tue 4 Nov

Period length5 days

Undo this change

also had a migraine on day 2

Added to Sat 1 Nov (Day 2)

MigraineYes

Add severity or medication

That's the third cycle in a row with a migraine on Day 1 or 2. Want a reminder to keep your medication handy before the next one?

Yes, remind me
Not now

Message Ebb
```


## 3 · Nudges and insights

### 3a Timed nudge and check-in  (`Insight-Nudge.dc.html`)

```text
27

Day 27 · Late luteal

Period likely 28 Nov to 1 Dec

Wed 26 Nov · 8:30 am

Heads-up

Your period is likely to start in the next 2 to 5 days. In your last 3 cycles, cramps were strongest on Day 1.

Remind me to pack supplies
Snooze nudges
Why am I seeing this?

Why am I seeing this?

You asked for a heads-up 2 days before your earliest likely start. I send at most one nudge a day, never after 10 pm. Say "change my nudges" any time.

9:00 pm

Anything to note today?

Bleeding
Symptoms
All good

All good

Logged: nothing to note. Sleep well.

Message Ebb
```

### 3b Ask why, with Ebb HRV  (`Insight-Why.dc.html`)

```text
24

Day 24 · Late luteal

Period likely 28 Nov to 1 Dec

Sun 23 Nov · 10:14 pm

why am I so anxious this week?

You're on Day 24, your late luteal phase. Many people feel more on edge in the days before a period.

Your heart-rate variability by cycle day

Luteal

Day 1
Today
29

This cycle
Last 3 cycles

Your scans show HRV about 12% below your follicular average, the same dip as your last 3 cycles. Lower HRV often goes with feeling more stressed.

Seen in 3 of 3 cycles

3-minute breathing
Note for my doctor
Tell me more

Message Ebb
```

### 3c Chart view  (`Chart.dc.html`)

```text
Your chart

November 2026

SMTWTFS

{{d.n}}

Period
Predicted
Symptom logged
Today

Cycle length, last 6

Usual range 27 to 30 days

{{c.len}}{{c.m}}

Body signals by phase: HRV, resting heart rate, sleep

Ask about your chart
```


## 4 · Safety, care and privacy

### 4a Red-flag alert  (`Safety-Alert.dc.html`)

```text
3

Day 3 · Period

Sun 2 Nov

Today 3:20 pm

soaking through a pad every hour since lunch, feeling a bit dizzy

Please get checked today

Bleeding this heavily for several hours, especially with dizziness, should be seen by a doctor today.

If you faint, feel very weak or your heart is racing, call 995 now.

Find nearest A&E or clinic
Call 995
Show my chart to the doctor

I can't diagnose. This advice was written with clinicians. I've logged heavy flow and dizziness for today.

I'm getting help
It's easing now

Message Ebb
```

### 4b Doctor report  (`Safety-Report.dc.html`)

```text
13

Day 13 · Follicular

Next period likely 28 Nov to 1 Dec

I'm seeing the gynae on Friday. Can you prepare me?

Of course. Here's a one-page summary to show your doctor.

Cycle summary · last 6 cycles

PDF · 1 page

Cycle length27 to 30 days

Period length5 days typical

PainWorst Day 1, about 5/10

MigraineDay 1 to 2, 3 cycles

Premenstrual moodAnxiety, Days 22 to 27

FlaggedHeavy bleeding with dizziness, 2 Nov

Download
Share

Questions you might ask, based on your chart:
1. Could my Day 1 to 2 migraines be hormonal?
2. Should the heavy bleeding on 2 Nov be looked into?
3. What helps with anxiety before my period?

Edit questions
Add to calendar

Message Ebb
```

### 4c Privacy and data control  (`Safety-Privacy.dc.html`)

```text
13

Day 13 · Follicular

Next period likely 28 Nov to 1 Dec

who can actually see my data?

Only you. Here's exactly what I keep and where, and what you control.

Your chart lives on this phone, with an encrypted backup only you can unlock.

Camera video from scans never leaves your phone.

No ads, and your data is never sold.

Keep chat history (charted data stays either way)[x]
Contribute de-identified data to research[ ]
Share predicted period with a partner[ ]

Export my data
Delete everything

You can also just say "forget yesterday's log" or "delete my chat history".

Message Ebb
```
