# 04. Settings and patients

Nine settings. Each lists its feel, default camera, base tasks, stations, chores, hazards, and every patient type. Condition IDs match `data/conditions/*.json`.

**How to read the patient tables**

- **Label** is the in-game text; the real condition is in parentheses for the team only.
- **Acuity** 1 (critical) to 5 (minor). Hidden conditions show "looks 4, really 2."
- **Tasks** are in addition to the setting's base tasks. "→" means in order; "+" means can be done in parallel.
- **Slowed by** lists tasks that pause or slow escalation (partial treatment).
- **If ignored** is the escalation path. "Leaves" means 1 strike; codes and rescue transfers follow `01-game-design.md`.
- **Exit** is the disposition. "(planned)" transfers are successes.

This file is the single source of truth for medical content. The team's medical reviewer approves any change.

---

## 1. Outpatient Clinic (`cl`)

Starts calm and low stakes, teaching every basic action. Later clinic levels get extremely busy.

- **Camera:** fixed
- **Base tasks:** ask questions + check vitals
- **Stations:** check-in desk, exam rooms, computer, supply cabinet, med cabinet, lab window, vaccine fridge, juice fridge, observation chairs, EKG machine (one), vitals cart, sink, phone
- **Chores:** exam room turnover, restocking, answering the phone (missed calls make walk-ins grumpier)
- **Hazards:** wet floor zones, printer jams, crowded lobby; tier 3+ gimmicks: revolving door, robot mop, under construction, fire drill

| ID | Label | Acuity | Tasks | Slowed by | If ignored | Exit |
|---|---|---|---|---|---|---|
| `cl.sore-throat` | Sore throat (strep throat) | 5 | throat swab → antibiotics | | Leaves | Home |
| `cl.needs-shot` | Needs a shot (vaccine) | 5 | vitals only, then vaccine → observe | | Leaves | Home |
| `cl.cough` | Cough (bronchitis) | 5 | listen to lungs → prescription | | Leaves | Home |
| `cl.twisted-ankle` | Twisted ankle (sprain) | 4 | X-ray → splint | | Leaves | Home |
| `cl.cut-finger` | Cut finger (laceration) | 4 | clean → stitches | | Leaves | Home |
| `cl.bp-check` | Blood pressure check (follow-up) | 5 | blood test → prescription | | Leaves | Home |
| `cl.dizzy-sugar` | Dizzy (hidden: low sugar) | looks 4, really 3 | sugar check → give drink (juice) | juice | Passes out: needs IV + sugar IV | Home |
| `cl.indigestion` | Indigestion (hidden: heart attack) | looks 4, really 2 | EKG → aspirin | aspirin | Sweating, then zigzag code | Ambulance (planned) |
| `cl.shot-reaction` | Shot reaction (allergic reaction, event) | 2 | allergy shot → observe | allergy shot | Turns blue: intubate, rescue transfer | Home |

---

## 2. Emergency Department (`ed`)

The signature setting: ticket rail, waiting room, ambulances, first codes.

- **Camera:** fixed (follow on large ED maps like ED-R)
- **Base tasks:** ask questions + check vitals
- **Stations:** triage desk, waiting room, curtained bays, resus bay, computer, med cabinet, lab tube, blood fridge, X-ray/scan room, crash cart with the defibrillator (one), EKG machine (one), ultrasound cart (one), vitals carts (two), supply closet, observation chairs, dark room, sink
- **Chores:** bed turnover, recharging the defibrillator, restocking the crash cart, cleaning spills
- **Hazards:** ambulance stretcher lane, hallway beds, power dips; tier 3+ gimmicks: swinging doors, moving walkway, spinning station, tube mixup, lights roulette, basement flood

