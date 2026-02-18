import { useEffect, useState, useCallback } from "react";
import { AdminUnit } from "../../models/admin";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import toast from "react-hot-toast";

const CATEGORIES = ["WEIGHT", "VOLUME", "SPOON", "COUNT", "QUALITATIVE"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  WEIGHT: "Weight",
  VOLUME: "Volume",
  SPOON: "Spoon",
  COUNT: "Count",
  QUALITATIVE: "Qualitative",
};

function AdminUnitsPage() {
  const [units, setUnits] = useState<AdminUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminUnit | null>(null);
  const [formName, setFormName] = useState("");
  const [formAbbreviation, setFormAbbreviation] = useState("");
  const [formCategory, setFormCategory] = useState<string>("WEIGHT");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const loadUnits = useCallback(async () => {
    try {
      const data = await APIManager.getAdminUnits(search || undefined, filterCategory || undefined);
      setUnits(data);
    } catch {
      toast.error("Failed to load units");
    } finally {
      setIsLoading(false);
    }
  }, [search, filterCategory]);

  useEffect(() => {
    setIsLoading(true);
    loadUnits();
  }, [loadUnits]);

  function openCreate() {
    setEditingItem(null);
    setFormName("");
    setFormAbbreviation("");
    setFormCategory("WEIGHT");
    setFormSortOrder(0);
    setModalOpen(true);
  }

  function openEdit(item: AdminUnit) {
    setEditingItem(item);
    setFormName(item.name);
    setFormAbbreviation(item.abbreviation);
    setFormCategory(item.category);
    setFormSortOrder(item.sortOrder);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formAbbreviation.trim()) return;
    setSaving(true);
    try {
      if (editingItem) {
        await APIManager.updateAdminUnit(editingItem.id, {
          name: formName.trim(),
          abbreviation: formAbbreviation.trim(),
          category: formCategory,
          sortOrder: formSortOrder,
        });
        toast.success("Unit updated");
      } else {
        await APIManager.createAdminUnit({
          name: formName.trim(),
          abbreviation: formAbbreviation.trim(),
          category: formCategory,
          sortOrder: formSortOrder,
        });
        toast.success("Unit created");
      }
      setModalOpen(false);
      loadUnits();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save unit");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: AdminUnit) {
    const confirmed = await confirm({
      title: "Delete Unit",
      message: `Delete unit "${item.name}" (${item.abbreviation})? This is only possible if the unit is not in use.`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    try {
      await APIManager.deleteAdminUnit(item.id);
      toast.success("Unit deleted");
      loadUnits();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete unit");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Units</h1>
        <button className="btn btn-primary" onClick={openCreate}>Add Unit</button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search units..."
          className="input input-bordered w-full max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select select-bordered"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
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
                  <th>Abbreviation</th>
                  <th>Category</th>
                  <th className="text-right">Order</th>
                  <th className="text-right">Usage</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.length > 0 ? (
                  units.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.name}</td>
                      <td>{item.abbreviation}</td>
                      <td>
                        <span className="badge badge-outline badge-sm">{CATEGORY_LABELS[item.category]}</span>
                      </td>
                      <td className="text-right">{item.sortOrder}</td>
                      <td className="text-right">{item.usageCount}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button className="btn btn-ghost btn-xs" onClick={() => openEdit(item)}>Edit</button>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(item)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center text-base-content/50">No units found</td>
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
            <h3 className="font-bold text-lg">{editingItem ? "Edit Unit" : "Create Unit"}</h3>
            <div className="form-control mt-4">
              <label className="label"><span className="label-text">Name</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="gramme"
              />
            </div>
            <div className="form-control mt-2">
              <label className="label"><span className="label-text">Abbreviation</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={formAbbreviation}
                onChange={(e) => setFormAbbreviation(e.target.value)}
                placeholder="g"
              />
            </div>
            <div className="form-control mt-2">
              <label className="label"><span className="label-text">Category</span></label>
              <select
                className="select select-bordered"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>
            <div className="form-control mt-2">
              <label className="label"><span className="label-text">Sort Order</span></label>
              <input
                type="number"
                className="input input-bordered"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formAbbreviation.trim()}
              >
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
}

export default AdminUnitsPage;
