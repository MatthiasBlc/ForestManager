import { useEffect, useState, useCallback } from "react";
import { AdminActivityLog } from "../../models/admin";
import APIManager from "../../network/api";
import toast from "react-hot-toast";
import { format } from "date-fns";

const PAGE_SIZE = 20;

function AdminActivityPage() {
  const [activities, setActivities] = useState<AdminActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const loadActivity = useCallback(async () => {
    try {
      const data = await APIManager.getAdminActivity({
        type: typeFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setActivities(data.activities);
      setTotal(data.pagination.total);
    } catch {
      toast.error("Failed to load activity");
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, offset]);

  useEffect(() => {
    setIsLoading(true);
    loadActivity();
  }, [loadActivity]);

  function handleFilterChange(type: string) {
    setTypeFilter(type);
    setOffset(0);
  }

  const hasNext = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  function formatMetadata(metadata: Record<string, unknown>): string {
    if (!metadata || Object.keys(metadata).length === 0) return "-";
    return Object.entries(metadata)
      .filter(([key]) => key !== "ip")
      .map(([key, val]) => `${key}: ${val}`)
      .join(", ") || "-";
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Activity Log</h1>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          className="select select-bordered w-full max-w-xs"
          value={typeFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
        >
          <option value="">All types</option>
          <option value="ADMIN_LOGIN">Login</option>
          <option value="ADMIN_LOGOUT">Logout</option>
          <option value="ADMIN_TOTP_SETUP">TOTP Setup</option>
          <option value="TAG_CREATED">Tag Created</option>
          <option value="TAG_UPDATED">Tag Updated</option>
          <option value="TAG_DELETED">Tag Deleted</option>
          <option value="TAG_MERGED">Tag Merged</option>
          <option value="INGREDIENT_CREATED">Ingredient Created</option>
          <option value="INGREDIENT_UPDATED">Ingredient Updated</option>
          <option value="INGREDIENT_DELETED">Ingredient Deleted</option>
          <option value="INGREDIENT_MERGED">Ingredient Merged</option>
          <option value="FEATURE_CREATED">Feature Created</option>
          <option value="FEATURE_UPDATED">Feature Updated</option>
          <option value="FEATURE_GRANTED">Feature Granted</option>
          <option value="FEATURE_REVOKED">Feature Revoked</option>
          <option value="COMMUNITY_UPDATED">Community Updated</option>
          <option value="COMMUNITY_DELETED">Community Deleted</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <>
          <div className="card bg-base-100 shadow">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.length > 0 ? (
                    activities.map((activity) => (
                      <tr key={activity.id}>
                        <td className="text-sm whitespace-nowrap">
                          {format(new Date(activity.createdAt), "MMM d, yyyy HH:mm")}
                        </td>
                        <td className="text-sm">{activity.admin.username}</td>
                        <td>
                          <span className="badge badge-outline badge-sm">{activity.type}</span>
                        </td>
                        <td className="text-sm text-base-content/70 max-w-xs truncate">
                          {formatMetadata(activity.metadata)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center text-base-content/50">No activity found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                className="btn btn-sm"
                disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </button>
              <span className="btn btn-sm btn-ghost no-animation">
                {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <button
                className="btn btn-sm"
                disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AdminActivityPage;
