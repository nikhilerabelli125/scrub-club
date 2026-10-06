# 03. Minigames and tasks

## 1. Rules for every minigame

1. **The game never pauses.** The minigame UI floats above the player's character (about 160 × 90 px, anchored to the head, never centered on screen) while everything else keeps running.
2. **One player per minigame.** Two players can work the same patient at once only on different bed spots (chest, head, arm, side) doing different tasks.
3. **Same difficulty everywhere.** A minigame plays the same in level 2 and level 25, for 1 or 4 players. There is no assist mode for now; revisit after playtests.
4. **Grades only change speed.** Perfect or good inputs finish quickly. Misses add retries, so the task takes longer. No points for accuracy.
5. **Four buttons only.** Every prompt uses buttons 1 to 4 (pick up, use, dash, ability) plus movement.
6. **Leaving cancels.** Walking away (pressing a movement direction for 0.3 s) exits the minigame. Hold tasks keep their progress; other minigames restart.
7. **Role speed perks** shorten tasks (fewer beats, shorter sequences, shorter waits). They never widen timing windows.
8. **Every task needs a trip.** Except asking questions, a task needs one physical step before the bedside part: an item from a station, equipment wheeled to the bed, or a walk with the patient (01 §7). The "Needs" notes below say which.

## 2. Mechanic types

Nine reusable types. Each is a sim-side state machine with parameters in `data/tasks.json`.

| Type | How it plays | Key parameters (draft) |
|---|---|---|
| `hold` | Hold Use until the bar fills. Releasing pauses; progress is kept | `seconds` |
| `tapWait` | Press Use once; the player is locked in place while a bar drains | `seconds` |
| `timingBar` | A marker sweeps across a bar; press Use in the green zone. Miss = 0.6 s retry | `hits`, `zoneWidth` (0 to 1), `sweepSeconds`, `overshoot` (dosing), `syncToMonitor`, `holdToFill` (hold to tighten, release in the zone) |
| `qte` | A sequence of button prompts. Wrong or late = restart after 1 s | `length`, `promptSeconds` |
| `rhythm` | Notes scroll to a hitline at a fixed tempo; hit the shown button on the beat | `bpm`, `beats`, `buttons`, perfect ±50 ms, good ±110 ms, each miss adds 2 beats |
| `steer` | An auto-scrolling path; steer left and right to stay on the line. Off the line = slower | `lengthSeconds`, `pathWidth`, `wiggle` |
| `sweep` | Move a small cursor over a field to find a hidden target, then hold still | `targetSize`, `holdSeconds` |
| `alternate` | Alternate buttons 1 and 2 quickly to fill a bar | `presses` |
| `choice` | Pick one of 2 to 4 options, each mapped to a button | `options`, `onWrong` (`retry` or `wrongAction`) |

**Dosing** is a `timingBar` with `overshoot: true`. Stopping past the zone gives an overdose (patient sleepy with slow breathing, needs a reversal shot). Stopping short gives a partial dose; redo it. The pharmacist's doses clamp to the safe maximum.

### Non-minigame interactions

| Interaction | How it works |
|---|---|
| `carry` | Pick up an item or patient chart and bring it somewhere |
| `escort` | Use beside the patient and they follow a step behind (leading a wandering patient back, walking a post-op patient). Reaching the task's station finishes it, and their bed frees up |
| `push` | Push a bed, wheelchair, or equipment cart. Pick up grabs it and parks it again; Use parks it too. Equipment rolls in front at 85% speed |
| `twoPersonCarry` | Two players each grab a handle (both press Pick up within 1 s), then move together at 70% speed. Either one letting go drops it. Used for stretchers in Ambulance, Mass Casualty, and sometimes the ED |

## 3. Signature minigames

**CPR (`rhythm`).** 110 bpm hitline at the chest spot. Notes use buttons 1 and 2 in simple patterns. 30 beats per cycle, then a "check pulse" prompt. While any code is active, the level music locks to 110 bpm so the beat matches. In solo, a swapped-away character keeps doing CPR at normal grade.

**Shock (`timingBar`).** Hold Use 1 s to charge (a "clear!" callout plays), then press in the green zone (`zoneWidth` 0.15, `sweepSeconds` 1.1). Miss and the bar sweeps again. The defibrillator needs recharging after use.

**Intubation (`qte`).** 3 prompts from the four buttons, 1.2 s each, at the head spot.

**IV / blood draw (`tapWait`).** One press, 3 s drain.

