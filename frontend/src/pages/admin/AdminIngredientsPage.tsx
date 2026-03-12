import { useEffect, useState, useMemo } from "react";
import { FaSortUp, FaSortDown, FaSort } from "react-icons/fa";
import { AdminIngredient, AdminUnit } from "../../models/admin";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import { useAsyncData } from "../../hooks/useAsyncData";
import toast from "react-hot-toast";

type StatusFilter = "" | "APPROVED" | "PENDING";
type SortColumn = "name" | "status" | "defaultUnit" | "popularUnit" | "createdBy" | "recipeCount";
type SortDirection = "asc" | "desc";

function AdminIngredientsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminIngredient | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemDefaultUnitId, setItemDefaultUnitId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Merge modal
  const [mergeSource, setMergeSource] = useState<AdminIngredient | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");

  // Approve with rename modal
  const [approveItem, setApproveItem] = useState<AdminIngredient | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveNewName, setApproveNewName] = useState("");

  // Reject modal
  const [rejectItem, setRejectItem] = useState<AdminIngredient | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { confirm, ConfirmDialog } = useConfirm();

  const {
    data: ingredients,
    isLoading,
    error,
    refetch: loadIngredients,
  } = useAsyncData<AdminIngredient[]>(
    () => APIManager.getAdminIngredients(search || undefined, statusFilter || undefined),
    [search, statusFilter]
  );

  const { data: units } = useAsyncData<AdminUnit[]>(() => APIManager.getAdminUnits(), []);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // --- Sorting ---
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedIngredients = useMemo(() => {
    const sorted = [...(ingredients ?? [])].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortColumn) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "defaultUnit":
          aVal = a.defaultUnit?.abbreviation?.toLowerCase() ?? "";
          bVal = b.defaultUnit?.abbreviation?.toLowerCase() ?? "";
          break;
        case "popularUnit":
          aVal = a.popularUnit?.useCount ?? 0;
          bVal = b.popularUnit?.useCount ?? 0;
          break;
        case "createdBy":
          aVal = a.createdBy?.username?.toLowerCase() ?? "";
          bVal = b.createdBy?.username?.toLowerCase() ?? "";
          break;
        case "recipeCount":
          aVal = a.recipeCount;
          bVal = b.recipeCount;
          break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [ingredients, sortColumn, sortDirection]);

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <FaSort className="ml-1 opacity-30" />;
    return sortDirection === "asc" ? (
      <FaSortUp className="ml-1" />
    ) : (
      <FaSortDown className="ml-1" />
    );
  };

  // --- Create / Edit ---
  function openCreate() {
    setEditingItem(null);
    setItemName("");
    setItemDefaultUnitId("");
    setModalOpen(true);
  }

  function openEdit(item: AdminIngredient) {
    setEditingItem(item);
    setItemName(item.name);
    setItemDefaultUnitId(item.defaultUnit?.id ?? "");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!itemName.trim()) return;
    setSaving(true);
    try {
      if (editingItem) {
        await APIManager.updateAdminIngredient(editingItem.id, {
          name: itemName.trim(),
          defaultUnitId: itemDefaultUnitId || null,
        });
        toast.success("Ingredient updated");
      } else {
        await APIManager.createAdminIngredient(itemName.trim(), itemDefaultUnitId || undefined);
        toast.success("Ingredient created");
      }
      setModalOpen(false);
      loadIngredients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save ingredient");
    } finally {
      setSaving(false);
    }
  }

  // --- Delete ---
  async function handleDelete(item: AdminIngredient) {
    const confirmed = await confirm({
      title: "Delete Ingredient",
      message: `Delete ingredient "${item.name}"? This will remove it from ${item.recipeCount} recipe(s).`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    try {
      await APIManager.deleteAdminIngredient(item.id);
      toast.success("Ingredient deleted");
      loadIngredients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete ingredient");
    }
  }

  // --- Merge ---
  function openMerge(item: AdminIngredient) {
    setMergeSource(item);
    setMergeSearch("");
    setMergeModalOpen(true);
  }

  async function handleMerge(target: AdminIngredient) {
    if (!mergeSource) return;
    try {
      await APIManager.mergeAdminIngredients(mergeSource.id, target.id);
      toast.success(`Merged "${mergeSource.name}" into "${target.name}"`);
      setMergeModalOpen(false);
      setMergeSource(null);
      loadIngredients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to merge ingredients");
    }
  }

  // --- Approve ---
  async function handleApproveSimple(item: AdminIngredient) {
    try {
      await APIManager.approveAdminIngredient(item.id);
      toast.success(`Ingredient "${item.name}" approved`);
      loadIngredients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve ingredient");
    }
  }

  function openApproveWithRename(item: AdminIngredient) {
    setApproveItem(item);
    setApproveNewName(item.name);
    setApproveModalOpen(true);
  }

  async function handleApproveWithRename() {
    if (!approveItem) return;
    setSaving(true);
    try {
      const newName =
        approveNewName.trim() !== approveItem.name ? approveNewName.trim() : undefined;
      await APIManager.approveAdminIngredient(approveItem.id, newName);
      toast.success(
        newName ? `Approved as "${newName}"` : `Ingredient "${approveItem.name}" approved`
      );
      setApproveModalOpen(false);
      setApproveItem(null);
      loadIngredients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve ingredient");
    } finally {
      setSaving(false);
    }
  }

  // --- Reject ---
  function openReject(item: AdminIngredient) {
    setRejectItem(item);
    setRejectReason("");
    setRejectModalOpen(true);
  }

  async function handleReject() {
    if (!rejectItem || !rejectReason.trim()) return;
    setSaving(true);
    try {
      await APIManager.rejectAdminIngredient(rejectItem.id, rejectReason.trim());
      toast.success(`Ingredient "${rejectItem.name}" rejected`);
      setRejectModalOpen(false);
      setRejectItem(null);
      loadIngredients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject ingredient");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Ingredients</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          Add Ingredient
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search ingredients..."
          className="input input-bordered w-full max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select select-bordered"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {/* Table */}
      {isLoading && !ingredients ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
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
                  <th className="cursor-pointer select-none" onClick={() => handleSort("status")}>
                    <span className="flex items-center">
                      Status
                      <SortIcon column="status" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("defaultUnit")}
                  >
                    <span className="flex items-center">
                      Default Unit
                      <SortIcon column="defaultUnit" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("popularUnit")}
                  >
                    <span className="flex items-center">
                      Popular Unit
                      <SortIcon column="popularUnit" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("createdBy")}
                  >
                    <span className="flex items-center">
                      Created By
                      <SortIcon column="createdBy" />
                    </span>
                  </th>
                  <th
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("recipeCount")}
                  >
                    <span className="flex items-center justify-end">
                      Recipes
                      <SortIcon column="recipeCount" />
                    </span>
                  </th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedIngredients.length > 0 ? (
                  sortedIngredients.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.name}</td>
                      <td>
                        {item.status === "PENDING" ? (
                          <span className="badge badge-warning badge-sm">Pending</span>
                        ) : (
                          <span className="badge badge-success badge-sm">Approved</span>
                        )}
                      </td>
                      <td>
                        {item.defaultUnit ? (
                          <span className="text-sm">{item.defaultUnit.abbreviation}</span>
                        ) : (
                          <span className="text-base-content/30">-</span>
                        )}
                      </td>
                      <td>
                        {item.popularUnit ? (
                          <span className="text-sm text-base-content/70">
                            {item.popularUnit.abbreviation}
                            <span className="text-xs ml-1">({item.popularUnit.useCount})</span>
                          </span>
                        ) : (
                          <span className="text-base-content/30">-</span>
                        )}
                      </td>
                      <td>
                        {item.createdBy ? (
                          <span className="text-sm">{item.createdBy.username}</span>
                        ) : (
                          <span className="text-base-content/30">admin</span>
                        )}
                      </td>
                      <td className="text-right">{item.recipeCount}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {item.status === "PENDING" && (
                            <>
                              <button
                                className="btn btn-success btn-xs"
                                onClick={() => handleApproveSimple(item)}
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => openApproveWithRename(item)}
                              >
                                Rename
                              </button>
                              <button
                                className="btn btn-error btn-xs"
                                onClick={() => openReject(item)}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button className="btn btn-ghost btn-xs" onClick={() => openEdit(item)}>
                            Edit
                          </button>
                          <button className="btn btn-ghost btn-xs" onClick={() => openMerge(item)}>
                            Merge
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
                    <td colSpan={7} className="text-center text-base-content/50">
                      No ingredients found
                    </td>
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
            <h3 className="font-bold text-lg">
              {editingItem ? "Edit Ingredient" : "Create Ingredient"}
            </h3>
            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text">Default Unit</span>
              </label>
              <select
                className="select select-bordered"
                value={itemDefaultUnitId}
                onChange={(e) => setItemDefaultUnitId(e.target.value)}
              >
                <option value="">None</option>
                {(units ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.abbreviation})
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !itemName.trim()}
              >
                {saving ? <span className="loading loading-spinner loading-sm" /> : "Save"}
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
            <p className="text-sm text-base-content/70 mt-2">
              Select the target ingredient. All recipes will be moved to the target.
            </p>
            <input
              type="text"
              placeholder="Search target ingredient..."
              className="input input-bordered input-sm w-full mt-3"
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
              autoFocus
            />
            <div className="mt-3 max-h-60 overflow-y-auto">
              {(ingredients ?? [])
                .filter(
                  (i) =>
                    i.id !== mergeSource.id &&
                    i.name.toLowerCase().includes(mergeSearch.toLowerCase())
                )
                .map((item) => (
                  <button
                    key={item.id}
                    className="btn btn-ghost btn-sm w-full justify-start mb-1"
                    onClick={() => handleMerge(item)}
                  >
                    {item.name} ({item.recipeCount} recipes)
                  </button>
                ))}
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setMergeModalOpen(false);
                  setMergeSource(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop bg-black/50"
            onClick={() => {
              setMergeModalOpen(false);
              setMergeSource(null);
            }}
          />
        </div>
      )}

      {/* Approve + Rename Modal */}
      {approveModalOpen && approveItem && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Approve &amp; Rename</h3>
            <p className="text-sm text-base-content/70 mt-2">
              Approve ingredient &quot;{approveItem.name}&quot;. Optionally change the name.
            </p>
            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={approveNewName}
                onChange={(e) => setApproveNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApproveWithRename()}
              />
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setApproveModalOpen(false);
                  setApproveItem(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={handleApproveWithRename}
                disabled={saving || !approveNewName.trim()}
              >
                {saving ? <span className="loading loading-spinner loading-sm" /> : "Approve"}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop bg-black/50"
            onClick={() => {
              setApproveModalOpen(false);
              setApproveItem(null);
            }}
          />
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && rejectItem && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Reject Ingredient</h3>
            <p className="text-sm text-base-content/70 mt-2">
              Reject ingredient &quot;{rejectItem.name}&quot;. This will permanently delete it and
              remove it from all recipes.
            </p>
            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">Reason (required)</span>
              </label>
              <textarea
                className="textarea textarea-bordered"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this ingredient is rejected..."
                rows={3}
              />
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectItem(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={handleReject}
                disabled={saving || !rejectReason.trim()}
              >
                {saving ? <span className="loading loading-spinner loading-sm" /> : "Reject"}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop bg-black/50"
            onClick={() => {
              setRejectModalOpen(false);
              setRejectItem(null);
            }}
          />
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}

export default AdminIngredientsPage;
