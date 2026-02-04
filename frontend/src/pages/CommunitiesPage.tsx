import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus } from "react-icons/fa";
import { CommunityListItem } from "../models/community";
import APIManager from "../network/api";
import CommunityCard from "../components/communities/CommunityCard";

const CommunitiesPage = () => {
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCommunities() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await APIManager.getCommunities();
        setCommunities(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load communities");
      } finally {
        setIsLoading(false);
      }
    }

    loadCommunities();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Communities</h1>
        <button
          className="btn btn-primary gap-2"
          onClick={() => navigate("/communities/create")}
        >
          <FaPlus />
          New Community
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {communities.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {communities.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-base-content/60 mb-4">
                You haven't joined any communities yet
              </p>
              <button
                className="btn btn-primary gap-2"
                onClick={() => navigate("/communities/create")}
              >
                <FaPlus />
                Create your first community
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommunitiesPage;