**Surgery open (`steer`).** 4 s auto-scrolling cut line.

**Stitches (`timingBar`).** A needle swings across the cut; press at each mark, 5 hits.

**Splint / cast (`alternate`).** 16 alternating presses to wrap.

**Ultrasound (`sweep`).** Find the target (fluid pocket, appendix, vein) and hold still 1 s. Needs the ultrasound cart.

**Calm down (`choice`).** Three speech bubbles; one is calming, two make it worse (funny writing lives here). Wrong pick = patience drops a bit, then retry.

**Triage tag (`choice`).** Four options mapped to four buttons: red, yellow, green, grey ("beyond help").

## 4. Task library

Task IDs match `data/tasks.json`. "Spot" is the bed spot used (any = no specific spot).

### Assessment and tests

| Task | Label | Mechanic | Spot / station | Notes |
|---|---|---|---|---|
| `task.ask-questions` | Ask questions | hold 3 s | any | Reveals tasks in `assess` mode |
| `task.check-vitals` | Check vitals | hold 2.5 s | arm | Needs a vitals cart at the bed (two in the ED). Nurse 50% faster |
| `task.quick-check` | Quick check | hold 1.5 s | any | Marathon base task |
| `task.scene-check` | Scene check | hold 1.5 s | any | Ambulance and Mass Casualty base task |
| `task.listen-lungs` | Listen to lungs | hold 2 s | chest | |
| `task.blood-draw` | Blood test | tapWait 3 s | arm | Makes a tube; carry to the lab tube; result after 18 s |
| `task.throat-swab` | Throat swab | tapWait 2 s | head | Result after 12 s |
| `task.sugar-check` | Sugar check | tapWait 1.5 s | arm | Instant result |
| `task.salt-check` | Salt check | tapWait 2 s | arm | Result after 8 s (marathon machine) |
| `task.ekg` | EKG | hold 3 s | chest | Needs the EKG machine at the bed (one per map) |
| `task.xray` | X-ray | hold 1.5 s | computer | Order, then result after 10 s |
| `task.brain-scan` | Brain scan | hold 1.5 s | computer | Order, then result after 15 s |
| `task.ultrasound` | Ultrasound | sweep | chest | Needs the ultrasound cart |
| `task.stroke-check` | Stroke check | qte (3) | head | Face, arm, speech prompts |
| `task.neuro-check` | Brain check | qte (2) | head | ICU |
| `task.pre-op-check` | Pre-op check | hold 2 s | any | Surgical base task |
| `task.time-out` | Time-out | choice (3) | any | Match wristband, marked site, chart. Wrong = wrong action |
| `task.triage-tag` | Tag | choice (4) | any | Mass Casualty |

### Treatments

