# 01. Game design

## 1. Pitch

Scrub Club is a local co-op hospital game for 1 to 4 players. Patients come in like orders in a busy kitchen. Each one needs a short list of tasks, the clock is always running, and the team has to split up, share scarce equipment, and decide who gets seen first. It is light and funny, but the medicine always makes sense: a broken arm gets a cast, never an EKG, and a headache never suddenly needs a shock.

### Pillars

1. **Busy work that makes sense.** Every task is simple on its own. The challenge is the pile-up, the sorting, and the teamwork.
2. **Readable at a glance.** Anyone can tell what's wrong with a patient from across the room using a small, consistent set of visual cues.
3. **Co-op by design.** Parallel tasks, shared equipment, and codes that need two people push players to talk and split up.
4. **Medically honest, never preachy.** Real logic under simplified labels. Learning is optional and light.

## 2. Audience and tone

- Equal footing for medical and non-medical players. Nobody needs medical knowledge to earn stars; medical players just recognize more of the jokes and patterns.
- Tone is light but grounded: cartoon characters, real medicine. Entertainment comes first; the game is not a teaching tool.
- In-game text uses simplified labels: "blood test," "EKG," "shock," "clot-buster," "reversal shot." Real condition names appear only in this spec for the team's reference.

## 3. Core loop

1. A patient arrives (or is already in a bed) and a ticket appears.
2. Players read the cue and the ticket, decide priority, and split up.
3. Players do tasks: walk to stations, grab items, hold or play short minigames at the bedside.
4. Some tasks start a wait (labs, scans). Results can change the plan.
5. When the patient's tasks are done, players finish the patient (discharge, sign, or transport, depending on tier).
6. Meanwhile chores pile up (dirty beds, empty supplies) and must be cleared to keep working.
7. The level ends when the clock runs out (or, in full-floor levels, at shift end). Points become 1 to 3 stars. Too many strikes ends the level early.

## 4. Patients

### 4.1 Tickets

Every patient has a ticket in the ticket rail (clipboard style, see `06-art-audio-ui.md`) showing the simplified complaint, an acuity color strip, the task chips, and a patience bar.

**Ticket modes (set per level):**

| Mode | What the ticket shows | Used in |
|---|---|---|
| `full` | Every task from the start | Tier 1 and early tier 2 |
| `assess` | Only the complaint, plus "Ask questions" and "Check vitals." Doing those reveals the rest of the tasks | From ED-B (level 6) onward |

In full-floor levels, routine needs (scheduled meds, sugar checks) appear as tickets, but judgment events (a patient suddenly turning blue, a hidden clot) do not. Players read them from the patient's cues, which every briefing teaches.

### 4.2 Acuity

Acuity runs 1 (most critical) to 5 (least urgent). In game it is only a color and a patience timer; the number never shows.

| Acuity | Color | Default patience (s) | Example |
|---|---|---|---|
| 1 | Red | 30 | Major bleeding, cardiac arrest |
| 2 | Orange | 45 | Heart attack, stroke, anaphylaxis |
| 3 | Yellow | 60 | Asthma attack, appendicitis |
| 4 | Green | 75 | Broken arm, sprain |
| 5 | Blue | 90 | Sore throat, blisters |

Patience values are defaults; each condition can override them in data. All numbers in this spec are first-pass values to tune in playtests.

### 4.3 Base tasks

Each setting defines the tasks every patient there starts with:

| Setting | Base tasks |
|---|---|
| Clinic, ED, Wards, Cruise | Ask questions (HPI) + Check vitals |
| Marathon | Quick check (vitals) |
| Ambulance, Mass Casualty | Scene check (triage look) |
| Surgical Suite | Pre-op check + Time-out |
| ICU | None (patients are already worked up; problems come from events and procedures) |

In `assess` mode the base tasks reveal the remaining tasks. Exceptions are allowed when real medicine treats first: an allergic reaction gets the allergy shot before any questions.

### 4.4 Hidden conditions

Some patients look mild but hide something dangerous ("Dizzy" turns out to be internal bleeding; "Indigestion" is a heart attack). Rules:

- The ticket shows the mild complaint and a mild acuity.
- Completing the base tasks reveals the true condition, true acuity, and the real task list.
- The med student's extra clue (see `02-roles-and-controls.md`) can reveal it during the first question.
- If nobody works them up, they escalate on the hidden condition's schedule.

### 4.5 Patience, escalation, and warnings

- Every patient has a patience timer. Low-acuity patients who run out get annoyed and **leave** (1 strike). Critical patients (acuity 1 to 2) never leave; they escalate instead.
- **Only conditions with an escalation path can get worse.** A headache, blister, or sprain never escalates beyond leaving. Escalation timing varies a little each run (seeded jitter), but nothing is truly random.
- **Two-stage warning.** First a subtle cue (sweat, tint, posture) appears on the patient. If ignored, a clear badge appears above them and the remaining time is shorter.
- **Partial treatment buys time.** Some tasks slow or pause escalation without finishing the patient (oxygen for a blue patient, ice for an overheated runner). Each condition lists which tasks slow it.
- Final escalation outcomes: a code (flat line or zigzag), a rescue transfer, or death if a code is lost.
- Levels before codes are taught (1 to 9) cap escalation at a rescue transfer, so nobody codes in the early game.

