import { useEffect, useState, useCallback } from "react";
import { AdminCommunity, AdminCommunityDetail, AdminFeature } from "../../models/admin";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import toast from "react-hot-toast";
import { format } from "date-fns";

function AdminCommunitiesPage() {
  const [communities, setCommunities] = useState<AdminCommunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<AdminCommunityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [allFeatures, setAllFeatures] = useState<AdminFeature[]>([]);
  const { confirm, ConfirmDialog } = useConfirm();

  const loadCommunities = useCallback(async () => {
    try {
      const data = await APIManager.getAdminCommunities(search || undefined, showDeleted);
      setCommunities(data);
    } catch {
      toast.error("Failed to load communities");
    } finally {
      setIsLoading(false);
    }
  }, [search, showDeleted]);

  useEffect(() => {
    setIsLoading(true);
    loadCommunities();
  }, [loadCommunities]);

  async function openDetail(communityId: string) {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const [communityDetail, features] = await Promise.all([
        APIManager.getAdminCommunity(communityId),
        APIManager.getAdminFeatures(),
      ]);
      setDetail(communityDetail);
      setAllFeatures(features);
    } catch {
      toast.error("Failed to load community details");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDelete(community: AdminCommunity) {
    const confirmed = await confirm({
      title: "Delete Community",
      message: `Delete community "${community.name}"? This will soft-delete it.`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    try {
      await APIManager.deleteAdminCommunity(community.id);
      toast.success("Community deleted");
      loadCommunities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete community");
    }
  }

  async function handleGrantFeature(featureId: string) {
    if (!detail) return;
    try {
      await APIManager.grantFeature(detail.id, featureId);
      toast.success("Feature granted");
      const updated = await APIManager.getAdminCommunity(detail.id);
      setDetail(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to grant feature");
    }
  }

  async function handleRevokeFeature(featureId: string) {
    if (!detail) return;
    try {
      await APIManager.revokeFeature(detail.id, featureId);
      toast.success("Feature revoked");
      const updated = await APIManager.getAdminCommunity(detail.id);
      setDetail(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke feature");
    }
  }

  // Features available to grant (not already active on community)
  const grantableFeatures = allFeatures.filter(
    (f) => !detail?.features.some((cf) => cf.id === f.id && !cf.revokedAt)
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Communities</h1>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4 items-center mb-4">
        <input
          type="text"
          placeholder="Search communities..."
          className="input input-bordered w-full max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="label cursor-pointer gap-2">
          <span className="label-text">Show deleted</span>
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
          />
        </label>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="card bg-base-100 shadow">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="text-right">Members</th>
                  <th className="text-right">Recipes</th>
                  <th>Features</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {communities.length > 0 ? (
                  communities.map((community) => (
                    <tr
                      key={community.id}
                      className={`cursor-pointer hover ${community.deletedAt ? "opacity-50" : ""}`}
                      onClick={() => openDetail(community.id)}
                    >
                      <td className="font-medium">
                        {community.name}
                        {community.deletedAt && <span className="badge badge-error badge-xs ml-2">Deleted</span>}
                      </td>
                      <td className="text-right">{community.memberCount}</td>
                      <td className="text-right">{community.recipeCount}</td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {community.features.map((f) => (
                            <span key={f} className="badge badge-outline badge-xs">{f}</span>
                          ))}
                        </div>
                      </td>
                      <td className="text-sm">{format(new Date(community.createdAt), "MMM d, yyyy")}</td>
                      <td className="text-right">
                        {!community.deletedAt && (
                          <button
                            className="btn btn-ghost btn-xs text-error"
                            onClick={(e) => { e.stopPropagation(); handleDelete(community); }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center text-base-content/50">No communities found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            {detailLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : detail ? (
              <>
                <h3 className="font-bold text-lg mb-4">{detail.name}</h3>

                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div><span className="text-base-content/70">Visibility:</span> {detail.visibility}</div>
                  <div><span className="text-base-content/70">Recipes:</span> {detail.recipeCount}</div>
                  <div><span className="text-base-content/70">Pending Invites:</span> {detail.pendingInvites}</div>
                  <div><span className="text-base-content/70">Created:</span> {format(new Date(detail.createdAt), "MMM d, yyyy")}</div>
                </div>

                {/* Members */}
                <h4 className="font-semibold mb-2">Members ({detail.members.length})</h4>
                <div className="overflow-x-auto mb-6">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.members.map((m) => (
                        <tr key={m.id}>
                          <td>{m.username}</td>
                          <td>{m.email}</td>
                          <td><span className="badge badge-sm">{m.role}</span></td>
                          <td>{format(new Date(m.joinedAt), "MMM d, yyyy")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Features */}
                <h4 className="font-semibold mb-2">Features</h4>
                <div className="mb-4">
                  {detail.features.filter((f) => !f.revokedAt).map((f) => (
                    <div key={f.id} className="flex items-center justify-between py-1">
                      <div>
                        <span className="font-medium">{f.code}</span>
                        <span className="text-sm text-base-content/70 ml-2">{f.name}</span>
                      </div>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleRevokeFeature(f.id)}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>

                {grantableFeatures.length > 0 && (
                  <div className="dropdown dropdown-top">
                    <label tabIndex={0} className="btn btn-sm btn-outline">Grant Feature</label>
                    <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 z-10">
                      {grantableFeatures.map((f) => (
                        <li key={f.id}>
                          <button onClick={() => handleGrantFeature(f.id)}>{f.code} - {f.name}</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : null}

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setDetailOpen(false); setDetail(null); }}>Close</button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={() => { setDetailOpen(false); setDetail(null); }} />
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}

export default AdminCommunitiesPage;
