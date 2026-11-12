// Contrat des widgets d'accueil entre le socle et les modules [D193].
import type { Context } from "../context.ts";

export interface WidgetSpace {
  id: string;
  name: string;
}

export interface WidgetInput {
  userId: string;
  /** Espaces de l'utilisateur ou le module est actif (jamais vide). */
  spaces: readonly WidgetSpace[];
}

export interface ApiWidget {
  /** Choisi tant que l'utilisateur garde le defaut. */
  default: boolean;
  /** Rang dans l'ordre par defaut et dans la feuille "Personnaliser". */
  order: number;
  load: (ctx: Context, input: WidgetInput) => Promise<Record<string, unknown>>;
}
