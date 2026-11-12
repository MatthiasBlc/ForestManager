// Verification d'accessibilite des tests de composants (axe-core). Le contraste
// ne se calcule pas sans rendu reel : il est verifie dans le design system (B4)
// et par les E2E.
import axe from "axe-core";

export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`
  );
}
