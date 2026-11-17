// Contrat d'export entre le socle et les modules [D37, D192] : le socle tient
// la demande, la limite, l'archive zip et le telechargement ; chaque module
// fournit ses fichiers (aucun module code dans le socle [D40]).
import type { ExportFormat, ExportScope } from "@fm/shared";

import type { Context } from "../context.ts";

export interface ExportRequest {
  userId: string;
  scope: ExportScope;
  /** Espace exporte (SPACE), null pour ses propres donnees. */
  spaceId: string | null;
  format: ExportFormat;
  photos: boolean;
}

export interface ArchiveFile {
  /** Chemin dans l'archive, sans `/` initial. */
  path: string;
  data: Uint8Array;
}

export type ModuleExport = (ctx: Context, request: ExportRequest) => Promise<ArchiveFile[]>;