| ID | Label | Acuity | Tasks | Slowed by | If ignored | Exit |
|---|---|---|---|---|---|---|
| `ed.chest-pain` | Chest pain (heart attack) | 2 | EKG → aspirin | aspirin | Sweating, then zigzag code | Heart lab (planned) |
| `ed.broken-arm` | Broken arm (fracture) | 4 | X-ray → pain med → cast | | Leaves | Home |
| `ed.bad-cut` | Bad cut (laceration) | 4 | clean → stitches | | Leaves | Home |
| `ed.wheezing` | Wheezing (asthma attack) | 3 | oxygen + breathing treatment | oxygen | Turns blue: intubate, rescue transfer | Home |
| `ed.allergic-reaction` | Allergic reaction (anaphylaxis) | 2 | allergy shot first (before questions) → IV fluids → observe | allergy shot | Turns blue: intubate, rescue transfer | Home |
| `ed.face-drooping` | Face drooping (stroke) | 2 | brain scan → clot-buster | | Gets worse: rescue transfer | ICU (planned) |
| `ed.belly-pain` | Belly pain (appendicitis) | 3 | blood test + ultrasound + pain med | | Bursts: fever, pale, rescue transfer | OR (planned) |
| `ed.fever-confused` | Fever + confused (sepsis) | 2 | blood test → IV fluids + antibiotics | IV fluids | Pale: rescue transfer | Wards (planned) |
| `ed.headache` | Headache (migraine) | 4 | headache med → dark room | | Annoyed, leaves. Never escalates | Home |
| `ed.dizzy-bleeding` | Dizzy (hidden: internal bleeding) | looks 4, really 2 | blood test → IV → transfusion | transfusion | Pale, then flat-line code | ICU (planned) |
| `ed.seizure` | Seizure (prolonged seizure) | 2 | seizure med first (before questions) → brain scan | seizure med | Turns blue: intubate, rescue transfer | Wards (planned) |
| `ed.very-sleepy` | Very sleepy (opioid overdose) | 2 | reversal shot first (before questions) → oxygen → observe | oxygen, bagging | Turns blue, then flat-line code | Home |
| `ed.car-crash` | Car crash (multiple injuries, boss) | 1 | intubate + IV + IV + transfusion + X-ray + ultrasound | transfusion | Flat-line code | OR (planned) |
| `ed.collapsed` | Collapsed at home (cardiac arrest, arrives by ambulance) | 1 | code (zigzag) → intubate | | Death if the code is lost | ICU (planned) |

---

## 3. Wards (`wd`)

Full-floor management. Everyone is already admitted. Every problem is visible on the patient or in the room, and every fix is a physical action.

- **Camera:** fixed (follow on two-floor maps)
- **Base tasks:** ask questions + check vitals (for new admissions only)
- **Stations:** patient rooms with call lights, nurses' station computer, med room, supply room, dirty utility room, blood bank fridge (sometimes on another floor), scale, elevator, lobby exit
- **Chores:** scheduled med pass, emptying bedpans, linen changes, bed turnover, meal trays
- **Hazards:** meal cart loop, visitors in doorways, dim night hallways; tier 3+ gimmicks: rolling beds, elevator lab, sky bridge, fire drill, robot mop

| ID | Label | Acuity | What you see | Tasks | If ignored | Exit |
|---|---|---|---|---|---|---|
| `wd.pulled-iv` | Pulled out IV | 4 | IV pole tipped over, tape flapping, patient grinning | calm down → IV → stand the pole up | Misses meds, gets worse | Discharge |
| `wd.bedpan` | Needs the bedpan | 5 | Call light, wiggling, "!!" bubble | bedpan (carry in, empty at dirty utility) | Accident: full linen change | Recurs |
| `wd.fell` | Fell out of bed | 3 | On the floor, cartoon stars circling | two-person lift back to bed → X-ray | Broken hip: rescue transfer to OR | Discharge |
| `wd.post-op-pain` | Pain 10/10 (after surgery) | 4 | Clutching belly, red pain meter | pain med (dosing; too much = reversal shot) | Cranky, refuses to walk | Discharge |
| `wd.low-sugar` | Shaky before breakfast (low sugar) | 3 | Sweaty, trembling, confused | sugar check → juice | Passes out: IV + sugar IV | Discharge |
| `wd.cant-breathe-lying` | Can't breathe lying down (heart failure) | 3 | Gasping flat in bed, puffy legs | sit up + oxygen → water pill; daily weigh-in | Turns blue: rescue transfer | Discharge |
| `wd.withdrawal` | Seeing bugs (alcohol withdrawal) | 3 | Shaking, sweating, swatting at the air | withdrawal med (dosing) + calm down | Seizure: seizure med, rescue transfer | Discharge |
| `wd.wanderer` | Wandering grandpa (delirium) | 4 | Walking the hallway in a gown, dragging his IV pole | lead back → calm down (reorient) → lights on | Falls, or rides the elevator away | Discharge |
| `wd.wound-infection` | Red, hot wound (wound infection) | 3 | Incision glowing red | dressing change + blood test → antibiotics | Fever, then sepsis: rescue transfer | Discharge |
| `wd.low-blood-count` | Low blood count (needs transfusion) | 3 | Pale tint, yawning | transfusion (bag color must match wristband) | Wrong bag: hives, stop + allergy shot | Discharge |
| `wd.wants-to-leave` | Wants to leave | 5 | Packing a bag, steam from ears | calm down → fix their complaint | Leaves AMA (1 strike) | Discharge |
| `wd.missed-clot-shot` | Missed clot shot (hidden: clot to lung) | looks 4, really 2 | Fine, until a sudden blue tint and chest grab | clot shot on schedule. If it hits: oxygen, then rescue transfer | Flat-line code | ICU (rescue) |
| `wd.discharge-day` | Discharge day | 5 | Dressed, suitcase, foot tapping | sign out → wheelchair to lobby where the family car waits | Family car leaves: annoyed | Home |

