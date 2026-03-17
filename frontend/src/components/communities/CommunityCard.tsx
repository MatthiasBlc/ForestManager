import { useNavigate } from "react-router-dom";
import { FaUsers, FaBook } from "react-icons/fa";
import { CommunityListItem } from "../../models/community";

interface CommunityCardProps {
  community: CommunityListItem;
}

const CommunityCard = ({ community }: CommunityCardProps) => {
  const navigate = useNavigate();
  const { name, description, imageUrl, role, membersCount, recipesCount } = community;

  const handleClick = () => {
    navigate(`/communities/${community.id}`);
  };

  return (
    <div
      className="card bg-base-100 shadow-xl cursor-pointer hover:shadow-2xl transition-shadow"
      onClick={handleClick}
    >
      {imageUrl && (
        <figure>
          <img src={imageUrl} alt={name} className="w-full h-40 object-cover" loading="lazy" />
        </figure>
      )}
      <div className="card-body">
        <div className="flex justify-between items-start">
          <h2 className="card-title">{name}</h2>
          <span className={`badge ${role === "MODERATOR" ? "badge-primary" : "badge-ghost"}`}>
            {role}
          </span>
        </div>

        {description && <p className="text-base-content/70 line-clamp-2">{description}</p>}

        <div className="flex gap-4 mt-2 text-sm text-base-content/60">
          <span className="flex items-center gap-1">
            <FaUsers className="w-3 h-3" />
            {membersCount} {membersCount === 1 ? "member" : "members"}
          </span>
          <span className="flex items-center gap-1">
            <FaBook className="w-3 h-3" />
            {recipesCount} {recipesCount === 1 ? "recipe" : "recipes"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommunityCard;