### 4.6 Wrong actions

Players can do the wrong thing. The penalty scales with harm:

| Severity | Example | Effect |
|---|---|---|
| Trivial | Wrong X-ray on a sprain | −5 points, time wasted |
| Harmful | Water for a low-salt runner, wrong blood bag, wrong surgical site | −20 points, patient worsens one stage |
| Overdose | Dosing meter pushed past the safe zone | −15 points, patient goes sleepy with slow breathing and needs a reversal shot |

### 4.7 Finishing a patient (disposition)

How a finished patient leaves depends on the level's disposition mode:

| Mode | How it works | Tiers |
|---|---|---|
| `auto` | Patient walks out on their own when all tasks are done | 1 |
| `sign` | A player signs the patient out at a computer | 2 |
| `transport` | Planned transfers must be physically wheeled to the right exit (heart lab, OR, ICU, ambulance, helicopter). Home discharges still sign out | 3 to 5 |

**Planned vs. rescue transfers.** A planned transfer happens because the condition calls for it (a heart attack goes to the heart lab). It's a success and earns full points. A rescue transfer happens because a patient was neglected and got worse, so another team takes them. It costs points and 2 strikes.

### 4.8 Beds and the waiting room

Patients are roomed automatically: the sickest waiting patient (by the color their ticket shows) takes the next free bed, and the bed is a random one, so players criss-cross the floor. When every bed is taken, patients wait in the waiting room. There they only get triage (questions, vitals, and any treat-first shot); everything else waits for a bed, so finishing patients to free their beds is part of the pressure.

## 5. Codes

When a patient's heart stops, the monitor shows one of two lines:

| Monitor | Meaning | Fix |
|---|---|---|
| Flat line | Heart stopped | CPR + adrenaline shot |
| Zigzag line | Heart quivering | CPR + shock |

**Bed spots.** Every bed has four spots, and each spot holds one player at a time. Different players can work different spots on the same patient at once.

| Spot | Tasks |
|---|---|
| Chest | CPR |
| Head | Oxygen, intubation, bagging |
| Arm | IV, meds |
| Side | Shock pads, defibrillator |

**Stabilize (needs 2 players).** CPR has to keep running at the chest while a second player delivers the fix (shock for zigzag, adrenaline for flat line, airway if the patient is blue). One player alone can technically do it only with near-perfect play, by design.

**Maintain (1 player).** Once a pulse returns, one player can stay to watch the patient, give meds, and handle the planned transfer.

**Nothing slows down during a code**, in any mode. The rest of the floor keeps going; the team simply falls behind.

**Solo play.** In solo, the character you swap away from keeps doing compressions at normal grade, so one player can run a code by swapping between two characters.

Teammates can help in quick bursts by throwing defib pads onto the patient or bringing the crash cart. Losing a code means death (see 12).

**Code clock.** A code is lost if the heart isn't restarted within 45 seconds (draft). Some patients arrive already in a code (collapsed at home, collapsed at the finish line); the clock starts when they arrive. The clock and the fix for each line live in `data/rules.json`.

## 6. Signal language

These cues mean the same thing everywhere. Briefings teach them; non-medical players learn the whole game from this table.

| What players see | What it means | What to do |
|---|---|---|
| Flat line on monitor, patient limp | Heart stopped | CPR + adrenaline shot |
| Zigzag line on monitor, patient limp | Heart quivering | CPR + shock |
| Blue tint, gasping | Not enough oxygen | Oxygen; intubate if it gets worse |
| Pale white tint, wobbly | Losing blood | IV + blood transfusion |
| Sweating, clutching chest | Heart attack | EKG, aspirin, heart lab |
| Red face, steam wisps | Overheated | Cooling (ice bath) |
| Shivering, frost on skin | Too cold | Warm blanket + warm drink |
| Puffy face, red blotches | Allergic reaction | Allergy shot |
| Shaking | Seizure | Seizure med |
| One side of face drooping | Stroke | Brain scan, then clot-buster |
| Very sleepy, slow breathing | Too much medicine (or opioid overdose) | Reversal shot |
| Sweaty, shaky, confused (diabetic) | Sugar too low | Sugar check, juice or sugar IV |
| Shaking, sweating, swatting at bugs | Alcohol withdrawal | Withdrawal med + calm down |
| Steam from ears, foot tapping | Losing patience | Calm down, or treat faster |

Cues never rely on color alone: each has a shape or motion and a text badge.

## 7. Items, stations, and equipment

