/** Mirrors solvers/events.py: type constants and a structural validator. */
import { LIFECYCLE_TYPES, type StepEvent } from "./types.js";

export const EVENT_TYPES = {
  ASSIGN: "assign",
  UNASSIGN: "unassign",
  ELIMINATE: "eliminate",
  RESTORE: "restore",
  AC3_REVISE: "ac3_revise",
  SWAP: "swap",
  REASSIGN: "reassign",
  CONFLICTS: "conflicts",
  START: "start",
  PHASE: "phase",
  SOLVED: "solved",
  STOPPED: "stopped",
} as const;

const isCell = (x: unknown): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 80;
const isCellOrNull = (x: unknown): boolean => x === null || isCell(x);
const isValue = (x: unknown): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= 9;

export function isValidEvent(ev: unknown): ev is StepEvent {
  if (typeof ev !== "object" || ev === null) return false;
  const e = ev as Record<string, unknown>;
  if (typeof e.type !== "string" || typeof e.step !== "number") return false;
  switch (e.type) {
    case "assign":
    case "unassign":
      return isCell(e.cell) && isValue(e.value);
    case "eliminate":
    case "restore":
      return isCell(e.cell) && isValue(e.value) && isCellOrNull(e.by);
    case "ac3_revise":
      return (
        Array.isArray(e.arc) &&
        e.arc.length === 2 &&
        e.arc.every(isCell) &&
        Array.isArray(e.removed) &&
        e.removed.every(isValue)
      );
    case "swap":
      return isCell(e.cell_a) && isCell(e.cell_b) && isValue(e.value_a) && isValue(e.value_b);
    case "reassign":
      return isCell(e.cell) && isValue(e.value);
    case "conflicts":
      return typeof e.count === "number" && e.count >= 0;
    default:
      return LIFECYCLE_TYPES.has(e.type as StepEvent["type"]);
  }
}
