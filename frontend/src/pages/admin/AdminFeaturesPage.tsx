import { useEffect, useState, useCallback } from "react";
import { AdminFeature } from "../../models/admin";
import APIManager from "../../network/api";
import toast from "react-hot-toast";

function AdminFeaturesPage() {
  const [features, setFeatures] = useState<AdminFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<AdminFeature | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "", isDefault: false });
  const [saving, setSaving] = useState(false);

  const loadFeatures = useCallback(async () => {
    try {
      const data = await APIManager.getAdminFeatures();
      setFeatures(data);
    } catch {
      toast.error("Failed to load features");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  function openCreate() {
    setEditingFeature(null);
    setForm({ code: "", name: "", description: "", isDefault: false });
    setModalOpen(true);
  }

  function openEdit(feature: AdminFeature) {
    setEditingFeature(feature);
    setForm({
      code: feature.code,
      name: feature.name,
      description: feature.description || "",
      isDefault: feature.isDefault,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingFeature) {
        await APIManager.updateAdminFeature(editingFeature.id, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          isDefault: form.isDefault,
        });
        toast.success("Feature updated");
      } else {
        if (!form.code.trim()) return;
        await APIManager.createAdminFeature({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          isDefault: form.isDefault,
        });
        toast.success("Feature created");
      }
      setModalOpen(false);
      loadFeatures();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save feature");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Features</h1>
        <button className="btn btn-primary" onClick={openCreate}>Add Feature</button>
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
                  <th>Code</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="text-center">Default</th>
                  <th className="text-right">Communities</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {features.length > 0 ? (
                  features.map((feature) => (
                    <tr key={feature.id}>
                      <td><code className="text-sm">{feature.code}</code></td>
                      <td className="font-medium">{feature.name}</td>
                      <td className="text-sm text-base-content/70 max-w-xs truncate">{feature.description || "-"}</td>
                      <td className="text-center">
                        {feature.isDefault ? (
                          <span className="badge badge-success badge-sm">Yes</span>
                        ) : (
                          <span className="badge badge-ghost badge-sm">No</span>
                        )}
                      </td>
                      <td className="text-right">{feature.communityCount ?? 0}</td>
                      <td className="text-right">
                        <button className="btn btn-ghost btn-xs" onClick={() => openEdit(feature)}>Edit</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center text-base-content/50">No features found</td>
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
            <h3 className="font-bold text-lg">{editingFeature ? "Edit Feature" : "Create Feature"}</h3>

            {!editingFeature && (
              <div className="form-control mt-4">
                <label className="label"><span className="label-text">Code</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="FEATURE_CODE"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
            )}

            <div className="form-control mt-4">
              <label className="label"><span className="label-text">Name</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="form-control mt-4">
              <label className="label"><span className="label-text">Description</span></label>
              <textarea
                className="textarea textarea-bordered"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="form-control mt-4">
              <label className="label cursor-pointer">
                <span className="label-text">Default for new communities</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
              </label>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !form.name.trim() || (!editingFeature && !form.code.trim())}
              >
                {saving ? <span className="loading loading-spinner loading-sm"></span> : "Save"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={() => setModalOpen(false)} />
        </div>
      )}
    </div>
  );
}

export default AdminFeaturesPage;
