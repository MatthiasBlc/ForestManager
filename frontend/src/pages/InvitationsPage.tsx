import { useEffect, useState } from "react";
import { FaEnvelope } from "react-icons/fa";
import { ReceivedInvite } from "../models/community";
import APIManager from "../network/api";
import InviteCard from "../components/invitations/InviteCard";

const InvitationsPage = () => {
  const [invites, setInvites] = useState<ReceivedInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const loadInvites = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await APIManager.getMyInvites(statusFilter || undefined);
      setInvites(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invitations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleRespond = () => {
    loadInvites();
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FaEnvelope className="w-5 h-5" />
          Invitations
        </h1>
        <select
          className="select select-bordered select-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Pending</option>
          <option value="all">All</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
        </select>
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
          {invites.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {invites.map((invite) => (
                <InviteCard key={invite.id} invite={invite} onRespond={handleRespond} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-base-content/60">
                {statusFilter ? "No invitations found" : "No pending invitations"}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InvitationsPage;
