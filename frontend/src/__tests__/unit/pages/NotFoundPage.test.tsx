import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFoundPage from "../../../pages/NotFoundPage";

describe("NotFoundPage", () => {
  it("should render 'Page not Found' text", () => {
    render(<NotFoundPage />);
    expect(screen.getByText("Page not Found.")).toBeInTheDocument();
  });

  it("should render without errors", () => {
    const { container } = render(<NotFoundPage />);
    expect(container).toBeTruthy();
  });
});
