import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import TimeBadges from "../../../../components/recipes/TimeBadges";

describe("TimeBadges", () => {
  it("should render nothing when all times are null", () => {
    const { container } = render(
      <TimeBadges prepTime={null} cookTime={null} restTime={null} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("should render prep time badge", () => {
    render(<TimeBadges prepTime={15} cookTime={null} restTime={null} />);
    expect(screen.getByText(/Prep 15 min/)).toBeInTheDocument();
  });

  it("should render cook time badge", () => {
    render(<TimeBadges prepTime={null} cookTime={30} restTime={null} />);
    expect(screen.getByText(/Cuisson 30 min/)).toBeInTheDocument();
  });

  it("should render rest time badge", () => {
    render(<TimeBadges prepTime={null} cookTime={null} restTime={60} />);
    expect(screen.getByText(/Repos 1h/)).toBeInTheDocument();
  });

  it("should render total time badge when at least one time is defined", () => {
    render(<TimeBadges prepTime={15} cookTime={30} restTime={null} />);
    expect(screen.getByText(/Total 45 min/)).toBeInTheDocument();
  });

  it("should render all badges when all times are defined", () => {
    render(<TimeBadges prepTime={15} cookTime={30} restTime={60} />);
    expect(screen.getByText(/Prep 15 min/)).toBeInTheDocument();
    expect(screen.getByText(/Cuisson 30 min/)).toBeInTheDocument();
    expect(screen.getByText(/Repos 1h/)).toBeInTheDocument();
    expect(screen.getByText(/Total 1h45/)).toBeInTheDocument();
  });

  it("should format hours correctly in total", () => {
    render(<TimeBadges prepTime={60} cookTime={60} restTime={null} />);
    expect(screen.getByText(/Total 2h/)).toBeInTheDocument();
  });
});
