# 05. Levels and campaign

## 1. Campaign overview

25 levels across 9 settings and 5 tiers. Settings interleave (never the same setting twice in a row), each setting returns harder, and difficulty rises tier by tier.

| # | Tier | Setting | Level | Format | Introduces |
|---|---|---|---|---|---|
| 1 | 1 | Clinic | CL-A First Day | Inflow, untimed | Movement and basic tasks |
| 2 | 1 | ED | ED-A Triage Time | Inflow | Ticket rail, acuity colors |
| 3 | 1 | Clinic | CL-B Double Booked | Inflow | Parallel tasks, shared cart |
| 4 | 1 | Marathon | MR-A Mile 13 | Inflow | Outdoors, back-to-race bonus |
| 5 | 2 | Wards | WD-A Morning Rounds | Full floor | Scheduled meds, dosing, discharges |
| 6 | 2 | ED | ED-B Mystery Symptoms | Inflow | Assessment reveals tasks |
| 7 | 2 | Clinic | CL-E Just Indigestion | Inflow | Hidden conditions, planned transfer |
| 8 | 2 | Ambulance | AM-A First Call | Calls | Scene, loading, driving |
| 9 | 2 | Surgical Suite | OR-A Time-Out | Inflow (slow) | The surgery skeleton |
| 10 | 3 | ED | ED-E Code Blue | Inflow + code | Deterioration alarms, first code |
| 11 | 3 | Marathon | MR-B Heat Wave | Inflow → surge | Ice baths, low-salt trap |
| 12 | 3 | ICU | IC-A Alarm Fatigue | Full floor | Real vs. false alarms, intubation |
| 13 | 3 | Cruise | CR-A All Aboard | Inflow | Fetching patients around a rocking ship |
| 14 | 3 | Wards | WD-D Night Wanderers | Full floor | Wandering patients, calm down, withdrawal |
| 15 | 3 | Clinic | CL-G Flu Season Meltdown | Surge | Clinic at full speed |
| 16 | 4 | Ambulance | AM-B Highway Pileup | Surge | Tourniquets, two-person carries |
| 17 | 4 | Surgical Suite | OR-D Bleeder | Boss | Suction + clamp under pressure |
| 18 | 4 | ICU | IC-C Lights Out | Full floor | Power outages, lung and belly drains |
| 19 | 4 | ED | ED-R Rush Hour | Inflow (high rate) | Chaos gimmicks in full force |
| 20 | 4 | Cruise | CR-G Rogue Wave | Inflow + evac | Tilting deck, helicopter deadline |
| 21 | 5 | Surgical Suite | TX-A Special Delivery | Inflow | Transplants |
| 22 | 5 | Clinic | CL-H Overflow Day | Inflow (high rate) | Sick patients in a small clinic |
| 23 | 5 | ICU | IC-F Double Code | Full floor | Two codes at once |
| 24 | 5 | Mass Casualty | MC-D Stadium Collapse | Surge (waves) | Triage tags, ambulance loading |
| 25 | 5 | Mass Casualty | MC-F Field Hospital | Full floor + surge | Finale: everything at once |

### Tier defaults

| Tier | Length | Strike limit | Tickets | Disposition | Gimmicks | Stars (1 player) |
|---|---|---|---|---|---|---|
| 1 | 5:00 (level 1 untimed) | 9 | `full` | `auto` | None | 150 / 250 / 350 |
| 2 | 5:00 | 8 | `full`, then `assess` from level 6 | `sign` | None | 200 / 340 / 480 |
| 3 | 6:00 | 6 | `assess` | `transport` | 1, mild | 260 / 430 / 600 |
| 4 | 6:00 | 5 | `assess` | `transport` | 1 to 3 | 300 / 500 / 700 |
| 5 | 6:00 | 4 | `assess` | `transport` | 2 to 3 | 340 / 560 / 800 |

In `sign` mode, planned transfers are signed out at the computer and NPC staff take the patient away.

