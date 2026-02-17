import { Tag } from "../../models/recipe";

interface TagBadgeProps {
  tag: Tag;
  size?: "sm" | "lg";
  onClick?: (e: React.MouseEvent) => void;
}

const TagBadge = ({ tag, size = "sm", onClick }: TagBadgeProps) => {
  const isPending = tag.status === "PENDING";

  const baseClasses = `badge badge-${size}`;
  const styleClasses = isPending
    ? "badge-outline badge-warning border-dashed"
    : "badge-primary";
  const interactionClasses = onClick ? "cursor-pointer hover:badge-secondary" : "";

  return (
    <span
      onClick={onClick}
      className={`${baseClasses} ${styleClasses} ${interactionClasses}`}
      title={isPending ? "Pending approval" : undefined}
    >
      {tag.name}
      {isPending && <span className="ml-1 text-[0.65em] opacity-70">(pending)</span>}
    </span>
  );
};

export default TagBadge;
