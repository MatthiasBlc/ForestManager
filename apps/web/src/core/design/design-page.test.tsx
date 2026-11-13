import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { axeViolations } from "../../test/axe.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { THEMES } from "../../theme/themes.ts";
import { DesignPage } from "./design-page.tsx";

describe("catalogue /design (D29)", () => {
  for (const theme of THEMES) {
    it(`montre chaque composant dans le theme ${theme}, sans violation axe`, async () => {
      const { container } = renderWithProviders(<DesignPage initialTheme={theme} />);
      expect(document.documentElement).toHaveAttribute("data-theme", theme);
      for (const name of [
        "Button",
        "Field",
        "Switch",
        "TintPicker",
        "OptionList",
        "Sheet",
        "Toast",
      ]) {
        expect(screen.getByRole("heading", { name })).toBeInTheDocument();
      }
      expect(await axeViolations(container)).toEqual([]);
    });
  }

  it("change de theme et de teinte", async () => {
    const { user } = renderWithProviders(<DesignPage initialTheme="braise-dark" />);
    await user.click(screen.getByRole("radio", { name: /Potager clair/ }));
    expect(document.documentElement).toHaveAttribute("data-theme", "potager-light");
    await user.click(screen.getByRole("radio", { name: "Aubergine" }));
    expect(document.documentElement).toHaveAttribute("data-space", "3");
  });
});
