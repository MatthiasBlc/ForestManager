import { useEffect, useState, useCallback } from "react";
import { AdminIngredient } from "../../models/admin";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import toast from "react-hot-toast";

function AdminIngredientsPage() {
  const [ingredients, setIngredients] = useState<AdminIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminIngredient | null>(null);
  const [itemName, setItemName] = useState("");
  const [saving, setSaving] = useState(false);
  const [mergeSource, setMergeSource] = useState<AdminIngredient | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const loadIngredients = useCallback(async () => {
    try {
      const data = await APIManager.getAdminIngredients(search || undefined);
      setIngredients(data);
    } catch {
      toast.error("Failed to load ingredients");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    setIsLoading(true);
    loadIngredients();
  }, [loadIngredients]);

  function openCreate() {
    setEditingItem(null);
    setItemName("");
    setModalOpen(true);
  }

  function openEdit(item: AdminIngredient) {
    setEditingItem(item);
    setItemName(item.name);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!itemName.trim()) return;
    setSaving(true);
    try {
      if (editingItem) {
        await APIManager.updateAdminIngredient(editingItem.id, itemName.trim());
        toast.success("Ingredient updated");
      } else {
        await APIManager.createAdminIngredient(itemName.trim());
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

  function openMerge(item: AdminIngredient) {
    setMergeSource(item);
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Ingredients</h1>
        <button className="btn btn-primary" onClick={openCreate}>Add Ingredient</button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search ingredients..."
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
                {ingredients.length > 0 ? (
                  ingredients.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.name}</td>
                      <td className="text-right">{item.recipeCount}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button className="btn btn-ghost btn-xs" onClick={() => openEdit(item)}>Edit</button>
                          <button className="btn btn-ghost btn-xs" onClick={() => openMerge(item)}>Merge</button>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(item)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center text-base-content/50">No ingredients found</td>
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
            <h3 className="font-bold text-lg">{editingItem ? "Edit Ingredient" : "Create Ingredient"}</h3>
            <div className="form-control mt-4">
              <label className="label"><span className="label-text">Name</span></label>
              <input
                type="text"
                className="input input-bordered"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !itemName.trim()}>
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
            <p className="text-sm text-base-content/70 mt-2">Select the target ingredient. All recipes will be moved to the target.</p>
            <div className="mt-4 max-h-60 overflow-y-auto">
              {ingredients.filter((i) => i.id !== mergeSource.id).map((item) => (
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

export default AdminIngredientsPage;
