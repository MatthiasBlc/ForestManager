import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import StepEditor from "../../../../components/form/StepEditor";

describe("StepEditor", () => {
  it("should render steps with numbered badges", () => {
    render(
      <StepEditor
        value={[{ instruction: "Step one" }, { instruction: "Step two" }]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Step one")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Step two")).toBeInTheDocument();
  });

  it("should render add step button", () => {
    render(<StepEditor value={[{ instruction: "" }]} onChange={vi.fn()} />);
    expect(screen.getByText("Ajouter une etape")).toBeInTheDocument();
  });

  it("should call onChange when adding a step", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StepEditor value={[{ instruction: "First" }]} onChange={onChange} />);

    await user.click(screen.getByText("Ajouter une etape"));
    expect(onChange).toHaveBeenCalledWith([{ instruction: "First" }, { instruction: "" }]);
  });

  it("should disable remove button when only one step", () => {
    render(<StepEditor value={[{ instruction: "Only" }]} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Remove step")).toBeDisabled();
  });

  it("should enable remove button when multiple steps", () => {
    render(
      <StepEditor
        value={[{ instruction: "A" }, { instruction: "B" }]}
        onChange={vi.fn()}
      />
    );
    const removeButtons = screen.getAllByLabelText("Remove step");
    expect(removeButtons[0]).not.toBeDisabled();
  });

  it("should call onChange when removing a step", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <StepEditor
        value={[{ instruction: "A" }, { instruction: "B" }]}
        onChange={onChange}
      />
    );

    const removeButtons = screen.getAllByLabelText("Remove step");
    await user.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith([{ instruction: "B" }]);
  });

  it("should disable move up on first step and move down on last step", () => {
    render(
      <StepEditor
        value={[{ instruction: "A" }, { instruction: "B" }]}
        onChange={vi.fn()}
      />
    );
    const moveUpButtons = screen.getAllByLabelText("Move up");
    const moveDownButtons = screen.getAllByLabelText("Move down");

    expect(moveUpButtons[0]).toBeDisabled();
    expect(moveDownButtons[1]).toBeDisabled();
    expect(moveDownButtons[0]).not.toBeDisabled();
    expect(moveUpButtons[1]).not.toBeDisabled();
  });

  it("should swap steps when moving down", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <StepEditor
        value={[{ instruction: "First" }, { instruction: "Second" }]}
        onChange={onChange}
      />
    );

    const moveDownButtons = screen.getAllByLabelText("Move down");
    await user.click(moveDownButtons[0]);
    expect(onChange).toHaveBeenCalledWith([{ instruction: "Second" }, { instruction: "First" }]);
  });
});