**Escalation cap.** Before level 10 (where codes are taught), escalation stops at a rescue transfer: nobody codes or dies in levels 1 to 9. Levels set this with `maxEscalation: "rescue"`. Star thresholds scale with player count (`01-game-design.md` §9). All numbers are first-pass values to tune.

---

## 2. Level specs

Times marked ± shift every run (seeded jitter) so replays feel different.

### 1. CL-A First Day
- **Tier 1, Clinic, inflow, untimed.** Fixed camera. No strikes. Tickets `full`, disposition `auto`.
- **New:** movement, pick up and put down, check-in, ask questions, check vitals, prescription at the computer, splint.
- **Patients:** one at a time, 5 total: `cl.sore-throat`, `cl.cough`, `cl.twisted-ankle`, `cl.sore-throat`, `cl.bp-check`.
- **Stars:** by finish time (draft): 1 star for finishing, 2 under 3:00, 3 under 2:15 (scaled up for more players since each patient is solo work).
- **Briefing:** "Welcome to Scrub Club. Walk up to a patient and hold Use to ask questions and check vitals. Their ticket tells you what's next."

### 2. ED-A Triage Time
- **Tier 1, ED, inflow, 5:00.** Fixed camera.
- **New:** the ticket rail and acuity colors. Choosing who goes first from the waiting room.
- **Patients:** `ed.chest-pain` (the orange one to prioritize), `ed.wheezing`, `ed.bad-cut`, `ed.headache`. `ed.broken-arm` waits until level 6, after the dosing meter is taught. Spawn every 22 to 30 s, max 4 waiting.
- **Hazard:** the waiting room crowd spills into the hallway.
- **Briefing:** "Colors show who's sickest. Red and orange first; green and blue can wait a bit."

### 3. CL-B Double Booked
- **Tier 1, Clinic, inflow (patients arrive in pairs), 5:00.** Fixed camera.
- **New:** two patients at once, parallel tasks, one shared supply cart that needs restocking.
- **Patients:** `cl.sore-throat`, `cl.cut-finger`, `cl.bp-check`, `cl.needs-shot` (first observation chair).
- **Hazard:** a rolling supply cart players must push out of the way.
- **Briefing:** "Two patients at a time. Split up!"

### 4. MR-A Mile 13
- **Tier 1, Marathon, inflow, 5:00.** Fixed camera.
- **New:** outdoor tent, quick check, back-to-race bonus exit.
- **Patients:** `mr.blisters`, `mr.cramps`, `mr.chafing`, `mr.ankle`, `mr.lightheaded`.
- **Hazard:** runners pass on the course beside the tent (scenery only at this tier).
- **Briefing:** "Patch them up fast and they run back into the race for bonus points."

### 5. WD-A Morning Rounds
- **Tier 2, Wards, full floor (6 beds), 5:00.** Fixed camera. Routine needs show as tickets.
- **New:** full-floor format, scheduled meds, the dosing meter (and the reversal shot for too much), discharges racing the family car.
- **Census:** `wd.low-sugar`, `wd.post-op-pain`, `wd.cant-breathe-lying`, `wd.discharge-day` ×2, `wd.bedpan`.
- **Events:** 1:00 ±15 s breakfast sugar checks due. 2:30 a new admission arrives by elevator once a discharged bed is turned over.
- **Hazard:** the meal cart loops the hallway.
- **Briefing:** "Everyone's already here. Keep them on schedule and get the ready ones home. Careful with the pain med meter: too much and they'll need a reversal shot."

### 6. ED-B Mystery Symptoms
- **Tier 2, ED, inflow, 5:00.** Tickets switch to `assess`.
- **New:** tickets show only the complaint; questions and vitals reveal the rest. The allergy shot is the one thing you give before asking questions.
- **Patients:** `ed.broken-arm`, `ed.wheezing`, `ed.allergic-reaction`, `ed.belly-pain` (planned OR), `ed.headache`.
- **Hazard:** bay curtains open and close.

