// Liste statique des modules web [D71] : seul endroit qui importe les manifestes.
import type { WebModule } from "../app/registry.ts";
import { recipesModule } from "./recipes/manifest.ts";

export const WEB_MODULES: readonly WebModule[] = [recipesModule];