| Task | Label | Mechanic | Spot / station | Notes |
|---|---|---|---|---|
| `task.oxygen` | Oxygen | hold 1.5 s | head | Needs an oxygen mask from the supply closet. Slows low-oxygen escalation |
| `task.breathing-treatment` | Breathing treatment | tapWait 4 s | head | Needs a nebulizer kit from the supply closet |
| `task.iv` | IV | tapWait 3 s | arm | |
| `task.iv-fluids` | IV fluids | tapWait 1.5 s | arm | Bag from supply |
| `task.transfusion` | Blood transfusion | choice (bag color) + tapWait 2 s | arm | Bag from blood fridge must match the wristband color |
| `task.aspirin` | Aspirin | tapWait 1 s | arm | From med cabinet |
| `task.pain-med` | Pain med | timingBar dosing | arm | Too much = overdose |
| `task.antibiotics` | Antibiotics | tapWait 1.5 s | arm | |
| `task.allergy-shot` | Allergy shot | tapWait 1 s | arm | Given before questions |
| `task.seizure-med` | Seizure med | timingBar dosing | arm | |
| `task.reversal-shot` | Reversal shot | tapWait 1 s | arm | Fixes overdoses |
| `task.adrenaline` | Adrenaline | tapWait 1 s | arm | From crash cart (codes) |
| `task.clot-buster` | Clot-buster | timingBar dosing | arm | After brain scan |
| `task.insulin` | Insulin | timingBar dosing | arm | Too much = low sugar |
| `task.water-pill` | Water pill | tapWait 1 s | arm | |
| `task.withdrawal-med` | Withdrawal med | timingBar dosing | arm | |
| `task.calcium-shot` | Calcium shot | tapWait 1 s | arm | High potassium |
| `task.blood-thinner` | Clot shot | tapWait 1 s | arm | Scheduled |
| `task.salty-iv` | Salty IV | timingBar dosing | arm | Low-salt runners |
| `task.pressure-med` | Pressure med pump | timingBar dosing | arm | Keep the pump full |
| `task.bp-med` | Blood pressure med | timingBar dosing | arm | Brain bleed (ICU) |
| `task.anti-rejection` | Anti-rejection med | tapWait 1 s | arm | Transplant |
| `task.albumin` | Albumin bag | tapWait 1.5 s | arm | After belly drain |
| `task.seasick-pill` | Seasick pill | tapWait 1 s | any | |
| `task.give-drink` | Drink | tapWait 1 s | any | Item sets the drink: water, sports drink, juice, warm drink, ginger ale |
| `task.splint` | Splint | alternate (16) | any | |
| `task.cast` | Cast | alternate (20) | any | |
| `task.clean-wound` | Clean | hold 2 s | any | Needs a wound kit from the supply closet |
| `task.stitches` | Stitches | timingBar (5 hits) | any | Needs a stitch kit from the supply closet |
| `task.bandage` | Bandage | tapWait 1.5 s | any | |
| `task.ice-pack` | Ice | tapWait 1 s | any | |
| `task.wrap` | Wrap | alternate (12) | any | |
| `task.stretch` | Stretch | hold 2 s | any | |
| `task.petroleum-jelly` | Petroleum jelly | tapWait 1 s | any | |
| `task.blanket` | Warm blanket / foil blanket | tapWait 1 s | any | |
| `task.ice-bath` | Ice bath | push patient to tub, then hold until the cool meter is green | ice bath | Tub needs ice |
| `task.tourniquet` | Tourniquet | timingBar (hold to tighten, release in zone) | arm | |
| `task.neck-collar` | Neck collar | tapWait 1.5 s | head | |
| `task.heimlich` | Heimlich | timingBar (3 hits) | any | |
| `task.chest-relief-needle` | Chest relief needle | timingBar | chest | |
| `task.burn-care` | Cool + dressing | hold 3 s | any | |
| `task.aloe` | Aloe | tapWait 1 s | any | |
| `task.rinse` | Rinse | hold 1.5 s | any | |
| `task.isolate` | Isolate | escort to isolation cabin | | Stops contagion |
| `task.sit-up` | Sit up | hold 1.5 s | head | |
| `task.legs-up` | Lie down, legs up | hold 1.5 s | any | Same hold as sit up, different animation (lightheaded runners) |
| `task.two-person-lift` | Lift | two-person carry | | Fell out of bed, trapped under debris |
| `task.weigh-in` | Weigh-in | hold 1.5 s | any | Scale item |
| `task.walk-patient` | Walk | escort to hallway marker and back | | |
| `task.lead-back` | Lead back | escort to bed | | Wandering patients |
| `task.calm-down` | Calm down | choice (3) | head | |
| `task.bedpan` | Bedpan | carry bedpan in, then empty at dirty utility (hold 2 s) | | |
| `task.dressing-change` | Dressing change | hold 3 s | any | |
| `task.radio-alert` | Radio ahead | hold 1 s | radio | Bonus for time-critical patients |
| `task.bandage-kit` | Hand a bandage kit | carry | | Walking wounded patch themselves |

### Trips still to choose (pending medical review)

