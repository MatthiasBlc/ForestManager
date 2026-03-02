import { FaClock, FaFire, FaPause } from "react-icons/fa";
import { formatDuration } from "../../utils/formatDuration";

interface TimeBadgesProps {
  prepTime: number | null;
  cookTime: number | null;
  restTime: number | null;
}

const TimeBadges = ({ prepTime, cookTime, restTime }: TimeBadgesProps) => {
  const totalTime = (prepTime ?? 0) + (cookTime ?? 0) + (restTime ?? 0);

  if (prepTime == null && cookTime == null && restTime == null) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {prepTime != null && (
        <div className="badge badge-outline gap-1">
          <FaClock className="w-3 h-3" /> Prep {formatDuration(prepTime)}
        </div>
      )}
      {cookTime != null && (
        <div className="badge badge-outline gap-1">
          <FaFire className="w-3 h-3" /> Cuisson {formatDuration(cookTime)}
        </div>
      )}
      {restTime != null && (
        <div className="badge badge-outline gap-1">
          <FaPause className="w-3 h-3" /> Repos {formatDuration(restTime)}
        </div>
      )}
      {totalTime > 0 && (
        <div className="badge badge-primary gap-1">
          Total {formatDuration(totalTime)}
        </div>
      )}
    </div>
  );
};

export default TimeBadges;
