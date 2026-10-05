# 02. Roles, players, and controls

## 1. Player identity

Playtesting the style lab showed that players track themselves by the **ring under their character and the tag above them**, not by scrub color. These are core UI:

| Player | Ring + tag color |
|---|---|
| P1 | Red `#E2483D` |
| P2 | Blue `#2F7FE0` |
| P3 | Yellow `#E8B321` |
| P4 | Green `#3BB273` |

- The ring sits flat on the floor under the character. The tag ("P1 Attending") floats above the head.
- Both are always visible: never hidden by effects, darkness, or gimmicks, and drawn on top of world geometry if a character is occluded.

## 2. Character customization

Players can customize skin tone, hair (style and color), facial hair, head shape, gender presentation, and scrub cap style. **Scrub color is not customizable**; it is locked to the role.

## 3. Roles

Roles are soft perks only. Every player can do every task. Roles are picked per level at the role-select screen, and two players can pick the same role. Each role has one passive perk and one active ability on a cooldown. Where a role has two abilities, the player picks one at role select.

| Role | Start | Scrubs | Look | Passive perk | Ability options |
|---|---|---|---|---|---|
| Attending | Base | White/cream `#F2EBDD` | Long white coat | Assessments (questions, exam) 40% faster | Huddle or Second Look |
| Resident | Base | Navy `#1F2E5A` | | Procedures and minigame tasks 25% faster | Hustle or Stat Results |
| Nurse | Base | Blue `#2F6FD0` | Scrub cap | Vitals 50% faster; sees warning cues 3 s earlier | Rounds or Quick Stick |
| Med student | Base | Light purple `#B9A4E3` | Short white coat | Questions reveal one extra clue (can unmask hidden conditions); all tasks 20% slower; 5% fumble | Coffee Run |
| Tech | Unlock | Charcoal `#454B55` | Scrub cap | Carries two items | Turbo Turnover or Supply Run |
| Respiratory therapist | Unlock | Green `#2E8B57` | | Oxygen and airway setup 40% faster | Deep Breath or Vent Sweep |
| Pharmacist | Unlock | Wine `#7A2E46` | | Their doses can never overdose; giving meds 40% faster | Med Drop or Auto-Dose |

All numbers are draft.

**What "faster" means for minigames.** Minigame difficulty never changes (see `03-minigames.md`). A speed perk shortens the task: fewer beats, shorter sequences, or a shorter wait after success.

**Med student fumble.** Each time the med student completes a task there is a 5% chance it fails at the last moment. A "STUDENT!" pop-up appears and the task must be redone.

### Abilities

| Ability | Role | Effect | Cooldown |
|---|---|---|---|
| Huddle | Attending | Whole team works and moves 30% faster for 5 s | 40 s |
| Second Look | Attending | Reveal one patient's full task list, including hidden conditions | 30 s |
| Hustle | Resident | Unlimited dash for 6 s | 35 s |
| Stat Results | Resident | Next lab or scan result arrives instantly | 40 s |
| Rounds | Nurse | Instantly check vitals on every patient on screen | 45 s |
| Quick Stick | Nurse | Next IV or blood draw is instant | 25 s |
| Coffee Run | Med student | Everyone moves 20% faster for 8 s | 45 s |
| Turbo Turnover | Tech | Instantly clean and prep one bed | 30 s |
| Supply Run | Tech | Restock every supply station | 50 s |
| Deep Breath | RT | Freeze the timers of every low-oxygen patient for 8 s | 45 s |
| Vent Sweep | RT | Auto-suction every breathing machine | 40 s |
| Med Drop | Pharmacist | Every patient's due meds appear at their bedside | 45 s |
| Auto-Dose | Pharmacist | Due scheduled meds are given automatically for 6 s | 60 s |

### Unlocks (draft)

- Tech: after level 5
- Respiratory therapist: after level 12 (first ICU level)
- Pharmacist: after level 15

In data, each unlock lives on the level that grants it (`unlocks` in the level file), so there's one place to change it.

## 4. Controls

Every player uses movement plus four buttons. Minigames prompt with the same four buttons, so no player ever needs extra keys.

| Button | On the floor | In minigames |
|---|---|---|
| 1. Pick up / put down | Grab or drop items, push beds and wheelchairs | Button 1 |
| 2. Use | Hold to do tasks; press while holding an item to throw it | Button 2 |
| 3. Dash | Short burst of speed | Button 3 |
| 4. Ability | Role ability | Button 4 |

**Emotes.** Dance emotes only (no pings). Controller players use the D-pad. Keyboard players can bind one optional emote key in the remap screen.

### Devices

- Up to 2 players on one keyboard, plus controllers for the rest, 4 players max. Any mix works.
- Controllers through the browser Gamepad API: Xbox and PlayStation work out of the box. Switch Pro button layouts vary by browser, so the remap screen covers them.
- Default keyboard layouts (remappable):

| | Move | Pick up | Use | Dash | Ability |
|---|---|---|---|---|---|
| Keyboard P-left | W A S D | F | G | Left Shift | R |
| Keyboard P-right | Arrow keys | K | L | Right Shift | O |

- Laptop keyboards drop some simultaneous key presses. The settings menu includes a key-test screen so players can check their layout.

### Joining

The lobby says "Press any button to join." The device that presses claims the next free player slot (P1 to P4) and its ring color. Players then pick a role and ability.

## 5. Solo play

A solo player controls two characters and swaps between them with a swap button (keyboard: Tab; controller: shoulder button). The character you swap away from keeps doing CPR at normal grade (decided). Draft, to confirm in playtests: it also keeps doing hold tasks, and any other minigame pauses until you swap back.

## 6. Communication

No ping or marker system. Couch players talk. Online players (later) use voice chat such as Discord.

## 7. Online play (later)

Not in the first release. One player's browser runs the game and the others connect by room code. The architecture rules in `07-architecture.md` keep this possible.
