import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import ServingsSelector from "../../../../components/recipes/ServingsSelector";

describe("ServingsSelector", () => {
  it("should render with current value", () => {
    render(<ServingsSelector baseServings={4} value={4} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
    expect(screen.getByText("personnes")).toBeInTheDocument();
  });

  it("should increment value on + click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ServingsSelector baseServings={4} value={4} onChange={onChange} />);

    await user.click(screen.getByText("+"));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("should decrement value on - click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ServingsSelector baseServings={4} value={4} onChange={onChange} />);

    await user.click(screen.getByText("-"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("should disable - button when value is 1", () => {
    render(<ServingsSelector baseServings={4} value={1} onChange={vi.fn()} />);
    expect(screen.getByText("-")).toBeDisabled();
  });

  it("should disable + button when value is 100", () => {
    render(<ServingsSelector baseServings={4} value={100} onChange={vi.fn()} />);
    expect(screen.getByText("+")).toBeDisabled();
  });

  it("should call onChange when typing in input", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ServingsSelector baseServings={4} value={4} onChange={onChange} />);

    const input = screen.getByDisplayValue("4");
    await user.type(input, "2");
    expect(onChange).toHaveBeenCalledWith(42);
  });
});