### 7. CL-E Just Indigestion
- **Tier 2, Clinic, inflow, 5:00.**
- **New:** hidden conditions and the first planned transfer (ambulance pickup).
- **Patients:** `cl.indigestion` (guaranteed at 2:00 ±20 s), `cl.dizzy-sugar`, `cl.cough`, `cl.twisted-ankle`, `cl.cut-finger`.
- **Hazard:** a janitor mops; wet zones move around.
- **Briefing:** "Some patients are sicker than they look. Always ask questions and check vitals."

### 8. AM-A First Call
- **Tier 2, Ambulance, a sequence of 3 to 4 calls, 5:00.** Follow camera.
- **New:** scene check, loading the stretcher (one person pushes), driving (unsecured items slide), delivering at the ED door, radio alert bonus.
- **Calls:** `am.low-sugar`, `am.bee-sting`, `am.chest-pain`, then `am.hip` if time allows.
- **Hazard:** the rig swerves on turns.

### 9. OR-A Time-Out
- **Tier 2, Surgical Suite, slow inflow (one OR), 5:00.** Fixed camera. Longer briefing (the surgery skeleton).
- **New:** pre-op check, time-out, intubation, scrubbing in, open, sponge check, close, recovery.
- **Patients:** `or.appendix`, `or.hernia`, `or.appendix` (burst variant).
- **Hazard:** OR doors swing when pushed.

### 10. ED-E Code Blue
- **Tier 3, ED, inflow + guaranteed code, 6:00.** Fixed camera. Strike limit 6.
- **New:** deterioration alarms and the first code: CPR hitline, shock timing bar, two players to bring a patient back.
- **Gimmick:** swinging doors.
- **Hazard:** ambulance stretcher lane down the main hallway every 60 to 75 s.
- **Chores:** bed turnover, recharging the defibrillator after each shock, restocking the crash cart.
- **Briefing:** "Code blue! When a monitor goes flat or zigzags, that heart has stopped. Start CPR and hit the beats. Grab the crash cart: zigzag means shock, flat means an adrenaline shot. It takes two of you to bring them back. Once they have a pulse, one person can stay with them."
- **Optional fact:** "Good CPR is about 100 to 120 compressions a minute."

| Time | Event |
|---|---|
| 0:00 | Two walk-ins: `ed.broken-arm`, `ed.bad-cut` |
| 0:40 ±15 s | `ed.wheezing` |
| 1:10 ±15 s | `ed.chest-pain` arrives down the stretcher lane |
| 1:40 | `ed.headache` (never escalates) |
| 2:10 | `ed.belly-pain` |
| 2:30 ±20 s | Chest pain starts sweating if not yet sent to the heart lab |
| 3:00 ±20 s | Guaranteed code: `ed.collapsed` rolls into the resus bay mid-arrest |
| 3:45 | False alarm: bay 2 monitor beeps because a sticker fell off |
| 4:15 ±20 s | `ed.allergic-reaction` |
| 4:45 | `ed.dizzy-bleeding` (hidden) |
| 5:15 | `ed.seizure` |
| 5:30 to 6:00 | Final rush: `ed.bad-cut`, `ed.broken-arm` |

Stars (1 player): 260 / 430 / 600.

### 11. MR-B Heat Wave
- **Tier 3, Marathon, inflow that becomes a surge at 4:00, 6:00.** Fixed camera.
- **New:** ice baths (push the runner in, cool until the meter is green) and the ice refill chore. Twist: some confused runners need salt, not water.
- **Gimmick:** stampede lane (runner packs cross the entrance every ~30 s).
- **Hazards:** wind gusts blow light items; ice melts over time.
- **Briefing:** "Heat wave! Red-faced runners with steam coming off them are overheating. Get them into an ice bath and keep the tubs full. Careful: not every confused runner needs water. Check their salt first!"
- **Optional fact:** "Drinking too much water can dilute the salt in a runner's blood, which can be as dangerous as dehydration."