- Players carry one item at a time (the tech carries two).
- **Stations** are fixed spots where tasks happen: computer, med cabinet, lab tube, imaging room, supply closet, sink, crash cart, and setting-specific ones (ice bath, scrub sink, organ cooler).
- **Item chains.** Some tasks produce items that travel: draw blood → carry the tube to the lab → result arrives at the printer after a delay → the result attaches to the ticket and can change the plan.
- **Order then wait.** Labs, scans, and similar tasks start a timer (draft: labs 18 s, X-ray 10 s, CT 15 s). Players should do other work meanwhile.
- **Scarcity.** Key equipment is shared and limited (one crash cart, one EKG machine, one C-arm, one dialysis machine) and has to be wheeled where it's needed and returned or recharged.
- **Throwing.** Players can throw what they hold:
  - Blood tubes that land badly break: −5 points and a spill to clean.
  - Defib pads thrown onto a coding patient count as placing the pads.
  - A needle or syringe that hits a teammate sticks them: that teammate goes to get checked out and is out of play for 5 seconds.

## 8. Chores

Chores are the dish-washing of Scrub Club: they pile up and block work if ignored.

- Bed turnover (clean and fresh linen) before a new patient can use a bed, including after a death.
- Restocking supply stations.
- Recharging the defibrillator after use.
- Cleaning spills (broken tubes, seasick puddles).
- Setting-specific: emptying bedpans in the dirty utility room, sterilizing instrument trays, refilling ice, swapping drain jugs, refueling floodlights.

## 9. Scoring, strikes, and stars

### Points (draft)

The live numbers for patience, points, strikes, and player-count scaling are in `data/rules.json`; tune them there.

| Event | Points |
|---|---|
| Patient finished, acuity 5 / 4 / 3 / 2 / 1 | +20 / +30 / +40 / +60 / +80 |
| Speed bonus | Up to +50% of that patient's points, based on time left on their patience bar |
| Planned transfer | Full patient points |
| Full-floor levels | Points per completed task (5 to 15) + 40 per patient stable at shift end |
| Patient leaves | −10 |
| Wrong action | −5 to −20 |
| Overdose | −15 |
| Rescue transfer | −20 |
| Death | −40 |
| Broken tube | −5 |

Minigame accuracy never adds points directly; a better grade only finishes the task faster.

### Strikes

| Event | Strikes |
|---|---|
| Patient leaves | 1 |
| Rescue transfer | 2 |
| Death | 3 |

Each level sets a strike limit (tier defaults: T1 9, T2 8, T3 6, T4 5, T5 4). Hitting it ends the level immediately with no stars.

### Stars

Each level stores 1, 2, and 3 star thresholds for one player. Thresholds scale with player count: × 1.0 (1P), × 1.25 (2P), × 1.5 (3P), × 1.75 (4P).

### Player-count scaling

Everything scales with player count except the map:

| Players | Spawn interval | Starting census (full floor) | Star thresholds |
|---|---|---|---|
| 1 | × 1.6 | −2 patients | × 1.0 |
| 2 | × 1.25 | −1 patient | × 1.25 |
| 3 | × 1.0 | base | × 1.5 |
| 4 | × 0.85 | +1 patient | × 1.75 |

## 10. Levels

### Formats

| Format | Description |
|---|---|
| Inflow | Patients arrive over time |
| Full floor | All patients start in beds; manage them through the shift |
| Surge | A big wave arrives at once (mass casualty, finish line) |
| Boss | One very sick patient with many steps while everything else keeps running |

The briefing always says which format the level is.

### Difficulty tiers

Five tiers (T1 tutorial to T5 finale). Settings interleave across the campaign (never the same setting twice in a row), and each setting returns harder. Chaos gimmicks appear only from tier 3. See `05-levels.md`.

### Length

5 to 6 minutes (T1 to T2: 5:00, T3 to T5: 6:00). Level 1 has no timer.

## 11. Briefings

Before each level, a briefing card shows:

1. Level name, setting, and format.
2. The one new mechanic, with a short looping animation and its controls.
3. An optional one-line medical fact (players can turn these off in settings).

There is no post-level case review.

## 12. Death

Death is cartoon style and quick: eyes turn to X's, the tongue sticks out, and the patient is wheeled away and fades out. The bed then needs turnover. It costs 40 points and 3 strikes. Never graphic.

## 13. Progression

- **City map.** The hospital campus sits in the center (Clinic, ED, Wards, ICU, Surgical Suite with rooftop helipad). Off-site pins surround it: the marathon route, the highway (Ambulance), the port (Cruise), and the stadium (Mass Casualty).
- **Unlocking.** Earning at least 1 star unlocks the next level. Tier gates need a star total (draft: T2 8 stars, T3 18, T4 30, T5 42).
- **Unlockables.** Roles (Tech, RT, Pharmacist), cosmetics (hair styles, caps, accessories), and character presets. Purely skill based: no upgrades that make levels easier.
- **Save.** Progress, stars, unlocks, customization, and settings are saved locally in the browser.

## 14. Content rules

- **No pediatrics.** No child patients anywhere (this also rules out L&D and newborns).
- **Substance use is allowed:** opioid overdose with a reversal shot, alcohol withdrawal on the wards.
- **No psych patients.** Agitated patients and the calm-down mechanic are fine.
- **Non-graphic always.** Surgery happens under drapes; amputations are a drape and a cartoon "poof."
- **Medical accuracy.** Every condition's tasks and escalation come from `04-settings-and-patients.md`, which the team's medical reviewer owns. Simplify, but never teach something wrong (for example: heat stroke gets cooling only, never fever medicine).
