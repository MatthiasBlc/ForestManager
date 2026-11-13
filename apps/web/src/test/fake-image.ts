// Remplace lib/image.ts dans les tests de composants (jsdom ne dessine pas) :
// vi.mock("<chemin>/lib/image.ts", () => import("<chemin>/test/fake-image.ts")).
export function convertImage(file: Blob): Promise<Blob> {
  return Promise.resolve(new Blob([file], { type: "image/webp" }));
}

/** Decoupe simulee : un carre WebP. */
export function cropImage(file: Blob): Promise<Blob> {
  return Promise.resolve(new Blob([file], { type: "image/webp" }));
}