| Time | Event |
|---|---|
| 0:00 | `mr.blisters`, `mr.cramps` |
| 0:30 | `mr.chafing` |
| 1:00 ±15 s | `mr.lightheaded` |
| 1:40 ±20 s | First `mr.overheated` (tubs start full) |
| 2:20 | `mr.ankle`; ice levels start dropping |
| 2:50 ±20 s | `mr.low-salt` (hidden) |
| 3:30 | Wind gust blows cups and light items across the tent |
| 4:00 | Surge: 6 to 8 runners over 90 s, including 2 `mr.overheated` |
| 4:40 ±20 s | `mr.collapsed`: code with the only AED, then golf cart to the ambulance |
| 5:30 to 6:00 | Last runners; tent closes |

Stars (1 player): 240 / 400 / 560.

### 12. IC-A Alarm Fatigue
- **Tier 3, ICU, full floor (6 rooms), 6:00.** Fixed camera.
- **New:** the monitor bank. Telling real alarms from false ones. Intubating a patient who is tiring out.
- **Census:** `ic.on-vent` ×2, `ic.dka`, `ic.tiring-out`, `ic.post-heart-surgery`, `ic.med-overdose`.
- **Events:** 4 false alarms spread through the shift; `ic.tiring-out` needs intubation at 1:30 ±20 s; post-surgery racing heart at 4:00 ±20 s.
- **Gimmick:** robot mop.
- **Unlocks:** respiratory therapist.

### 13. CR-A All Aboard
- **Tier 3, Cruise, inflow, 6:00.** Follow camera.
- **New:** patients appear around the ship; fetch them with wheelchairs; stairs between decks.
- **Patients:** `cr.seasick`, `cr.sunburn`, `cr.slipped`, `cr.jellyfish`, `cr.too-much-sun`, `cr.shellfish`.
- **Gimmick:** deck tilt (gentle).

### 14. WD-D Night Wanderers
- **Tier 3, Wards, full floor, 6:00.** Fixed camera.
- **New:** wandering patients (lead them back), the calm-down bubbles, alcohol withdrawal.
- **Census:** `wd.wanderer` ×2, `wd.withdrawal`, `wd.bedpan`, `wd.post-op-pain`, `wd.missed-clot-shot`.
- **Gimmick:** rolling beds.
- **Hazard:** dim night hallways.

### 15. CL-G Flu Season Meltdown
- **Tier 3, Clinic, surge, 6:00.** Fixed camera.
- **New:** the clinic at full speed: observation chairs overflow, the phone never stops, and one heart attack hides in the crowd.
- **Patients:** `cl.cough` (heavy weight), `cl.needs-shot`, `cl.shot-reaction` (event), `cl.sore-throat`, `cl.indigestion` (one guaranteed), `cl.dizzy-sugar`.
- **Gimmick:** revolving door.
- **Unlocks:** pharmacist.

### 16. AM-B Highway Pileup
- **Tier 4, Ambulance, surge, 6:00.** Follow camera. Strike limit 5.
- **New:** tourniquets, two-person stretcher carries, choosing between cars.
- **Patients:** `am.bleeding-leg` ×2, `am.ladder-fall` (reskinned as neck pain after a crash), `am.hip`, `am.unresponsive`, `am.chest-pain`.
- **Gimmicks:** stampede lane (traffic lanes cross the scene), back doors swing open.

### 17. OR-D Bleeder
- **Tier 4, Surgical Suite, boss, 6:00.** Fixed camera.
- **New:** suction and clamp under pressure while the head player keeps giving blood.
- **Patients:** `or.spleen` arrives from the ED at 1:00 ±15 s. Background cases in OR 2: `or.hernia`, `or.appendix`.
- **Gimmick:** swinging doors. **Hazard:** surgical lights swing and leave dark spots.

