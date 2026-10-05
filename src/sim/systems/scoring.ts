import type { SimContext, World } from '../types';

// Turns this tick's finished and departed patients into points and strikes (01 §9).
// Numbers come from data/rules.json. A finished patient earns their acuity's points plus
// a speed bonus of up to speedBonusMax of those points, by how much patience was left.
export function scoringSystem(world: World, ctx: SimContext): void {
  const rules = ctx.content.rules;
  for (const event of [...world.events]) {
    if (event.type === 'patientFinished') {
      const points = rules.acuity.find((rule) => rule.acuity === event.acuity)?.points ?? 0;
      const patienceLeft = event.patienceTicks / event.patienceMaxTicks;
      const bonus = Math.round(points * rules.speedBonusMax * patienceLeft);
      addPoints(world, points + bonus, 'finished', event.patient);
    } else if (event.type === 'patientLeft') {
      addPoints(world, rules.outcomes.leave.points, 'left', event.patient);
      world.strikes += rules.outcomes.leave.strikes;
      world.events.push({ type: 'strike', strikes: world.strikes, reason: 'left' });
    }
  }
}

function addPoints(
  world: World,
  points: number,
  reason: 'finished' | 'left',
  patient: number,
): void {
  world.score += points;
  world.events.push({ type: 'scored', points, reason, patient });
}
