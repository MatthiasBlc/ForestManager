import { useEffect, useState, useCallback } from "react";
import { FaCheck, FaTimes, FaEdit, FaTrash } from "react-icons/fa";
import toast from "react-hot-toast";
import { CommunityTag } from "../../models/tag";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import TagBadge from "../recipes/TagBadge";

interface CommunityTagsListProps {
  communityId: string;
}

type StatusFilter = "ALL" | "APPROVED" | "PENDING";

const CommunityTagsList = ({ communityId }: CommunityTagsListProps) => {
  const [tags, setTags] = useState<CommunityTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<CommunityTag | null>(null);
  const [tagName, setTagName] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const loadTags = useCallback(async () => {
    try {
      const params: { status?: string; search?: string } = {};
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (search) params.search = search;
      const result = await APIManager.getCommunityTags(communityId, params);
      setTags(result.data);
    } catch {
      toast.error("Failed to load tags");
    } finally {
      setIsLoading(false);
    }
  }, [communityId, statusFilter, search]);

  useEffect(() => {
    setIsLoading(true);
    loadTags();
  }, [loadTags]);

  function openCreate() {
    setEditingTag(null);
    setTagName("");
    setModalOpen(true);
  }

  function openEdit(tag: CommunityTag) {
    setEditingTag(tag);
    setTagName(tag.name);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!tagName.trim()) return;
    setSaving(true);
    try {
      if (editingTag) {
        await APIManager.updateCommunityTag(communityId, editingTag.id, tagName.trim());
        toast.success("Tag updated");
      } else {
        await APIManager.createCommunityTag(communityId, tagName.trim());
        toast.success("Tag created");
      }
      setModalOpen(false);
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tag");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tag: CommunityTag) {
    const confirmed = await confirm({
      title: "Delete Tag",
      message: `Delete tag "${tag.name}"? This will remove it from ${tag.recipeCount} recipe(s).`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    try {
      setActionLoading(tag.id);
      await APIManager.deleteCommunityTag(communityId, tag.id);
      toast.success("Tag deleted");
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete tag");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApprove(tag: CommunityTag) {
    try {
      setActionLoading(tag.id);
      await APIManager.approveCommunityTag(communityId, tag.id);
      toast.success("Tag approved");
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve tag");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(tag: CommunityTag) {
    const confirmed = await confirm({
      title: "Reject Tag",
      message: `Reject tag "${tag.name}"? It will be permanently removed.`,
      confirmLabel: "Reject",
      confirmClass: "btn btn-error",
    });
    if (!confirmed) return;

    try {
      setActionLoading(tag.id);
      await APIManager.rejectCommunityTag(communityId, tag.id);
      toast.success("Tag rejected");
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject tag");
    } finally {
      setActionLoading(null);
    }
  }

  const filterButtons: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "ALL" },
    { label: "Approved", value: "APPROVED" },
    { label: "Pending", value: "PENDING" },
  ];

  return (
    <div>
      {/* Status filter */}
      <div className="flex gap-1 mb-3">
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            className={`btn btn-xs ${statusFilter === btn.value ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setStatusFilter(btn.value)}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search tags..."
          className="input input-bordered input-sm flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          Add Tag
        </button>
      </div>

      {/* Tags list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      ) : tags.length === 0 ? (
        <p className="text-center text-base-content/50 py-4">No tags found</p>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => {
            const isLoading = actionLoading === tag.id;
            return (
              <div
                key={tag.id}
                className="flex items-center justify-between p-2 rounded-lg bg-base-200/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TagBadge
                    tag={{ id: tag.id, name: tag.name, scope: tag.scope, status: tag.status }}
                  />
                  <span className="text-xs text-base-content/50">
                    {tag.recipeCount} recipe{tag.recipeCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {tag.status === "PENDING" ? (
                    <>
                      {tag.createdBy && (
                        <span className="text-xs text-base-content/50 mr-1">
                          by {tag.createdBy.username}
                        </span>
                      )}
                      <button
                        className="btn btn-ghost btn-xs text-success"
                        onClick={() => handleApprove(tag)}
                        disabled={isLoading}
                        title="Approve"
                        aria-label="Approve"
                      >
                        {isLoading ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <FaCheck className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleReject(tag)}
                        disabled={isLoading}
                        title="Reject"
                        aria-label="Reject"
                      >
                        <FaTimes className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => openEdit(tag)}
                        disabled={isLoading}
                        title="Edit"
                        aria-label="Edit"
                      >
                        <FaEdit className="w-3 h-3" />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleDelete(tag)}
                        disabled={isLoading}
                        title="Delete"
                        aria-label="Delete"
                      >
                        <FaTrash className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{editingTag ? "Edit Tag" : "Create Tag"}</h3>
            <div className="form-control mt-4">
              <label className="label"><span className="label-text">Name</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !tagName.trim()}>
                {saving ? <span className="loading loading-spinner loading-sm"></span> : "Save"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={() => setModalOpen(false)} />
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
};

export default CommunityTagsList;