### 18. IC-C Lights Out
- **Tier 4, ICU, full floor (6 rooms), 6:00.** Fixed camera.
- **New:** power outages (breathing machines stop; bag by hand until the generator restarts), lung drain, belly drain.
- **Gimmick:** lights roulette between outages.
- **Briefing:** "Lights out! When the power cuts, the breathing machines stop. Someone squeezes the bag on each beat while someone else runs to the generator."
- **Optional fact:** "Hospitals have backup generators, but staff still practice bagging by hand."

| Time | Event |
|---|---|
| 0:00 | Census: room 1 `ic.on-vent`, room 2 `ic.septic-shock`, room 3 `ic.heart-pump`, room 4 `ic.on-vent`, room 5 `ic.water-on-lung`, room 6 `ic.swollen-belly` |
| 0:45 ±15 s | Room 2 pressure-med pump runs low |
| 1:20 ±20 s | Outage #1 (45 s): lights drop to flashlight cones; bag rooms 1 and 4; restart the generator to end it early |
| 2:15 | False alarm: room 5 call light (wants ice chips) |
| 2:45 ±20 s | Room 3 heart-pump alarm: reposition + blood test |
| 3:20 ±20 s | Room 5 gets short of breath: lung drain |
| 3:50 | False alarm: room 4 breathing machine alarms because the patient coughed (just suction) |
| 4:20 ±20 s | Outage #2 (60 s); the generator stalls once |
| 4:50 | Room 6 belly drain; jugs fill and need swapping |
| 5:10 ±20 s | Room 2 crashes (flat line) if its pump was neglected |
| 6:00 | Shift ends: +40 for every stable patient |

Stars (1 player): 220 / 380 / 520.

### 19. ED-R Rush Hour
- **Tier 4, ED (large map), inflow at a high rate, 6:00.** Follow camera.
- **New:** chaos gimmicks in full force.
- **Gimmicks:** moving walkways (two, opposite directions), spinning triage desk, tube mixup, swinging doors.
- **Patients:** the full ED pool, weighted toward `ed.chest-pain`, `ed.very-sleepy`, `ed.dizzy-bleeding`, `ed.face-drooping`, `ed.fever-confused`.

### 20. CR-G Rogue Wave
- **Tier 4, Cruise, inflow + evac event, 6:00.** Follow camera.
- **New:** a strongly tilting deck; the evac helicopter only waits so long.
- **Gimmicks:** deck tilt + pool slosh.
- **Patients:** `cr.choking`, `cr.chest-pain` (helicopter evac at 3:30 ±20 s; the helicopter waits 60 s), `cr.seasick`, `cr.stomach-bug`, `cr.slipped`.

### 21. TX-A Special Delivery
- **Tier 5, Surgical Suite with helipad, inflow (organs), 6:00.** Follow camera. Strike limit 4.
- **New:** transplants: organ coolers, matching cooler color to wristband, freshness clocks, rotor downwash.
- **Patients:** `or.tx-kidney` (first), `or.tx-liver`, `or.tx-heart` (late), `or.rejection` in recovery.
- **Gimmick:** sky bridge between the helipad wing and the OR wing.

### 22. CL-H Overflow Day
- **Tier 5, Clinic, inflow at a high rate, 6:00.** Fixed camera.
- **New:** the ED diverts sicker patients to the clinic. Fewer tools; ambulance pickups only wait so long.
- **Patients:** clinic pool plus `ed.wheezing`, `ed.allergic-reaction`, `ed.seizure`, `ed.very-sleepy`, `cl.indigestion`, `cl.shot-reaction`.
- **Gimmick:** under construction.

### 23. IC-F Double Code
- **Tier 5, ICU, full floor, 6:00.** Follow camera (pods move).
- **New:** two codes at once with one crash cart.
- **Census:** `ic.collapsed-lung`, `ic.squeezed-heart`, `ic.racing-heart`, `ic.kidneys-stopped`, `ic.heart-pump`, `ic.on-vent`.
- **Events:** at 3:00 ±20 s two patients code within 10 s of each other.
- **Gimmick:** pod shuffle.

