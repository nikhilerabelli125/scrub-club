// What the debug panel lists, worked out from the content. Pure (no DOM), so it's unit
// tested; panel.ts only draws it.
import type { Content, SettingId } from '../data';

export interface Choice {
  id: string;
  label: string;
}

// Every level in campaign order, for jumping straight to one.
export function levelChoices(content: Content): Choice[] {
  return [...content.levels.values()]
    .sort((a, b) => a.number - b.number)
    .map((level) => ({ id: level.id, label: `${level.number}. ${level.name}` }));
}

// The conditions a level's setting can spawn, sickest first. The panel is for the team,
// so it names hidden conditions by what they really are.
export function conditionChoices(content: Content, setting: SettingId): Choice[] {
  return [...content.conditions.values()]
    .filter((condition) => condition.setting === setting)
    .sort((a, b) => a.acuity - b.acuity || a.label.localeCompare(b.label))
    .map((condition) => {
      const shown = condition.hidden ? `${condition.hidden.showsAs.label}, really ` : '';
      return { id: condition.id, label: `${shown}${condition.label} (acuity ${condition.acuity})` };
    });
}

// A moving average, so the fps and tick-time readouts don't flicker every frame.
export function smooth(previous: number, sample: number, weight = 0.1): number {
  return previous + (sample - previous) * weight;
}
