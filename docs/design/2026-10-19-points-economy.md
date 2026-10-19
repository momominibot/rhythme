# Hearts: the points economy (19 October 2026, proposal for discussion)

Jamie: "I think the points system have to distribute it wisely. Discuss with codex, I want to encourage logging and let
people go hook up in the app for at least minimum 1 month and longer. We will release new drop on weekly basis." And:
"the main goal is to collect menstrual, sleep and all wellness data points so these loggings are important so we need
to give points once they have logged so that they can spend on the game."

## How hearts work today (ovu-rewards.js)

- Earning, per saved entry: sleep 10, period 10, symptom 8, food 6 plus 2 per item up to 6 more, reflection 5. Weight
  earns nothing (numbers are never rewarded). A formal session earns 2 a minute up to 20; an everyday practice 5 and 10
  more the first time; Moon Tap 2 per full minute up to 20; watering a plant counts as a practice. The first log of a
  day extends the streak; from day three the first log also pays a 5-heart bonus. Nothing is ever taken away.
- Spending: pets 150 to 220, treats and accessories (prices in the catalogue), furniture, homes. Two pets at home at a
  time. Tester mode never deducts.
- Showing: a heart counter in the top bar; "+N" in the toast after a save; the You card ("N hearts · n-day streak").

## What we want it to do

1. Reward the data that matters most, every day, without making logging feel like a chore or a slot machine.
2. Keep a person coming back for a month and beyond: a visible journey with things to look forward to.
3. Give the weekly drop a reason: something new to want each week, affordable from a week of honest logging.
4. Stay kind. This is a health app: no loss, no shame, no countdown pressure, no paying real money for hearts.

## Proposal (to be reviewed)

- **A daily rhythm, not a grind.** The first sleep log, the first cycle note (period, symptom or "nothing today") and
  the first meal of the day each pay once; extra logs of the same type pay a little (2) so there is no farming. A
  "full day" (sleep + cycle + one meal) pays a 10-heart bundle on top. A typical honest day earns 30 to 45; a week 250
  to 300, which is one pet or a furniture piece: the weekly drop is reachable from one week of logging.
- **Streaks that forgive.** Keep the streak, add milestones at 7, 14 and 30 days with a gift each (a plant, a lamp, a
  pet accessory) and a "rest day" token earned every 7 days that keeps the streak through one missed day. Never show
  a broken streak as a loss; show the count and the next milestone.
- **A 30-day journey.** The plot already grows with logged days (stages at 1, 22, 40, 52, 58, 62 days); add the
  garden's first bloom at day 7, the hen house at day 14 (eggs to collect each morning you log), the hot spring at day
  30. Each is unlocked by logged days, bought with hearts, so the game reads the data back to the person.
- **Weekly drops.** Every Monday one to three new shelf items appear with a "new this week" tag for seven days, then
  stay in the catalogue at a higher price, so a week's hearts spent on time feel good and nobody is punished for
  missing a week. Drops are content, not mechanics: a new outfit, a pet accessory, a furniture piece, a tea.
- **Sinks that fit the fiction.** Treats (pets eat), seeds (the plot), bath salts (the bath house), a coffee at the
  tea stall. Small, repeatable, cosy.
- **Caps.** Per day at most 60 from logs and 30 from practice, so the economy cannot be gamed and a very busy day does
  not dwarf a normal one.
- **Transparency.** A "How hearts work" card in You, in plain words, with today's earning and what is left to earn.

## Questions for the review

- Does the daily bundle risk making people log "nothing today" just for hearts, and is that bad for the data?
- Are milestone gifts and rest-day tokens kind enough, or do they still exploit loss aversion?
- Is a weekly drop with a seven-day "new" window a dark pattern in a health app, or acceptable because the item stays?
- What do the best habit and cosy games actually show about month-one retention, from sources, not folklore?

## What the Codex review found (19 Oct, with sources in the review; decisions for Jamie)

- **The evidence is thinner than the folklore.** Duolingo's own experiments show small gains from an easier daily
  threshold and from forgiveness (a weekend break, freezes), not from bundles or milestones; a diary-and-pet trial in
  young people improved completion but not significantly; two randomised studies found no advantage for variable
  rewards; the "66 days" habit figure is a modelled median with a range of 18 to 254 days; a meta-analysis of 38
  health-app studies found no link between the number of gamification elements and adherence. Habitica's penalties
  pushed people to game the system. So: predictable rewards, forgiveness that is free, and measure.
- **Accounting holes first.** An edited record is awarded again; Moon Tap's cap is per call, not per day; pet care pays
  up to 10 a pet a day (six pets: 60); one-time gifts are looked up in a log that is truncated; garden credit counts
  imported history; the watering first-time bonus would have repeated (fixed in this change). Durable per-domain,
  per-date receipts and one central daily cap are needed before any balancing.
- **Drop the "full day" bundle and extra-log payments**: they make a missing meal or cycle note cost hearts and invite
  invented entries. Replace with a small first check-in bonus and one award per domain per date; explicit "no
  bleeding", "no symptoms", "unknown" and "prefer not to say" are different things and must be stored as such.
- **Forgiveness is free and from day one**: cumulative participation days, pause any time, no repair purchase; streaks
  as an optional display with no money attached. Milestones at 7, 14 and 30 participation days with free gifts.
- **Weekly drops stay at the same price afterwards**; the "new this week" tag is enough. At least one affordable item.
- **Keep care and consent out of the economy**: no hearts for permissions, sharing, plaza chat, weigh-ins or health
  outcomes; the scale's recording works without buying the prop; an urgent flag suppresses celebration.
- **The garden's real stages are 0, 1, 3, 6, 10 and 15 credited days** (the proposal quoted drawing sizes).
- **Recommended starting rules** (a hypothesis to test, not a formula): first check-in of the day 5; sleep 10; one
  combined cycle/body check-in 10; one chosen wellness check-in (mood, reflection or a meal) 5; practice 2 a completed
  minute with everyday practices at 5, all practice capped at 10 a day; everything else 0; 40 a day overall. Weekly
  items 40 to 100 with one larger piece at 150 to 220; consumables 2 to 5.

The rules live in ovu-rewards.js and room.js (the other session's files). Nothing in the economy has changed yet
beyond the watering fix; the table above is what Jamie is asked to approve or adjust.
