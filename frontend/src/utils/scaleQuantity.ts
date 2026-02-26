export function scaleQuantity(
  baseQty: number | null,
  baseServings: number,
  selectedServings: number,
): number | null {
  if (baseQty === null) return null;

  const scaled = baseQty * (selectedServings / baseServings);
  return parseFloat(scaled.toFixed(2));
}