### 24. MC-D Stadium Collapse
- **Tier 5, Mass Casualty, surge in 3 waves, 6:00.** Follow camera.
- **New:** triage tags (all four colors), ambulance loading slots (load reds first).
- **Patients:** the full Mass Casualty pool.
- **Gimmicks:** stampede lane (crowd leaving the stadium), tent takeoff.

### 25. MC-F Field Hospital
- **Tier 5 finale, Mass Casualty, full floor + surge waves, 6:00.** Follow camera.
- **New:** everything at once. Tagged patients from earlier waves need treatment while new waves arrive.
- **Gimmicks:** earthquake islands with aftershocks, tent takeoff, stampede lane.

---

## 3. Chaos gimmicks

Tiers 1 and 2 stay readable. Gimmicks start at tier 3 and ramp up.

| Gimmick | What happens | Chaos (1 to 3) | Used in |
|---|---|---|---|
| Moving walkway | Hallway conveyor carries players and dropped items; fast one way, slow against it | 2 | ED-R |
| Spinning station | A desk or station on a turntable rotates every ~20 s | 2 | ED-R |
| Rolling beds | Unlocked beds drift down a sloped floor until someone locks them | 2 | WD-D |
| Swinging doors | Doors fly open when stretchers rush through and bonk anyone nearby | 1 | ED-E, OR-D, ED-R |
| Tube mixup | The pneumatic tube sometimes delivers samples to the wrong station | 2 | ED-R |
| Pod shuffle | ICU rooms are modular pods that slide to new spots mid-level | 3 | IC-F |
| Tent takeoff | Wind lifts part of the tent; stations land somewhere new | 3 | MC-D, MC-F |
| Deck tilt + pool slosh | The ship tilts on a rhythm; big tilts send pool water across the deck | 3 | CR-A (gentle), CR-G |
| Back doors swing open | Ambulance doors fly open on bumps; unsecured items slide onto the road | 2 | AM-B |
| Elevator lab | The lab lives inside the elevator and moves between floors | 2 | Reserve |
| Sky bridge | Two wings connected by a bridge that retracts and extends | 2 | TX-A |
| Fire drill | Sprinklers soak one wing; patients get wheeled to the other side | 3 | Reserve |
| Basement flood | Water rises on the lower floor; stations there go offline one by one | 3 | Reserve |
| Under construction | Missing floor sections; a crane swings supplies across the map | 3 | CL-H |
| Robot mop | A cleaning robot roams, leaving slippery trails and bumping carts | 1 | IC-A |
| Layout flip | At the halfway mark the map mirrors | 3 | Reserve |
| Revolving door | The main entrance spins, carrying players and wheelchairs around | 1 | CL-G |
| Earthquake islands | Cracks split the site into islands; plank bridges come and go | 3 | MC-F |
| Stampede lane | Runners, traffic, or crowds sweep across a lane, knocking items out of hands | 2 | MR-B, AM-B, MC-D, MC-F |
| Lights roulette | Lights go out room by room in sequence | 2 | IC-C |

"Reserve" gimmicks are for future or bonus levels.

## 4. Map rules

- 1 cell = 1 meter. Fixed-camera maps fit about 24 × 16 cells; follow-camera maps can run to about 40 × 30.
- Tier 1 and 2 maps are tidy and symmetric enough to learn. Chaos lives in tier 3+ gimmicks, not in the base layout.
- Beds are 1.1 × 2.4 m. Bed spots: **head** at the pillow corner, **chest** and **side** on the left long side, **arm** on the right long side. Keep 1 m clear on both long sides of any bed that can host a code.
- Every station must be reachable by two players passing each other (corridors at least 2 m).
- Scarce equipment (crash cart, EKG machine, ultrasound cart, C-arm, dialysis machine) starts in a fixed home spot with a floor marker.
- Player spawn points: four, near the center, in ring-color order.
- Maps are JSON files in `data/maps/` (format in `07-architecture.md`), built from greybox tiles first.
