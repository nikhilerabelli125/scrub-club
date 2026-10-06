# 09. Decision log

Source codes: **Q** = original questionnaire, **C** = first clarification round, **OQ** = catalog v1 open questions, **AD/AQ** = addendum questions, **Lab** = style lab feedback. Add a line whenever a decision changes.

| Area | Decision | Source |
|---|---|---|
| Format | Browser, local co-op, 1 to 4 players | Brief |
| Tone | Light but grounded; entertainment first | Q2 |
| Bad outcomes | Leave, rescue transfer, or cartoon death | Q3, C10 |
| Critical patients | Never leave; they code or transfer | C11 |
| Scope | Full game planned (9 settings, 25 levels), built in milestones | Q4, Q33 |
| Level length | 5 to 6 minutes | Q7 |
| Tickets | Full early; assessment reveals tasks later; judgment events have no ticket | Q8, Q63 |
| Mistakes | Allowed, penalty scales with harm | Q9 |
| Tasks | Mostly parallel; base tasks gate the rest | Q10 |
| Disposition | Scales by tier: auto → sign → transport | Q12 |
| Escalation | Only conditions that can escalate do; timing jitters; hidden conditions behind mild complaints | C1, Q19, Q20 |
| Early levels | Escalation capped at rescue transfer before codes are taught (levels 1 to 9) | Spec |
| Warnings | Two-stage: subtle cue, then badge with less time; partial treatment buys time | Q17, Q18 |
| Transfers | Planned = success; rescue = penalty | C2 |
| Scoring | Points → stars; separate strike meter (1 leave, 2 rescue, 3 death) | C5, Q21, Q55 |
| Codes | 2 players to stabilize, then 1 maintains; bed spots; no shared minigames | C6, Q29 |
| Codes | Nothing slows down during a code, any mode | OQ1 |
| Solo codes | Swapped-away character keeps doing CPR at normal grade | Addendum round |
| Minigame difficulty | Fixed everywhere; grade affects speed only | Q30, Q31, Q55 |
| Intubation | 3-button QTE | C3 |
| CPR | Rhythm hitline; no compressor swaps | Q23, Q27 |
| Music | Adaptive tempo; locks to CPR tempo during codes | Q62, C9 |
| Roles | Soft perks, picked per level, duplicates allowed, passive + ability | Q39 to Q42, OQ2 |
| Starting roles | Attending, resident, nurse, med student; tech, RT, pharmacist unlock | OQ2 |
| Role perks | Med student keeps extra-clue HPI; resident faster procedures; attending fastest assessments | C4 |
| Med student | No sprint; 5% "STUDENT!" fumble kept | C4, Q43 |
| Abilities | Picked at role select where a role has two | Catalog comments, addendum |
| Resident | Hustle or Stat Results | AQ3 |
| Pharmacist | Never overdoses (passive); Med Drop or Auto-Dose | Catalog comments |
| Nurse | Rounds or Quick Stick, picked at role select | Addendum round |
| Role colors | Attending cream, resident navy, nurse blue, med student light purple, tech charcoal, RT green, pharmacist wine; scrub color not customizable | AQ2, Lab |
| Player identity | Colored ring + P tag, always visible (players track themselves by these) | Lab |
| Scrubs | V-neck with trim, pocket, hem line | Lab |
| Look | Soft toy (no outlines) | Lab (changed from AD1 toon) |
| Proportions / faces | Big head, floating hands; dot eyes + expressive mouth | AD2, AD3 |
| Camera | Fixed on small maps, follow on large maps | AD4 |
| Off-screen alerts | Edge arrows in follow camera | Lab |
| Color rule | Muted rooms, saturated characters and items | AD5 |
| UI | Clipboard tickets; flat menus and HUD | AD6 |
| Art references | None; original look | AD7 |
| Communication | No pings; dance emotes; Discord online | Q48, C7 |
| World map | City map: hospital campus + off-site pins | C8 |
| Throwing | Tubes break; pads onto patients; needle sticks bench a teammate 5 s | Q49 |
| Labels | Simplified in-game text; "EKG" not "heart tracing" | Q51, catalog comments |
| Heart attack | EKG → aspirin → cath lab; no nitro | Addendum round |
| Heat stroke | Cooling only; no fever medicine | Addendum round |
| Content | No pediatrics; substance use allowed; no psych patients (agitation OK) | Q33, Q54, catalog comments |
| Triage | Grey "beyond help" tag included | OQ3 |
| Transplants | Organs arrive by helicopter; donors never shown | OQ4 |
| Two-person carries | Ambulance, Mass Casualty, sometimes ED | OQ5 |
| Title | Scrub Club | OQ6 |
| Surgery | One Surgical Suite setting (general OR first, transplant later) | AQ1 |
| Gimmicks | Tiers 1 to 2 readable; ramp from tier 3 | AQ4 |
| Campaign | Interleaved settings, linear difficulty | Catalog comments |
| Wards | Rebuilt around visible, physical problems | Catalog comments |
| ICU | Procedures added | Catalog comments |
| Learning | Optional one-line fact; no case review | Q38, Q53 |
| Visuals | True 3D | Q59 |
| Tech | Three.js + Rapier + TypeScript + Vite; Vercel | Q64, Q66 |
| Data | All content in JSON | Q65 |
| Hardware | Recent Macs and Windows PCs; quality toggle | C13 |
| Controls | Move + 4 buttons; keyboard + controllers | Q32, Q44 |
| Solo | Overcooked-style character swap | Q45 |
| Online | Later; architecture kept ready | Q46 |
| Team | 3 to 4 devs, all via Claude Code | C12 |
| Tooling | TypeScript 6.0 until typescript-eslint supports TypeScript 7 | M0 |
| Data | Registries for stations, items, equipment, gimmicks, hazards, and code rules; validate-data checks every reference and each level against its own map | M0 |
| Data | Repeated tasks use `count` (two IVs), so `after` is never ambiguous | M0 |
| Equipment | The crash cart carries the defibrillator; standalone defibrillators (the marathon AED) are their own equipment | M0 |
| Unlocks | Levels own unlocks (`unlocks` in level data); roles only say base or unlock | M0 |
| Codes | Patients can arrive mid-code; a code not fixed within 45 s (draft) is lost | M0 |
| Maps | Clinic gets a med cabinet, juice fridge, and EKG machine; ED gets a blood fridge and observation chairs, because their patients need them | M0 |
| Sepsis | Antibiotics go alongside IV fluids after the blood test, not after the fluids, since antibiotics shouldn't wait (pending medical review) | M0 review |
| Appendicitis | Pain med goes alongside the workup; early pain relief doesn't hide the diagnosis (pending medical review) | M0 review |
| Treat first | Seizure med and the opioid reversal shot come before questions, like the allergy shot, since these patients can't answer (01 §4.3; pending medical review) | M0 review |
| Anaphylaxis | ED allergic reaction that turns blue ends in a rescue transfer, like the clinic version | M0 review |
| Pharmacist | Passive speeds up giving meds; nothing in the game makes the med cabinet slow | M0 review |
| ED-A | A guaranteed chest pain arrives by ambulance at 1:00, so every run has an orange patient to prioritize | M0 review |
| ED-E | Chest pain deteriorates on its own escalation timer (about 1:40), not a scripted 2:30 event | M0 review |
| Tuning | Patience, points, strikes, and player-count scaling live in `data/rules.json` | M1 |
| Spawning | First patient at the start; `maxWaiting` caps active patients and pauses the spawn timer; scripted spawns ignore the cap | M1 |
| Tasks | "First" tasks come before the base tasks, which gate the rest; `after` waits for every repeat | M1 |
| Stars | Thresholds scale by player count in time mode too | M1 |
| Debugging | Dev and test commands travel in the per-tick input, so replays stay exact | M1 |
| Beds | Patients take free beds in map order; beds named by scripted spawns stay free; choosing seats by escort arrives in M2 | M1 |
| Items | Pick up at a station hands out what a patient will need; Pick up again returns it to its shelf or sets it down | M1 |
| Use | Starts the first task doable at the nearest patient, preferring the carried item; at a station, its task for the longest-waiting patient | M1 |
| Working | Players stay rooted while working; letting go of a hold pauses it with progress kept on the patient | M1 |
| Stand-ins | Unbuilt minigames and interactions are 2 s holds until their milestones; equipment ignored until M2 | M1 |
| Greybox labels | Patients show their complaint in their acuity color and stations their name, until cue visuals (M2) and art (M5) | M1 |
| Tickets | Task chips show what can be done now, what comes later, and what's done | M1 |
| Run options | `?level=` and `?players=1` pick a level or solo play until menus (M4) | M1 |
| Controls | Player 1 uses E for Use instead of G, which was hard to reach | M1 playtest (#5) |
| Player ring | Drawn under its player: characters cover the ring's far side, and the ring still shows through walls | M1 playtest (#6) |
| Beds | Patients are roomed in a random free bed, not left to right, so players run between rooms | M1 playtest (#7) |
| Rooming | Stays automatic (option B): the sickest waiting patient takes the next free bed, a random one; the waiting room holds the overflow | M1 playtest (#10) |
| Waiting room | Patients there get triage only (treat-first shots, questions, vitals); the rest of their care waits for a bed | M1 playtest (#10) |
| Spawning | `maxWaiting` caps the waiting room, as docs/05 words it ("max 4 waiting"); `maxActive` caps tickets for one-at-a-time tutorials (CL-A) | M1 playtest (#10) |
