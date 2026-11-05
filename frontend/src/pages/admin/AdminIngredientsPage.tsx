import { useEffect, useState, useMemo } from "react";
import { FaSortUp, FaSortDown, FaSort } from "react-icons/fa";
import { AdminIngredient, AdminUnit } from "../../models/admin";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import DataContainer from "../../components/DataContainer";
import { useAsyncData } from "../../hooks/useAsyncData";
import IngredientEditModal from "../../components/admin/IngredientEditModal";
import IngredientMergeModal from "../../components/admin/IngredientMergeModal";
import IngredientApproveModal from "../../components/admin/IngredientApproveModal";
import IngredientRejectModal from "../../components/admin/IngredientRejectModal";
import toast from "react-hot-toast";
import { toastError } from "../../utils/toastError";

type StatusFilter = "" | "APPROVED" | "PENDING";
type SortColumn = "name" | "status" | "defaultUnit" | "popularUnit" | "createdBy" | "recipeCount";
type SortDirection = "asc" | "desc";

function AdminIngredientsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [editModalItem, setEditModalItem] = useState<AdminIngredient | null | "create">(null);
  const [mergeSource, setMergeSource] = useState<AdminIngredient | null>(null);
  const [approveItem, setApproveItem] = useState<AdminIngredient | null>(null);
  const [rejectItem, setRejectItem] = useState<AdminIngredient | null>(null);

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

  async function handleSave(name: string, defaultUnitId: string | null) {
    try {
      if (editModalItem && editModalItem !== "create") {
        await APIManager.updateAdminIngredient(editModalItem.id, { name, defaultUnitId });
        toast.success("Ingredient updated");
      } else {
        await APIManager.createAdminIngredient(name, defaultUnitId ?? undefined);
        toast.success("Ingredient created");
      }
      setEditModalItem(null);
      loadIngredients();
    } catch (err) {
      toastError(err, "Failed to save ingredient");
    }
  }

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
      toastError(err, "Failed to delete ingredient");
    }
  }

  async function handleMerge(target: AdminIngredient) {
    if (!mergeSource) return;
    try {
      await APIManager.mergeAdminIngredients(mergeSource.id, target.id);
      toast.success(`Merged "${mergeSource.name}" into "${target.name}"`);
      setMergeSource(null);
      loadIngredients();
    } catch (err) {
      toastError(err, "Failed to merge ingredients");
    }
  }

  async function handleApproveSimple(item: AdminIngredient) {
    try {
      await APIManager.approveAdminIngredient(item.id);
      toast.success(`Ingredient "${item.name}" approved`);
      loadIngredients();
    } catch (err) {
      toastError(err, "Failed to approve ingredient");
    }
  }

  async function handleApproveWithRename(newName?: string) {
    if (!approveItem) return;
    try {
      await APIManager.approveAdminIngredient(approveItem.id, newName);
      toast.success(
        newName ? `Approved as "${newName}"` : `Ingredient "${approveItem.name}" approved`
      );
      setApproveItem(null);
      loadIngredients();
    } catch (err) {
      toastError(err, "Failed to approve ingredient");
    }
  }

  async function handleReject(reason: string) {
    if (!rejectItem) return;
    try {
      await APIManager.rejectAdminIngredient(rejectItem.id, reason);
      toast.success(`Ingredient "${rejectItem.name}" rejected`);
      setRejectItem(null);
      loadIngredients();
    } catch (err) {
      toastError(err, "Failed to reject ingredient");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Ingredients</h1>
        <button className="btn btn-primary" onClick={() => setEditModalItem("create")}>
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
      <DataContainer isLoading={isLoading && !ingredients} error={null}>
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
                                onClick={() => setApproveItem(item)}
                              >
                                Rename
                              </button>
                              <button
                                className="btn btn-error btn-xs"
                                onClick={() => setRejectItem(item)}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => setEditModalItem(item)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => setMergeSource(item)}
                          >
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
      </DataContainer>

      {/* Modals */}
      {editModalItem && (
        <IngredientEditModal
          editingItem={editModalItem === "create" ? null : editModalItem}
          units={units ?? []}
          onSave={handleSave}
          onClose={() => setEditModalItem(null)}
        />
      )}

      {mergeSource && (
        <IngredientMergeModal
          source={mergeSource}
          ingredients={ingredients ?? []}
          onMerge={handleMerge}
          onClose={() => setMergeSource(null)}
        />
      )}

      {approveItem && (
        <IngredientApproveModal
          item={approveItem}
          onApprove={handleApproveWithRename}
          onClose={() => setApproveItem(null)}
        />
      )}

      {rejectItem && (
        <IngredientRejectModal
          item={rejectItem}
          onReject={handleReject}
          onClose={() => setRejectItem(null)}
        />
      )}

      {ConfirmDialog}
    </div>
  );
}

export default AdminIngredientsPage;
