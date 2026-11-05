import { useEffect, useState, useMemo } from "react";
import { FaSortUp, FaSortDown, FaSort } from "react-icons/fa";
import { AdminUnit } from "../../models/admin";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import DataContainer from "../../components/DataContainer";
import { useAsyncData } from "../../hooks/useAsyncData";
import toast from "react-hot-toast";
import { toastError } from "../../utils/toastError";

type UnitSortColumn = "name" | "abbreviation" | "category" | "sortOrder" | "usageCount";
type SortDirection = "asc" | "desc";

const CATEGORIES = ["WEIGHT", "VOLUME", "SPOON", "COUNT", "QUALITATIVE"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  WEIGHT: "Weight",
  VOLUME: "Volume",
  SPOON: "Spoon",
  COUNT: "Count",
  QUALITATIVE: "Qualitative",
};

function AdminUnitsPage() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminUnit | null>(null);
  const [formName, setFormName] = useState("");
  const [formAbbreviation, setFormAbbreviation] = useState("");
  const [formCategory, setFormCategory] = useState<string>("WEIGHT");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sortColumn, setSortColumn] = useState<UnitSortColumn>("category");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const { confirm, ConfirmDialog } = useConfirm();

  const {
    data: units,
    isLoading,
    error,
    refetch: loadUnits,
  } = useAsyncData<AdminUnit[]>(
    () => APIManager.getAdminUnits(search || undefined, filterCategory || undefined),
    [search, filterCategory]
  );

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // --- Sorting ---
  const handleSort = (column: UnitSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedUnits = useMemo(() => {
    const sorted = [...(units ?? [])].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortColumn) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "abbreviation":
          aVal = a.abbreviation.toLowerCase();
          bVal = b.abbreviation.toLowerCase();
          break;
        case "category":
          aVal = a.category;
          bVal = b.category;
          break;
        case "sortOrder":
          aVal = a.sortOrder;
          bVal = b.sortOrder;
          break;
        case "usageCount":
          aVal = a.usageCount;
          bVal = b.usageCount;
          break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [units, sortColumn, sortDirection]);

  const SortIcon = ({ column }: { column: UnitSortColumn }) => {
    if (sortColumn !== column) return <FaSort className="ml-1 opacity-30" />;
    return sortDirection === "asc" ? (
      <FaSortUp className="ml-1" />
    ) : (
      <FaSortDown className="ml-1" />
    );
  };

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
      toastError(err, "Failed to save unit");
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
      toastError(err, "Failed to delete unit");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Units</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          Add Unit
        </button>
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
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <DataContainer isLoading={isLoading && !units} error={null}>
        <div className="card bg-base-100 shadow">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                    <span className="flex items-center">
                      Name
                      <SortIcon column="name" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("abbreviation")}
                  >
                    <span className="flex items-center">
                      Abbreviation
                      <SortIcon column="abbreviation" />
                    </span>
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort("category")}>
                    <span className="flex items-center">
                      Category
                      <SortIcon column="category" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("sortOrder")}
                  >
                    <span className="flex items-center justify-end">
                      Order
                      <SortIcon column="sortOrder" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("usageCount")}
                  >
                    <span className="flex items-center justify-end">
                      Usage
                      <SortIcon column="usageCount" />
                    </span>
                  </th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUnits.length > 0 ? (
                  sortedUnits.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.name}</td>
                      <td>{item.abbreviation}</td>
                      <td>
                        <span className="badge badge-outline badge-sm">
                          {CATEGORY_LABELS[item.category]}
                        </span>
                      </td>
                      <td className="text-right">{item.sortOrder}</td>
                      <td className="text-right">{item.usageCount}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button className="btn btn-ghost btn-xs" onClick={() => openEdit(item)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => handleDelete(item)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center text-base-content/50">
                      No units found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DataContainer>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{editingItem ? "Edit Unit" : "Create Unit"}</h3>
            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="gramme"
              />
            </div>
            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text">Abbreviation</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formAbbreviation}
                onChange={(e) => setFormAbbreviation(e.target.value)}
                placeholder="g"
              />
            </div>
            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text">Category</span>
              </label>
              <select
                className="select select-bordered"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text">Sort Order</span>
              </label>
              <input
                type="number"
                className="input input-bordered"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formAbbreviation.trim()}
              >
                {saving ? <span className="loading loading-spinner loading-sm" /> : "Save"}
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