The ED-A tasks above have their trips (playtest #8). These tasks in the other built levels (CL-A, ED-E) have none yet. Proposed:

| Task | Proposed trip |
|---|---|
| `task.listen-lungs` | None: an assessment at the bedside, like asking questions (the stethoscope is around your neck) |
| `task.iv` | IV kit from the supply closet |
| `task.intubate` | Airway kit from the crash cart, like adrenaline |

### Codes

| Task | Label | Mechanic | Spot |
|---|---|---|---|
| `task.cpr` | CPR | rhythm 110 bpm, 30 beats | chest |
| `task.shock` | Shock | hold 1 s charge + timingBar | side |
| `task.intubate` | Intubate | qte (3) | head |
| `task.bag` | Bagging | rhythm 12 bpm (press each slow pulse) | head |

### ICU procedures

| Task | Label | Mechanic chain | Equipment |
|---|---|---|---|
| `task.central-line` | Big IV in the neck | sweep (find vein) → steer (needle) | Ultrasound cart |
| `task.lung-drain` | Lung drain | sweep → timingBar → hold while jar fills → carry jar to lab | Ultrasound cart |
| `task.belly-drain` | Belly drain | sweep → timingBar → swap full jugs (chore) | Ultrasound cart |
| `task.chest-tube` | Chest tube | steer (small cut) → qte (insert) → hook to drain box | |
| `task.heart-drain` | Heart drain | sweep → timingBar (zoneWidth 0.08) | Ultrasound cart |
| `task.cardioversion` | Rhythm reset | timingBar synced to the monitor beat | Defibrillator |
| `task.dialysis-hookup` | Dialysis | push machine to bed → qte (3) | Dialysis machine (one) |
| `task.suction` | Suction | hold 2 s | |
| `task.pump-check` | Pump check | hold 1.5 s | |
| `task.pump-reposition` | Reposition pump | timingBar | |
| `task.drain-check` | Drain check | hold 1 s | |

### Surgery

Every surgery: `task.pre-op-check` → `task.time-out` → `task.intubate` → `task.scrub-in` → `task.open` → main steps → `task.sponge-check` → `task.close` → recovery.

| Task | Label | Mechanic |
|---|---|---|
| `task.scrub-in` | Scrub in | hold 3 s at scrub sink. Leaving the OR removes it |
| `task.open` | Open | steer 4 s |
| `task.find` | Find it | sweep |
| `task.clip` | Clip | timingBar |
| `task.lift-out` | Lift out | carry to specimen jar |
| `task.push-back` | Push back | hold 2 s |
| `task.place-mesh` | Place mesh | choice (size) + carry |
| `task.keyhole-ports` | Keyhole cuts | timingBar (3 hits) |
| `task.camera-steer` | Camera | steer |
| `task.clip-cut` | Clip, clip, cut | qte (3) |
| `task.wipe-camera` | Wipe camera | hold 1 s |
| `task.drill` | Drill | rhythm 90 bpm, 12 beats |
| `task.screws` | Screws | timingBar (3 hits) |
| `task.c-arm-check` | X-ray check | hold 1.5 s with the C-arm (one) |
| `task.mark-site` | Mark the limb | choice (left / right) |
| `task.saw` | Saw | alternate (20), under the drape |
| `task.clamp` | Clamp | timingBar |
| `task.disconnect` | Disconnect | qte (3) |
| `task.connect` | Connect | qte (3) |
| `task.bypass-connect` | Connect bypass machine | qte (4) |
| `task.sew-vessel` | Sew vessel | timingBar (5 hits) |
| `task.bypass-watch` | Watch bypass machine | steer (keep the needle in the zone) |
| `task.sponge-check` | Sponge check | sweep the field for leftover sponges. Closing with one inside = wrong action |
| `task.close` | Close | timingBar (5 hits) |

### Chores and disposition

| Task | Label | Mechanic |
|---|---|---|
| `task.bed-turnover` | Clean bed | hold 3 s |
| `task.restock` | Restock | carry supplies from closet, hold 1 s at station |
| `task.recharge-defib` | Recharge | hold 2 s at outlet |
| `task.clean-spill` | Mop | hold 2 s |
| `task.empty-bedpan` | Empty bedpan | hold 2 s at dirty utility |
| `task.sterilize-tray` | Sterilize tray | hold 2 s, then 10 s wait |
| `task.refill-ice` | Refill ice | carry ice from truck or cooler |
| `task.swap-jug` | Swap jug | tapWait 1 s |
| `task.refuel-light` | Refuel floodlight | hold 2 s |
| `task.restart-generator` | Restart generator | qte (3) |
| `task.sign-out` | Sign out | hold 1.5 s at computer |
| `task.transport` | Transport | push bed or wheelchair to the right exit |

### Setting-specific extras

| Task | Label | Mechanic | Notes |
|---|---|---|---|
| `task.vaccine` | Shot | tapWait 1 s | Vaccine from the fridge |
| `task.observe` | Watch | seat patient in an observation chair; 20 s wait | Clinic shots, allergic reactions |
| `task.prescription` | Prescription | hold 1.5 s at computer | |
| `task.headache-med` | Headache med | tapWait 1 s | Not dosed. From the med cabinet |
| `task.dark-room` | Dark room | escort to dark room | Migraine |
| `task.sugar-iv` | Sugar IV | tapWait 1.5 s | Needs an IV first |
| `task.inhaler` | Inhaler | tapWait 1 s | |
| `task.fetch` | Fetch | push a wheelchair to a patient elsewhere on the map and bring them back | Cruise decks |