---

## 4. Intensive Care Unit (`ic`)

High stakes, full floor, constant alarms. Every patient is sick; most of the work is maintenance, procedures, and catching problems early. ICU patients "stay": they score through tasks done and being stable at shift end.

- **Camera:** fixed (follow on pod-shuffle maps)
- **Base tasks:** none
- **Stations:** glass-door rooms, breathing machines, IV pumps, monitor bank (alarms), med room, blood fridge, crash cart, ultrasound cart (one), dialysis machine (one), portable X-ray, generator
- **Chores:** refilling IV pumps, suctioning, swapping oxygen tanks, drain jugs, restocking
- **Hazards:** power outages (breathing machines stop: bag by hand until the generator restarts), alarm noise, sliding glass doors; tier 3+ gimmicks: pod shuffle, elevator lab, lights roulette, basement flood, robot mop
- **False alarms:** some alarms are trivial (a sticker fell off, a cough set off the breathing machine). Players learn to tell them apart from real ones.

| ID | Label | Acuity | What you see | Tasks | Slowed by | If ignored |
|---|---|---|---|---|---|---|
| `ic.on-vent` | On breathing machine (pneumonia) | 1 | Breathing tube | suction every 40 s | suction | Tube clogs: blue, re-intubate, then flat-line code |
| `ic.septic-shock` | Low blood pressure (septic shock) | 1 | Pale, pressure meter dropping | central line → pressure med pump (keep full) + antibiotics | pressure med | Flat-line code |
| `ic.post-heart-surgery` | After heart surgery | 2 | Chest bandage, drain box | drain check every 45 s; transfusion if bleeding | | Racing heart: rhythm reset; bleeding: transfusion |
| `ic.kidneys-stopped` | Kidneys stopped (kidney failure) | 2 | Puffy, tall waves on monitor | dialysis hookup + blood test | calcium shot | Weird rhythm: calcium shot, then zigzag code |
| `ic.heart-pump` | Heart pump (pump support for a failing heart) | 1 | Pump console by the bed | pump check every 50 s; reposition on alarm; blood test | | Pump alarm: pressure drops, then code |
| `ic.dka` | Sugar crisis (DKA) | 2 | Breathing fast, tired | insulin (dosing) + IV fluids + sugar check every 30 s | IV fluids | Too much insulin: low sugar, juice or sugar IV |
| `ic.med-overdose` | Too much med (medication-error overdose) | 2 | Very sleepy, slow breathing | reversal shot | bagging | Blue, then flat-line code |
| `ic.brain-bleed` | Brain bleed | 1 | Bandaged head | blood pressure med (dosing) + brain check every 45 s | | Gets worse (2 strikes) |
| `ic.tiring-out` | Tiring out (breathing failure) | 1 | Blue tint that oxygen doesn't fix, slumping | intubate → breathing machine | oxygen (briefly) | Flat-line code |
| `ic.water-on-lung` | Water on the lung (pleural effusion) | 2 | Short of breath; X-ray shows one side filled with "water" | lung drain | oxygen | Turns blue |
| `ic.swollen-belly` | Swollen belly (liver failure, belly fluid) | 3 | Round sloshing belly, yellow tint | belly drain → albumin | | Confused, then fever |
| `ic.collapsed-lung` | Collapsed lung (pneumothorax) | 1 | Sudden blue, one side of the chest not moving | chest relief needle if crashing → chest tube | chest relief needle | Flat-line code |
| `ic.squeezed-heart` | Squeezed heart (cardiac tamponade) | 1 | Pressure crashing, heart barely moving on ultrasound | ultrasound → heart drain | IV fluids | Flat-line code |
| `ic.racing-heart` | Racing heart (atrial fibrillation, fast rate) | 2 | Racing wobbly line, pale | rhythm reset | | Pressure crashes, then flat-line code |

