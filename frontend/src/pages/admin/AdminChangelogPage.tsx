import { useState, useEffect } from "react";
import { AdminChangelogEntry } from "../../models/admin";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import DataContainer from "../../components/DataContainer";
import { useAsyncData } from "../../hooks/useAsyncData";
import toast from "react-hot-toast";

interface ChangelogFormData {
  version: string;
  title: string;
  publishedAt: string;
  features: string[];
  improvements: string[];
  fixes: string[];
}

function emptyForm(): ChangelogFormData {
  return {
    version: "",
    title: "",
    publishedAt: new Date().toISOString().slice(0, 16),
    features: [""],
    improvements: [""],
    fixes: [""],
  };
}

function entryToForm(entry: AdminChangelogEntry): ChangelogFormData {
  return {
    version: entry.version,
    title: entry.title,
    publishedAt: entry.publishedAt.slice(0, 16),
    features: entry.content.features.length > 0 ? entry.content.features.map((f) => f.text) : [""],
    improvements:
      entry.content.improvements.length > 0 ? entry.content.improvements.map((i) => i.text) : [""],
    fixes: entry.content.fixes.length > 0 ? entry.content.fixes.map((f) => f.text) : [""],
  };
}

function formToInput(form: ChangelogFormData) {
  return {
    version: form.version,
    title: form.title,
    publishedAt: new Date(form.publishedAt).toISOString(),
    content: {
      features: form.features.filter((t) => t.trim()).map((t) => ({ text: t.trim() })),
      improvements: form.improvements.filter((t) => t.trim()).map((t) => ({ text: t.trim() })),
      fixes: form.fixes.filter((t) => t.trim()).map((t) => ({ text: t.trim() })),
    },
  };
}

// --- Section editor for one category ---
function SectionEditor({
  label,
  colorClass,
  items,
  onChange,
}: {
  label: string;
  colorClass: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const updateItem = (idx: number, value: string) => {
    const next = [...items];
    next[idx] = value;
    onChange(next);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(items.filter((_, i) => i !== idx));
  };

  const addItem = () => onChange([...items, ""]);

  return (
    <div>
      <label className={`text-sm font-semibold ${colorClass}`}>{label}</label>
      <div className="space-y-2 mt-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              className="input input-bordered input-sm flex-1"
              value={item}
              onChange={(e) => updateItem(idx, e.target.value)}
              placeholder={`${label} item...`}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square text-error"
              onClick={() => removeItem(idx)}
            >
              x
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-ghost btn-xs mt-1" onClick={addItem}>
        + Add
      </button>
    </div>
  );
}

// --- Modal for create/edit ---
function ChangelogFormModal({
  editingEntry,
  onSave,
  onClose,
}: {
  editingEntry: AdminChangelogEntry | null;
  onSave: (data: ChangelogFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ChangelogFormData>(
    editingEntry ? entryToForm(editingEntry) : emptyForm()
  );
  const [saving, setSaving] = useState(false);

  const hasContent =
    form.features.some((t) => t.trim()) ||
    form.improvements.some((t) => t.trim()) ||
    form.fixes.some((t) => t.trim());

  const isValid = form.version.trim() && form.title.trim() && hasContent;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">
          {editingEntry ? "Edit Changelog Entry" : "New Changelog Entry"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Version + Title */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label label-text text-sm">Version (semver)</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="1.2.0"
                pattern="\d+\.\d+\.\d+"
              />
            </div>
            <div>
              <label className="label label-text text-sm">Publication date</label>
              <input
                type="datetime-local"
                className="input input-bordered input-sm w-full"
                value={form.publishedAt}
                onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label label-text text-sm">Title</label>
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="2 nouveautes et 1 correction"
              maxLength={200}
            />
          </div>

          {/* Content sections */}
          <div className="space-y-4 border-t border-base-300 pt-4">
            <SectionEditor
              label="Nouveautes"
              colorClass="text-success"
              items={form.features}
              onChange={(features) => setForm({ ...form, features })}
            />
            <SectionEditor
              label="Ameliorations"
              colorClass="text-info"
              items={form.improvements}
              onChange={(improvements) => setForm({ ...form, improvements })}
            />
            <SectionEditor
              label="Corrections"
              colorClass="text-error"
              items={form.fixes}
              onChange={(fixes) => setForm({ ...form, fixes })}
            />
          </div>

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || saving}>
              {saving ? <span className="loading loading-spinner loading-sm" /> : "Save"}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}

function AdminChangelogPage() {
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [editModal, setEditModal] = useState<AdminChangelogEntry | null | "create">(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useAsyncData<{ data: AdminChangelogEntry[] }>(
    () => APIManager.getAdminChangelog({ includeDeleted }),
    [includeDeleted]
  );

  const entries = response?.data ?? [];

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  async function handleSave(form: ChangelogFormData) {
    const input = formToInput(form);
    try {
      if (editModal && editModal !== "create") {
        await APIManager.updateAdminChangelog(editModal.id, input);
        toast.success("Entry updated");
      } else {
        await APIManager.createAdminChangelog(input);
        toast.success("Entry created");
      }
      setEditModal(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete(entry: AdminChangelogEntry) {
    const confirmed = await confirm({
      title: "Delete Changelog Entry",
      message: `Delete v${entry.version} "${entry.title}"? This is a soft delete.`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    try {
      await APIManager.deleteAdminChangelog(entry.id);
      toast.success("Entry deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Changelog</h1>
        <button className="btn btn-primary" onClick={() => setEditModal("create")}>
          New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4 items-center">
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
          />
          <span className="label-text">Show deleted</span>
        </label>
      </div>

      {/* Table */}
      <DataContainer isLoading={isLoading && !response} error={null}>
        <div className="card bg-base-100 shadow">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length > 0 ? (
                  entries.map((entry) => (
                    <tr key={entry.id} className={entry.deletedAt ? "opacity-50" : ""}>
                      <td>
                        <span className="badge badge-primary badge-sm font-mono">
                          v{entry.version}
                        </span>
                      </td>
                      <td className="font-medium">{entry.title}</td>
                      <td className="text-base-content/60">{formatDate(entry.publishedAt)}</td>
                      <td>
                        {entry.deletedAt ? (
                          <span className="badge badge-error badge-sm">Deleted</span>
                        ) : (
                          <span className="badge badge-success badge-sm">Active</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          {!entry.deletedAt && (
                            <>
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => setEditModal(entry)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-ghost btn-xs text-error"
                                onClick={() => handleDelete(entry)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center text-base-content/50">
                      No changelog entries
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DataContainer>

      {/* Modal */}
      {editModal && (
        <ChangelogFormModal
          editingEntry={editModal === "create" ? null : editModal}
          onSave={handleSave}
          onClose={() => setEditModal(null)}
        />
      )}

      {ConfirmDialog}
    </div>
  );
}

export default AdminChangelogPage;
