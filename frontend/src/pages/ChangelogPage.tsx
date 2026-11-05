import { FaRocket, FaWrench, FaBug } from "react-icons/fa";
import { usePaginatedList } from "../hooks/usePaginatedList";
import DataContainer from "../components/DataContainer";
import APIManager from "../network/api";
import { ChangelogEntry, ChangelogItem } from "../models/changelog";

const PAGE_SIZE = 10;

function formatDate(dateStr: string): { relative: string; absolute: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let relative: string;
  if (diffDays === 0) {
    relative = "Aujourd'hui";
  } else if (diffDays === 1) {
    relative = "Hier";
  } else if (diffDays < 7) {
    relative = `Il y a ${diffDays} jours`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    relative = `Il y a ${weeks} semaine${weeks > 1 ? "s" : ""}`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    relative = `Il y a ${months} mois`;
  } else {
    const years = Math.floor(diffDays / 365);
    relative = `Il y a ${years} an${years > 1 ? "s" : ""}`;
  }

  const absolute = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return { relative, absolute };
}

function CategorySection({
  title,
  icon,
  colorClass,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  items: ChangelogItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className={`flex items-center gap-2 mb-2 ${colorClass}`}>
        {icon}
        <h4 className="font-semibold text-sm uppercase tracking-wide">{title}</h4>
      </div>
      <ul className="space-y-1 ml-6">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-base-content/80 list-disc">
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChangelogCard({ entry }: { entry: ChangelogEntry }) {
  const { relative, absolute } = formatDate(entry.publishedAt);

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="badge badge-primary badge-sm font-mono">v{entry.version}</span>
          <h3 className="font-bold text-base md:text-lg flex-1">{entry.title}</h3>
          <span className="text-xs text-base-content/50 tooltip" data-tip={absolute}>
            {relative}
          </span>
        </div>

        {/* Categories */}
        <div className="space-y-4">
          <CategorySection
            title="Nouveautes"
            icon={<FaRocket className="w-3.5 h-3.5" />}
            colorClass="text-success"
            items={entry.content.features}
          />
          <CategorySection
            title="Ameliorations"
            icon={<FaWrench className="w-3.5 h-3.5" />}
            colorClass="text-info"
            items={entry.content.improvements}
          />
          <CategorySection
            title="Corrections"
            icon={<FaBug className="w-3.5 h-3.5" />}
            colorClass="text-error"
            items={entry.content.fixes}
          />
        </div>
      </div>
    </div>
  );
}

function ChangelogPage() {
  const { data, pagination, isLoading, isLoadingMore, error, loadMore } = usePaginatedList(
    (params) => APIManager.getChangelog(params),
    PAGE_SIZE,
    []
  );

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Changelog</h1>

      <DataContainer
        isLoading={isLoading}
        error={error ? "Impossible de charger le changelog" : null}
        isEmpty={data.length === 0}
        emptyMessage="Aucune mise a jour pour le moment"
      >
        <div className="space-y-4">
          {data.map((entry) => (
            <ChangelogCard key={entry.id} entry={entry} />
          ))}
        </div>

        {pagination?.hasMore && (
          <div className="flex justify-center mt-6">
            <button className="btn btn-outline btn-sm" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Voir plus"
              )}
            </button>
          </div>
        )}
      </DataContainer>
    </div>
  );
}

export default ChangelogPage;
