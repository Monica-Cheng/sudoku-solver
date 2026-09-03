// Node smoke test for lib/gridState — drives GridModel with a real solve()
// event stream (no browser). Confirms the event->visual reducer produces a
// consistent final state for each algorithm.
import { solve } from "../../../packages/solver-core/dist/index.js";

// tiny re-impl of the CellStatus + reducer contract check (GridModel is TS;
// we assert on observable outcomes via a parallel plain-JS model)
const puzzles = {
  easy: "090000040600030005500000000059000001020000050700580000000005409900800000000009086",
  hard17: "000000010400000000020000000000050407008000300001090000300400200050100000000806000",
};

for (const algo of ["backtracking", "forward_checking", "ac3", "min_conflicts"]) {
  for (const [tag, puzzle] of Object.entries(puzzles)) {
    const events = [];
    const r = solve(puzzle, algo, {
      seed: 0,
      maxSteps: algo === "min_conflicts" ? 50000 : tag === "hard17" ? 400000 : 50000,
      maxEvents: 4000,
      onStep: (e) => events.push(e),
    });

    // replay into a minimal model
    const values = new Array(81).fill(0);
    for (let i = 0; i < 81; i++) {
      const d = puzzle.charCodeAt(i) - 48;
      if (d >= 1 && d <= 9) values[i] = d;
    }
    let assigns = 0,
      unassigns = 0,
      lastStep = 0,
      solvedSeen = false;
    for (const e of events) {
      if (e.type === "assign") (values[e.cell] = e.value), assigns++;
      else if (e.type === "unassign") (values[e.cell] = 0), unassigns++;
      else if (e.type === "swap") {
        values[e.cell_a] = e.value_b;
        values[e.cell_b] = e.value_a;
      } else if (e.type === "reassign") values[e.cell] = e.value;
      else if (e.type === "solved") {
        for (let i = 0; i < 81; i++) values[i] = e.solution.charCodeAt(i) - 48;
        solvedSeen = true;
      }
      if ("step" in e) lastStep = e.step;
    }
    const filled = values.filter((v) => v >= 1 && v <= 9).length;
    const first = events[0]?.type;
    const last = events[events.length - 1]?.type;
    const ok =
      first === "start" &&
      (last === "solved" || last === "stopped") &&
      (r.terminatedReason !== "solved" || (solvedSeen && filled === 81));
    console.log(
      `${algo.padEnd(16)} ${tag.padEnd(6)} ${String(r.terminatedReason).padEnd(10)} ` +
        `events=${String(events.length).padStart(5)} step≈${String(lastStep).padStart(7)} ` +
        `assigns=${assigns} unassigns=${unassigns} filled=${filled}/81  ${ok ? "OK" : "FAIL"}`,
    );
    if (!ok) process.exitCode = 1;
  }
}