---

## 5. Surgical Suite (`or`)

General ORs plus the transplant unit and rooftop helipad, as one setting. General surgery levels come first and teach every mechanic transplants use.

- **Camera:** fixed (follow when the helipad is part of the map)
- **Base tasks:** pre-op check + time-out
- **Every surgery:** pre-op check → time-out → intubate → scrub in → open → main steps → sponge check → close → wheel to recovery
- **Rules:** a wrong time-out (wrong site, wrong patient) is a harmful wrong action. Leaving the OR un-scrubs you. Closing with a sponge inside is a harmful wrong action. All surgery happens under drapes; amputations are a drape and a cartoon "poof."
- **Stations:** pre-op bay, scrub sink, OR tables, anesthesia cart, instrument tray + sterilizer, specimen jar, blood fridge, C-arm (one), bypass machine, recovery beds; transplant: helipad, elevator, organ cooler station
- **Chores:** sterilizing instrument trays, OR turnover, refilling cooler ice
- **Hazards:** swinging OR doors, rotor downwash on the helipad (pushes players and items), elevator timing; tier 3+ gimmicks: sky bridge, swinging doors, lights roulette

| ID | Surgery | Acuity | Main steps | Twist | Tier |
|---|---|---|---|---|---|
| `or.appendix` | Appendix out | 3 | find → clip → lift out | Burst appendix adds suction first | 2 |
| `or.hernia` | Hernia repair | 4 | push back → place mesh | Mesh comes in 3 sizes; pick the right one | 2 |
| `or.gallbladder` | Gallbladder out (keyhole) | 3 | keyhole cuts → camera → clip, clip, cut | Camera fogs: wipe it | 3 |
| `or.hip-fix` | Broken hip fix | 3 | drill → screws → X-ray check with the C-arm | One C-arm, on wheels | 3 |
| `or.amputation` | Amputation (badly infected foot) | 2 | mark the limb → saw → close | Wrong-side mark = harmful wrong action | 4 |
| `or.spleen` | Spleen out (trauma bleeding) | 1 | suction + clamp → lift out | Head player keeps giving blood as pressure drops | 4 |
| `or.bowel` | Bowel repair | 2 | disconnect → lift out → connect | Same mechanics as transplant | 4 |
| `or.bypass` | Heart bypass (boss) | 1 | connect bypass machine → sew vessel ×3 → restart heart (shock); watch the bypass machine throughout | Bypass machine alarms mid-surgery | 5 |

**Transplants.** Organs arrive by helicopter in coolers; donors are never shown. The cooler's color must match the recipient's wristband color (wrong match = harmful wrong action). Each organ has a freshness clock (draft: heart 120 s, lungs 140 s, liver 200 s, kidney 300 s) that runs faster if the cooler's ice runs out.

Transplant flow: pre-op → time-out → intubate → scrub in → open → disconnect the old organ → lift out → connect the new organ → sponge check → close → recovery.

| ID | Label | Acuity | Notes |
|---|---|---|---|
| `or.tx-heart` | Needs a heart (on a heart pump) | 1 | Fastest clock |
| `or.tx-lungs` | Needs lungs | 1 | Fast clock |
| `or.tx-liver` | Needs a liver | 2 | Medium clock; may need blood |
| `or.tx-kidney` | Needs a kidney (on dialysis) | 3 | Slowest clock |
| `or.flight-patient` | Flight patient (critical transfer by helicopter) | 1 to 2 | Unload fast; stabilize; ICU or OR (planned) |
| `or.rejection` | Rejection warning (after transplant) | 2 | anti-rejection med + blood test; if ignored, gets worse |

