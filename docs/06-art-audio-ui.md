# 06. Art, camera, UI, and audio

Reference: open `reference/style-lab.html` in a browser. It shows the chosen look, characters, scrubs, patient cues, cartoon death, both cameras, the ticket rail, and off-screen alerts.

## 1. Look: soft toy

- Rounded, matte forms, like tabletop figures. No outlines.
- Materials: physically based, roughness about 0.8, metalness 0. One hemisphere light + one directional light with soft shadows.
- **Color rule:** muted rooms, saturated characters and items. Patient cue tints (blue, pale, red) must pop against the room.
- Each setting gets its own palette over the muted base:

| Setting | Palette |
|---|---|
| Clinic | Mint and warm wood |
| ED | Teal with red accents |
| Wards | Soft blue and cream |
| ICU | Cool blue with purple monitor glow |
| Surgical Suite | Surgical green, bright white lights |
| Marathon | Sunny yellow and traffic-cone orange |
| Ambulance | Red and white, asphalt gray |
| Cruise | Navy, white, pool turquoise |
| Mass Casualty | Dusty orange, hazard yellow, floodlight white |

**Readability without outlines.** Because there are no outlines, three things carry readability and must never be compromised: player rings + tags, patient cue badges, and the muted-room color rule.

## 2. Characters

- **Proportions:** big head, small egg-shaped body, floating hands, small shoes. No arms or legs.
- **Faces:** simple dot eyes and an expressive mouth (smile, frown, "o"). Eyes blink every few seconds. Faces drive several cues (X eyes, tongue out, closed eyes).
- **Built in code, not modeled.** Characters are procedural (spheres and simple shapes), so customization is just swapping colors and small accessory meshes, with no rigging. Animation is procedural: waddle, bob, lean, hand swing.
- **Scrubs:** every top has a V-neck with darker trim, a chest pocket on the wearer's left, and a hem line separating it from slightly darker pants. In the style lab these are drawn onto a generated texture on the body (`scrubTex`), which is cheap and keeps the silhouette clean.
- **Role colors** (locked; see `02-roles-and-controls.md`): attending white/cream + long white coat; resident navy; nurse blue + scrub cap; med student light purple + short white coat; tech charcoal + scrub cap; RT green; pharmacist wine.
- **Player rings and tags:** flat colored ring under each player (P1 red, P2 blue, P3 yellow, P4 green) and a "P1 Attending" tag above the head. Always visible, drawn on top if occluded.
- **Customization:** skin tone, hair style and color, facial hair, head shape, gender presentation, scrub cap style.

## 3. Patients

- Same procedural style as staff, usually lying in bed under a blanket, head on the pillow, face tilted toward the camera.
- **Cue visuals** (match the signal table in `01-game-design.md`):

| Cue | Visual |
|---|---|
| Not enough oxygen | Blue skin tint, mouth open, gasping bob |
| Losing blood | Pale white tint, slow head wobble, frown |
| Overheated | Red tint, steam wisps rising |
| Heart attack | Sweat drops, hand clutching chest, frown |
| Allergic reaction | Puffy face (head scaled up), red blotches |
| Flat line / zigzag | Eyes closed, gray tint, monitor shows the line in red |
| Seizure | Shaking |
| Stroke | One side of the mouth droops |
| Too much medicine | Very sleepy, slow breathing |
| Losing patience | Steam puffs from ears, foot tapping |

- **Badge:** a colored speech-bubble badge with a short label ("Not enough oxygen") floats above the patient once the explicit warning stage starts.
- **Cartoon death:** eyes become X's, tongue sticks out, then after about 1.4 s the bed rolls out and fades over about 1.3 s.
- **Monitors** show a live line: green when stable, red flat or zigzag in a code, with a heart rate number.

## 4. Props and environments

- **Greybox first.** Every level is playable with primitive shapes before any art exists.
- **Environments** are built from a small modular kit (floor tiles, walls, counters, doors) generated from map JSON.
- **Props:** generate with AI 3D tools (Meshy, Tripo, or open-source Hunyuan3D), fill gaps with CC0 packs (Kenney, Quaternius). Check each tool's license before any public release.
- **Normalize every prop** with the batch Blender script in `tools/` (Claude Code writes it in M5): reduce polygons (target 500 to 3,000 triangles), replace textures with flat colors from the shared palette, matte material, export GLB, compress. Mixed sources must look like one game.
- **Scarce equipment** gets a distinct silhouette and color so players spot it instantly: red crash cart, yellow EKG machine, blue ultrasound cart, gray C-arm, white dialysis machine.

## 5. Camera

| Mode | Behavior | Used on |
|---|---|---|
| Fixed | Angled from above (about 55°), whole map always in view, fitted to the screen's aspect ratio | Small maps |
| Follow | Same angle; pans to the center of all players and zooms to fit their spread (min distance about 11.5 m, max = the fixed view) | Large maps |

Each level sets its camera mode. Camera motion is smoothed (exponential, about 4 per second).

## 6. UI

### In-game

- **Ticket rail** across the top: clipboard-style tickets (brown board, metal clip, white paper, acuity color strip on the left, task chips, patience bar that shifts green → orange → red). Done tasks are checked off; hidden ones show "?".
- **Timer** at the top right.
- **HUD** card at the bottom left: score, stars earned so far, strikes as filled dots.
- **Cue badges** above patients (see 3).
- **Player tags** above heads and rings under feet.
- **Minigame panels** float above the player using them (about 160 × 90 px).

### Off-screen alerts (follow camera only)

- Any patient with an active problem that is off screen gets an arrow badge pinned to the screen edge, in the problem's color, pointing toward the patient, with a short label.
- Codes get a faster pulse and a sound.
- Several off-screen problems stack along the edge, most urgent first.
- Alerts stay clear of the ticket rail and HUD.
- The fixed camera shows the whole map, so it has no off-screen alerts.

### Menus

Clean flat cards with icons: title, city map, briefing cards, role select, results, settings, customization. Rounded friendly typography for headings (style lab uses Fredoka) and a highly legible face for body text (style lab uses Atkinson Hyperlegible). Sentence case everywhere.

### Accessibility

- Cues never rely on color alone (shape, motion, and a text badge).
- Remappable controls and a key-test screen.
- Reduced-motion setting (calms screen shake, pulsing, and particles).
- Optional medical facts can be turned off.
- Subtitles for any spoken or important audio cue.

## 7. Audio

- **Music** is generated in the browser with Tone.js so tempo can change smoothly. Tempo and intensity rise and fall with how hectic the level is (number of active problems, time left).
- **Codes lock the music to 110 bpm**, matching the CPR hitline.
- Minigames do not have their own soundtracks.
- **Sound effects:** distinct alert sounds per problem type, monitor beeps (normal vs. code), "clear!" before shocks, ticket arrival, task complete, wrong action, strike, death (soft, comedic), door bonk, splash, rotor wash, ship creak.
