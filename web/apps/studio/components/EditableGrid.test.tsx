import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableGrid } from "./EditableGrid";

const BLANK = "0".repeat(81);

/** Test host that owns the grid string, like the real pages do. */
function Host({
  initial = BLANK,
  lowConfidence,
  onGrid,
}: {
  initial?: string;
  lowConfidence?: Set<number>;
  onGrid?: (g: string) => void;
}) {
  const [grid, setGrid] = useState(initial);
  const [flagged, setFlagged] = useState<Set<number>>(
    lowConfidence ?? new Set(),
  );
  return (
    <>
      <EditableGrid
        grid={grid}
        onChange={(g) => {
          setGrid(g);
          onGrid?.(g);
        }}
        lowConfidence={flagged}
        onClearFlag={(c) =>
          setFlagged((prev) => {
            const next = new Set(prev);
            next.delete(c);
            return next;
          })
        }
      />
      <output data-testid="grid">{grid}</output>
    </>
  );
}

const cells = () => screen.getAllByRole("gridcell");
const gridValue = () => screen.getByTestId("grid").textContent ?? "";

describe("EditableGrid", () => {
  it("clicking any cell selects it — filled or empty", async () => {
    const user = userEvent.setup();
    render(<Host initial={"5" + "0".repeat(80)} />);
    const c = cells();

    await user.click(c[0]); // filled
    expect(c[0]).toHaveAttribute("aria-selected", "true");

    await user.click(c[42]); // empty
    expect(c[42]).toHaveAttribute("aria-selected", "true");
    expect(c[0]).toHaveAttribute("aria-selected", "false");
  });

  it("typing 1-9 sets the value and auto-advances so a row flows", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(cells()[0]);
    await user.keyboard("534");
    expect(gridValue().slice(0, 3)).toBe("534");
    expect(cells()[3]).toHaveAttribute("aria-selected", "true");
  });

  it("typing over a recognized digit replaces it", async () => {
    const user = userEvent.setup();
    render(<Host initial={"3" + "0".repeat(80)} />);
    await user.click(cells()[0]);
    await user.keyboard("8");
    expect(gridValue()[0]).toBe("8");
  });

  it("Backspace, Delete and 0 clear a cell", async () => {
    const user = userEvent.setup();
    for (const key of ["{Backspace}", "{Delete}", "0"]) {
      const { unmount } = render(<Host initial={"7" + "0".repeat(80)} />);
      await user.click(cells()[0]);
      await user.keyboard(key);
      expect(gridValue()[0]).toBe("0");
      unmount();
    }
  });

  it("arrow keys move the selection around the grid", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(cells()[40]);
    await user.keyboard("{ArrowDown}{ArrowRight}");
    expect(cells()[50]).toHaveAttribute("aria-selected", "true");
  });

  it("Escape deselects", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(cells()[12]);
    expect(cells()[12]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    expect(
      cells().some((c) => c.getAttribute("aria-selected") === "true"),
    ).toBe(false);
  });

  it("shows a touch number pad only while a cell is selected, and it edits", async () => {
    const user = userEvent.setup();
    render(<Host />);
    expect(screen.queryByRole("group", { name: /number pad/i })).toBeNull();

    await user.click(cells()[4]);
    const pad = screen.getByRole("group", { name: /number pad/i });
    await user.click(within(pad).getByRole("button", { name: "9" }));
    expect(gridValue()[4]).toBe("9");
    // selection stays put after a pad tap
    expect(cells()[4]).toHaveAttribute("aria-selected", "true");

    await user.click(within(pad).getByRole("button", { name: /clear/i }));
    expect(gridValue()[4]).toBe("0");
  });

  it("editing a flagged cell clears its low-confidence flag", async () => {
    const user = userEvent.setup();
    render(<Host lowConfidence={new Set([0])} />);
    expect(cells()[0].className).toContain("cell--lowconf");
    await user.click(cells()[0]);
    await user.keyboard("2");
    expect(cells()[0].className).not.toContain("cell--lowconf");
  });

  it("highlights the specific conflicting cells and clears them on fix", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(cells()[0]);
    await user.keyboard("5"); // -> cell 0, advances to 1
    await user.keyboard("5"); // -> cell 1, same row => conflict

    const conflicted = cells().filter((c) =>
      c.className.includes("cell--conflict"),
    );
    expect(conflicted).toHaveLength(2);

    await user.click(cells()[1]);
    await user.keyboard("6"); // fix it
    expect(
      cells().some((c) => c.className.includes("cell--conflict")),
    ).toBe(false);
  });
});