---

## 6. Marathon Medical Tent (`mr`)

Outdoor and sunny. Lots of quick wins (runners go back to the race for a bonus) building to a finish-line surge.

- **Camera:** fixed (follow on long course maps)
- **Base tasks:** quick check
- **Stations:** cots, ice baths, water and sports drink table, first aid table, salt-check machine, AED (one), golf cart to the ambulance
- **Chores:** refilling ice from the truck, restocking cups, clearing cup litter
- **Hazards:** runner packs crossing the entrance, wind gusts, mud in the rain; tier 3+ gimmicks: stampede lane, tent takeoff
- **Exit "back to race"** gives +10 bonus points

| ID | Label | Acuity | Tasks | Slowed by | If ignored | Exit |
|---|---|---|---|---|---|---|
| `mr.blisters` | Blisters | 5 | clean → bandage | | Leaves | Back to race |
| `mr.cramps` | Leg cramps | 5 | stretch → give drink (sports drink) | | Leaves | Back to race |
| `mr.chafing` | Chafing | 5 | petroleum jelly | | Leaves | Back to race |
| `mr.lightheaded` | Lightheaded (post-race collapse) | 4 | lie down (legs up) → give drink | | Needs IV fluids | Home |
| `mr.ankle` | Twisted ankle (sprain) | 4 | ice → wrap | | Leaves | Home |
| `mr.overheated` | Overheated (heat stroke) | 2 | ice bath until cool. Cooling only, never fever medicine | ice bath | Seizure, then zigzag code | Home / ambulance |
| `mr.low-salt` | Confused, drank lots (hidden: low salt) | looks 4, really 2 | salt check → salty IV (dosing). Giving water is a harmful wrong action | | Seizure | Ambulance (planned) |
| `mr.wheezing` | Wheezing (exercise asthma) | 4 | inhaler | | Turns blue: oxygen | Home |
| `mr.collapsed` | Collapsed at the finish (cardiac arrest) | 1 | code (zigzag) with the AED | | Death if the code is lost | Ambulance (planned) |
| `mr.shivering` | Shivering (cold-race hypothermia) | 3 | blanket → give drink (warm drink) | blanket | Confused, slow | Home |

"Lie down (legs up)" uses `task.sit-up`'s hold mechanic with a different animation (`task.legs-up` in data).

---

## 7. Ambulance (`am`)

Two spaces: the scene (roadside, house, highway) and the back of the rig. Load, treat on the move, deliver to the hospital door.

- **Camera:** follow
- **Base tasks:** scene check
- **Stations:** jump bag, stretcher, neck collar + backboard, oxygen tank, monitor/AED, med box, tourniquets, splints, radio
- **Chores:** restocking the rig between calls, cleaning the stretcher, swapping oxygen tanks
- **Hazards:** the rig swerves (unsecured items slide), potholes, highway traffic lanes, narrow stairwells; tier 3+ gimmicks: back doors swing open, stampede lane (traffic)
- **Two-person carries** for stretchers and backboards
- **Radio alert** before arriving with a time-critical patient (heart attack, stroke) gives +15 bonus points

| ID | Label | Acuity | Tasks | If ignored | Exit |
|---|---|---|---|---|---|
| `am.ladder-fall` | Fell off a ladder (possible spine injury) | 3 | neck collar → backboard (two-person carry) | Pain gets worse | ED |
| `am.bleeding-leg` | Bleeding leg (major bleed) | 1 | tourniquet → IV | Pale, then flat-line code | Trauma bay |
| `am.chest-pain` | Chest pain (heart attack) | 2 | EKG → aspirin → radio alert | Zigzag code | Heart lab |
| `am.low-sugar` | Passed out (low sugar) | 3 | sugar check → IV → sugar IV | Seizure | Home or ED |
| `am.bee-sting` | Bee sting swelling (anaphylaxis) | 2 | allergy shot → oxygen | Turns blue | ED |
| `am.stroke` | Face drooping (stroke) | 2 | stroke check → radio alert | Gets worse | Stroke center |
| `am.collapsed` | Collapsed at home (cardiac arrest) | 1 | code (zigzag) → intubate | Death if the code is lost | ED |
| `am.hip` | Hip hurts after a fall (hip fracture) | 4 | pain med → splint → careful lift (two-person carry) | Cranky | ED |
| `am.unresponsive` | Found unresponsive (opioid overdose) | 2 | reversal shot → bagging | Flat-line code | ED |

