// Widget d'accueil du socle : activite recente des espaces groupe [D193].
import { activityWidgetSchema } from "@fm/shared";

import { ActivityRow } from "../activity/activity-page.tsx";

export function Activity({ data }: { data: Record<string, unknown> }) {
  const parsed = activityWidgetSchema.safeParse(data);
  if (!parsed.success) return null;
  if (parsed.data.events.length === 0) {
    return <p className="m-0 text-ink-muted">Rien de neuf dans tes groupes.</p>;
  }
  return (
    <div className="-mx-4">
      {parsed.data.events.map(({ event, spaceId, spaceName }) => (
        <ActivityRow key={event.id} event={event} spaceId={spaceId} spaceName={spaceName} />
      ))}
    </div>
  );
}
