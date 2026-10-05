// The game's view of data/: everything validated, then indexed by id. Built once at load,
// never changed, and never part of the sim's saved state.
import type {
  ConditionDef,
  EquipmentDef,
  GimmickDef,
  HazardDef,
  ItemDef,
  LevelDef,
  MapDef,
  RolesFile,
  RulesFile,
  SettingId,
  StationTypeDef,
  TaskDef,
} from './schema';
import { checkData, type DataFile, type DataIssue } from './validate';

export interface Content {
  tasks: ReadonlyMap<string, TaskDef>;
  conditions: ReadonlyMap<string, ConditionDef>;
  baseTasks: ReadonlyMap<SettingId, readonly string[]>;
  levels: ReadonlyMap<string, LevelDef>;
  maps: ReadonlyMap<string, MapDef>;
  stations: ReadonlyMap<string, StationTypeDef>;
  items: ReadonlyMap<string, ItemDef>;
  equipment: ReadonlyMap<string, EquipmentDef>;
  gimmicks: ReadonlyMap<string, GimmickDef>;
  hazards: ReadonlyMap<string, HazardDef>;
  roles: RolesFile;
  rules: RulesFile;
}

export type LoadResult = { ok: true; content: Content } | { ok: false; issues: DataIssue[] };

export function loadContent(files: readonly DataFile[]): LoadResult {
  const { data, issues } = checkData(files);
  if (!data) return { ok: false, issues };
  return {
    ok: true,
    content: {
      tasks: byId(data.tasks.tasks),
      conditions: byId(data.conditionFiles.flatMap((file) => file.data.conditions)),
      baseTasks: new Map(
        data.conditionFiles.map((file) => [file.data.setting, file.data.baseTasks]),
      ),
      levels: byId(data.levels.map((file) => file.data)),
      maps: byId(data.maps.map((file) => file.data)),
      stations: byId(data.stations.stations),
      items: byId(data.items.items),
      equipment: byId(data.equipment.equipment),
      gimmicks: byId(data.gimmicks.gimmicks),
      hazards: byId(data.hazards.hazards),
      roles: data.roles,
      rules: data.rules,
    },
  };
}

function byId<T extends { id: string }>(entries: readonly T[]): ReadonlyMap<string, T> {
  return new Map(entries.map((entry) => [entry.id, entry]));
}