---

## 8. Cruise Ship Clinic (`cr`)

A tiny clinic on a big ship. Patients appear all over the decks, so players fetch them with wheelchairs while the ship rocks.

- **Camera:** follow
- **Base tasks:** ask questions + check vitals
- **Stations:** ship clinic (2 to 3 beds), pharmacy, wheelchairs, stairs/elevator between decks, isolation cabin, deck helipad, handwashing stations
- **Chores:** cleaning seasick puddles, handwashing, restocking
- **Hazards:** rhythmic rocking (items slide side to side), storms, slippery pool deck, buffet crowds; tier 3+ gimmicks: deck tilt + pool slosh, moving walkway, stampede lane
- **Contagion:** stomach-bug patients who aren't isolated spread it to nearby passengers

| ID | Label | Acuity | Tasks | If ignored | Exit |
|---|---|---|---|---|---|
| `cr.seasick` | Seasick | 5 | seasick pill → give drink (ginger ale) | Puddle cleanup chore | Cabin |
| `cr.stomach-bug` | Stomach bug (norovirus) | 4 | isolate → give drink | Spreads to other passengers | Cabin |
| `cr.sunburn` | Sunburn | 5 | aloe | Annoyed | Back to deck |
| `cr.slipped` | Slipped on the pool deck (fracture) | 4 | fetch → X-ray → splint | Leaves | Cabin |
| `cr.choking` | Choking at the buffet | 1 | Heimlich on the spot | Turns blue, then flat-line code | Back to the buffet |
| `cr.shellfish` | Shellfish allergy (anaphylaxis) | 2 | allergy shot → observe | Turns blue | Cabin |
| `cr.chest-pain` | Chest pain (older passenger, heart attack) | 2 | EKG → aspirin | Zigzag code | Helicopter evac (planned) |
| `cr.jellyfish` | Jellyfish sting | 5 | rinse → aloe | Annoyed | Back to deck |
| `cr.too-much-sun` | Too much sun (dehydration) | 4 | give drink, or IV fluids if dizzy | Dizzy | Cabin |

---

## 9. Mass Casualty Triage (`mc`)

The finale setting. A disaster site, a flood of patients at once, and too few ambulances. Sorting fast matters as much as treating.

- **Camera:** follow
- **Base tasks:** scene check, then triage tag (red, yellow, green, grey)
- **Rules:** a correct tag earns +10. A wrong tag is a wrong action (tagging a savable patient grey is harmful). Ambulances arrive on a schedule with limited slots; loading a green or yellow while a red is waiting costs −10.
- **Stations:** triage point, red / yellow / green zones, supply tent, ambulance loading zone, floodlight generator
- **Chores:** restocking the supply tent, refueling floodlights, clearing debris
- **Hazards:** smoke, darkness, mud; tier 3+ gimmicks: earthquake islands, tent takeoff, stampede lane, aftershocks

| ID | Label | Tag | Tasks | If ignored | Exit |
|---|---|---|---|---|---|
| `mc.walking-wounded` | Walking wounded (minor cuts) | Green | hand a bandage kit (they patch themselves) | Wander off | Home |
| `mc.broken-leg` | Broken leg (fracture) | Yellow | splint → stretcher | Pain gets worse | Later ambulance |
| `mc.heavy-bleeding` | Heavy bleeding (major bleed) | Red | tourniquet | Pale, then crash | First ambulance |
| `mc.hard-to-breathe` | Hard to breathe (collapsed lung) | Red | chest relief needle → oxygen | Turns blue, then crash | First ambulance |
| `mc.burns` | Burns | Yellow or red | cool + dressing → IV fluids | Shock | Ambulance |
| `mc.trapped` | Trapped (crush injury) | Red | IV fluids before the lift, then two-person debris lift | Crashes if lifted without fluids | Ambulance |
| `mc.head-bump` | Head bump (head injury) | Yellow | neck collar → observe | Gets sleepy: becomes red | Ambulance |
| `mc.beyond-help` | Beyond help | Grey | Tag only. Cartoon style: covered with a grey blanket | | |
