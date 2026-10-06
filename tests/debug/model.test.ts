import { describe, expect, it } from 'vitest';
import { conditionChoices, levelChoices, smooth } from '../../src/debug/model';
import { content } from '../sim/helpers';

describe('debug panel lists', () => {
  it('lists levels in campaign order', () => {
    expect(levelChoices(content()).slice(0, 2)).toEqual([
      { id: 'cl-a', label: '1. First Day' },
      { id: 'ed-a', label: '2. Triage Time' },
    ]);
  });

  it("lists the level's own setting, sickest first, naming hidden conditions", () => {
    const choices = conditionChoices(content(), 'ed');
    expect(choices.every((c) => c.id.startsWith('ed.'))).toBe(true);
    const acuities = choices.map((c) => Number(/acuity (\d)/.exec(c.label)?.[1]));
    expect(acuities).toEqual([...acuities].sort());
    expect(choices.find((c) => c.id === 'ed.dizzy-bleeding')?.label).toBe(
      'Dizzy, really Internal bleeding (acuity 2)',
    );
  });

  it('smooths readouts toward each new sample', () => {
    expect(smooth(10, 20)).toBe(11);
    expect(smooth(10, 20, 1)).toBe(20);
  });
});
