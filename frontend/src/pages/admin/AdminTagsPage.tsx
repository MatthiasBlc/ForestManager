import { useEffect, useState, useCallback } from "react";
import { AdminTag } from "../../models/admin";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import toast from "react-hot-toast";

function AdminTagsPage() {
  const [tags, setTags] = useState<AdminTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<AdminTag | null>(null);
  const [tagName, setTagName] = useState("");
  const [saving, setSaving] = useState(false);
  const [mergeSource, setMergeSource] = useState<AdminTag | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const loadTags = useCallback(async () => {
    try {
      const data = await APIManager.getAdminTags(search || undefined);
      setTags(data);
    } catch {
      toast.error("Failed to load tags");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    setIsLoading(true);
    loadTags();
  }, [loadTags]);

  function openCreate() {
    setEditingTag(null);
    setTagName("");
    setModalOpen(true);
  }

  function openEdit(tag: AdminTag) {
    setEditingTag(tag);
    setTagName(tag.name);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!tagName.trim()) return;
    setSaving(true);
    try {
      if (editingTag) {
        await APIManager.updateAdminTag(editingTag.id, tagName.trim());
        toast.success("Tag updated");
      } else {
        await APIManager.createAdminTag(tagName.trim());
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

  async function handleDelete(tag: AdminTag) {
    const confirmed = await confirm({
      title: "Delete Tag",
      message: `Delete tag "${tag.name}"? This will remove it from ${tag.recipeCount} recipe(s).`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    try {
      await APIManager.deleteAdminTag(tag.id);
      toast.success("Tag deleted");
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete tag");
    }
  }

  function openMerge(tag: AdminTag) {
    setMergeSource(tag);
    setMergeModalOpen(true);
  }

  async function handleMerge(target: AdminTag) {
    if (!mergeSource) return;
    try {
      await APIManager.mergeAdminTags(mergeSource.id, target.id);
      toast.success(`Merged "${mergeSource.name}" into "${target.name}"`);
      setMergeModalOpen(false);
      setMergeSource(null);
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to merge tags");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Tags</h1>
        <button className="btn btn-primary" onClick={openCreate}>Add Tag</button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search tags..."
          className="input input-bordered w-full max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                  <th className="text-right">Recipes</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tags.length > 0 ? (
                  tags.map((tag) => (
                    <tr key={tag.id}>
                      <td className="font-medium">{tag.name}</td>
                      <td className="text-right">{tag.recipeCount}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button className="btn btn-ghost btn-xs" onClick={() => openEdit(tag)}>Edit</button>
                          <button className="btn btn-ghost btn-xs" onClick={() => openMerge(tag)}>Merge</button>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(tag)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center text-base-content/50">No tags found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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

      {/* Merge Modal */}
      {mergeModalOpen && mergeSource && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Merge &quot;{mergeSource.name}&quot; into...</h3>
            <p className="text-sm text-base-content/70 mt-2">Select the target tag. All recipes will be moved to the target.</p>
            <div className="mt-4 max-h-60 overflow-y-auto">
              {tags.filter((t) => t.id !== mergeSource.id).map((tag) => (
                <button
                  key={tag.id}
                  className="btn btn-ghost btn-sm w-full justify-start mb-1"
                  onClick={() => handleMerge(tag)}
                >
                  {tag.name} ({tag.recipeCount} recipes)
                </button>
              ))}
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setMergeModalOpen(false); setMergeSource(null); }}>Cancel</button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={() => { setMergeModalOpen(false); setMergeSource(null); }} />
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}

export default AdminTagsPage;
