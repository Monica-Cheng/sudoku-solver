import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SolveResult, TerminatedReason } from "@sudoku/solver-core";
import { OutcomeBanner } from "./OutcomeBanner";
import type { SettledRun } from "@/lib/outcomes";

const PUZZLE = "0".repeat(81);

function settled(reason: TerminatedReason): SettledRun {
  const result: SolveResult = {
    solution: reason === "solved" ? "1".repeat(81) : null,
    solved: reason === "solved",
    runtimeMs: 1,
    nodes: 68,
    backtracks: 0,
    stepsEmitted: 0,
    algorithmName: "backtracking",
    terminatedReason: reason,
    seed: null,
    extra: {},
  };
  return { status: "stopped", result };
}

const box = (headline: string) =>
  screen.getByText(headline, { selector: "span" }).closest("div")!;

describe("OutcomeBanner", () => {
  it("renders nothing while running", () => {
    const { container } = render(
      <OutcomeBanner running settled={null} puzzle={PUZZLE} algo="backtracking" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("unsolvable (exhausted) shows a neutral 'no solution' box, not the red error box", () => {
    render(
      <OutcomeBanner
        running={false}
        settled={settled("exhausted")}
        puzzle={PUZZLE}
        algo="backtracking"
      />,
    );
    expect(screen.getByText("no solution")).toBeInTheDocument();
    const cls = box("no solution").className;
    expect(cls).toContain("border-border");
    expect(cls).not.toContain("border-fail");
    expect(screen.getByText(/every possibility/i)).toBeInTheDocument();
  });

  it("no_solution also renders the neutral box", () => {
    render(
      <OutcomeBanner
        running={false}
        settled={settled("no_solution")}
        puzzle={PUZZLE}
        algo="ac3"
      />,
    );
    expect(box("no solution").className).not.toContain("border-fail");
    expect(screen.getByText(/propagation/i)).toBeInTheDocument();
  });

  it("max_steps renders the amber 'gave up' box", () => {
    render(
      <OutcomeBanner
        running={false}
        settled={settled("max_steps")}
        puzzle={PUZZLE}
        algo="backtracking"
      />,
    );
    expect(screen.getByText("gave up")).toBeInTheDocument();
    expect(box("gave up").className).toContain("border-accent");
  });

  it("a genuine worker failure renders the red error box", () => {
    render(
      <OutcomeBanner
        running={false}
        settled={{ status: "error", result: null, message: "worker crashed" }}
        puzzle={PUZZLE}
        algo="backtracking"
      />,
    );
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(box("error").className).toContain("border-fail");
  });

  it("a cancelled run renders nothing", () => {
    const { container } = render(
      <OutcomeBanner
        running={false}
        settled={{ status: "stopped", result: null }}
        puzzle={PUZZLE}
        algo="backtracking"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
