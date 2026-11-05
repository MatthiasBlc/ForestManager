import { useState, useEffect } from "react";
import { AdminRecipeDetail, AdminRecipeUpdateInput } from "../../models/admin";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import toast from "react-hot-toast";
import { toastError } from "../../utils/toastError";

interface AdminRecipeDetailModalProps {
  recipeId: string;
  onClose: () => void;
  onRecipeChanged: () => void;
}

function formatTime(minutes: number | null): string {
  if (minutes === null) return "-";
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

const AdminRecipeDetailModal = ({
  recipeId,
  onClose,
  onRecipeChanged,
}: AdminRecipeDetailModalProps) => {
  const [recipe, setRecipe] = useState<AdminRecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<AdminRecipeUpdateInput>({});
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    setLoading(true);
    APIManager.getAdminRecipe(recipeId)
      .then(setRecipe)
      .catch(() => toast.error("Failed to load recipe"))
      .finally(() => setLoading(false));
  }, [recipeId]);

  const startEdit = () => {
    if (!recipe) return;
    setForm({
      title: recipe.title,
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      restTime: recipe.restTime,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!recipe) return;
    const confirmed = await confirm({
      title: "Update Recipe",
      message: "Modifier cette recette directement en base ?",
      confirmLabel: "Save",
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      await APIManager.updateAdminRecipe(recipe.id, form);
      toast.success("Recipe updated");
      const updated = await APIManager.getAdminRecipe(recipe.id);
      setRecipe(updated);
      setEditing(false);
      onRecipeChanged();
    } catch (err) {
      toastError(err, "Failed to update recipe");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recipe) return;
    const confirmed = await confirm({
      title: "Delete Recipe",
      message: `Supprimer la recette "${recipe.title}" ? (soft delete)`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    try {
      await APIManager.deleteAdminRecipe(recipe.id);
      toast.success("Recipe deleted");
      onClose();
      onRecipeChanged();
    } catch (err) {
      toastError(err, "Failed to delete recipe");
    }
  };

  return (
    <>
      <div className="modal modal-open">
        <div className="modal-box max-w-3xl max-h-[90vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : (
            recipe && (
              <>
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-lg">{recipe.title}</h3>
                  {recipe.deletedAt && <span className="badge badge-error">Deleted</span>}
                </div>

                {!editing ? (
                  <>
                    <div className="card bg-base-200 mt-4 p-4">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-semibold">Servings:</span> {recipe.servings}
                        </div>
                        <div>
                          <span className="font-semibold">Prep:</span> {formatTime(recipe.prepTime)}
                        </div>
                        <div>
                          <span className="font-semibold">Cook:</span> {formatTime(recipe.cookTime)}
                        </div>
                        <div>
                          <span className="font-semibold">Rest:</span> {formatTime(recipe.restTime)}
                        </div>
                        <div>
                          <span className="font-semibold">Creator:</span> {recipe.creator.username}
                        </div>
                        <div>
                          <span className="font-semibold">Community:</span>{" "}
                          {recipe.community?.name || "-"}
                        </div>
                      </div>
                    </div>

                    {recipe.tags.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-sm mb-1">Tags</h4>
                        <div className="flex flex-wrap gap-1">
                          {recipe.tags.map(({ tag }) => (
                            <span key={tag.id} className="badge badge-sm badge-outline">
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {recipe.ingredients.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-sm mb-1">Ingredients</h4>
                        <ul className="list-disc list-inside text-sm space-y-0.5">
                          {recipe.ingredients.map((ing) => (
                            <li key={ing.id}>
                              {ing.quantity != null && <span>{ing.quantity} </span>}
                              {ing.unit && <span>{ing.unit.abbreviation} </span>}
                              {ing.ingredient.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {recipe.steps.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-sm mb-1">Steps</h4>
                        <ol className="list-decimal list-inside text-sm space-y-1">
                          {recipe.steps.map((step) => (
                            <li key={step.id}>{step.instruction}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="modal-action">
                      <button className="btn btn-ghost" onClick={onClose}>
                        Close
                      </button>
                      {!recipe.deletedAt && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={startEdit}>
                            Edit
                          </button>
                          <button className="btn btn-error btn-sm" onClick={handleDelete}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="card bg-base-200 mt-4 p-4 space-y-3">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text text-sm">Title</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered input-sm"
                          value={form.title ?? ""}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text text-sm">Servings</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered input-sm"
                            value={form.servings ?? ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                servings: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text text-sm">Prep time (min)</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered input-sm"
                            value={form.prepTime ?? ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                prepTime: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                          />
                        </div>
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text text-sm">Cook time (min)</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered input-sm"
                            value={form.cookTime ?? ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                cookTime: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                          />
                        </div>
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text text-sm">Rest time (min)</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered input-sm"
                            value={form.restTime ?? ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                restTime: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="modal-action">
                      <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSave}
                        disabled={saving || !form.title?.trim()}
                      >
                        {saving ? <span className="loading loading-spinner loading-sm" /> : "Save"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )
          )}
        </div>
        <div className="modal-backdrop bg-black/50" onClick={onClose} />
      </div>
      {ConfirmDialog}
    </>
  );
};

export default AdminRecipeDetailModal;
