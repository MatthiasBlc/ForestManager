import { useEffect, useState, useCallback } from "react";
import { AdminTag, AdminRecipeListItem, AdminRecipeDetail, AdminRecipeUpdateInput } from "../../models/admin";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import toast from "react-hot-toast";

type ScopeFilter = "ALL" | "GLOBAL" | "COMMUNITY";

function AdminTagsPage() {
  const [tags, setTags] = useState<AdminTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<AdminTag | null>(null);
  const [tagName, setTagName] = useState("");
  const [saving, setSaving] = useState(false);
  const [mergeSource, setMergeSource] = useState<AdminTag | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // Recipe list modal state
  const [recipesModalTag, setRecipesModalTag] = useState<AdminTag | null>(null);
  const [recipes, setRecipes] = useState<AdminRecipeListItem[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  // Recipe detail modal state
  const [recipeDetail, setRecipeDetail] = useState<AdminRecipeDetail | null>(null);
  const [recipeDetailLoading, setRecipeDetailLoading] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [recipeForm, setRecipeForm] = useState<AdminRecipeUpdateInput>({});
  const [savingRecipe, setSavingRecipe] = useState(false);

  const loadTags = useCallback(async () => {
    try {
      const scope = scopeFilter !== "ALL" ? scopeFilter : undefined;
      const data = await APIManager.getAdminTags(search || undefined, scope);
      setTags(data);
    } catch {
      toast.error("Failed to load tags");
    } finally {
      setIsLoading(false);
    }
  }, [search, scopeFilter]);

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

  // --- Recipe list modal ---

  const loadRecipes = useCallback(async (tagId: string, includeDeleted: boolean) => {
    setRecipesLoading(true);
    try {
      const data = await APIManager.getAdminTagRecipes(tagId, includeDeleted);
      setRecipes(data.recipes);
    } catch {
      toast.error("Failed to load recipes");
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  function openRecipesModal(tag: AdminTag) {
    setRecipesModalTag(tag);
    setShowDeleted(false);
    loadRecipes(tag.id, false);
  }

  function closeRecipesModal() {
    setRecipesModalTag(null);
    setRecipes([]);
  }

  useEffect(() => {
    if (recipesModalTag) {
      loadRecipes(recipesModalTag.id, showDeleted);
    }
  }, [showDeleted, recipesModalTag, loadRecipes]);

  // --- Recipe detail modal ---

  async function openRecipeDetail(recipeId: string) {
    setRecipeDetailLoading(true);
    setEditingRecipe(false);
    try {
      const recipe = await APIManager.getAdminRecipe(recipeId);
      setRecipeDetail(recipe);
    } catch {
      toast.error("Failed to load recipe");
    } finally {
      setRecipeDetailLoading(false);
    }
  }

  function closeRecipeDetail() {
    setRecipeDetail(null);
    setEditingRecipe(false);
    setRecipeForm({});
  }

  function startEditRecipe() {
    if (!recipeDetail) return;
    setRecipeForm({
      title: recipeDetail.title,
      servings: recipeDetail.servings,
      prepTime: recipeDetail.prepTime,
      cookTime: recipeDetail.cookTime,
      restTime: recipeDetail.restTime,
    });
    setEditingRecipe(true);
  }

  async function handleSaveRecipe() {
    if (!recipeDetail) return;

    const confirmed = await confirm({
      title: "Update Recipe",
      message: "Modifier cette recette directement en base ?",
      confirmLabel: "Save",
    });
    if (!confirmed) return;

    setSavingRecipe(true);
    try {
      await APIManager.updateAdminRecipe(recipeDetail.id, recipeForm);
      toast.success("Recipe updated");
      // Refresh detail
      const updated = await APIManager.getAdminRecipe(recipeDetail.id);
      setRecipeDetail(updated);
      setEditingRecipe(false);
      // Refresh recipe list if modal open
      if (recipesModalTag) {
        loadRecipes(recipesModalTag.id, showDeleted);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update recipe");
    } finally {
      setSavingRecipe(false);
    }
  }

  async function handleDeleteRecipe() {
    if (!recipeDetail) return;

    const confirmed = await confirm({
      title: "Delete Recipe",
      message: `Supprimer la recette "${recipeDetail.title}" ? (soft delete)`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    try {
      await APIManager.deleteAdminRecipe(recipeDetail.id);
      toast.success("Recipe deleted");
      closeRecipeDetail();
      // Refresh recipe list if modal open
      if (recipesModalTag) {
        loadRecipes(recipesModalTag.id, showDeleted);
      }
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete recipe");
    }
  }

  function formatTime(minutes: number | null): string {
    if (minutes === null) return "-";
    if (minutes < 60) return `${minutes}min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Tags</h1>
        <button className="btn btn-primary" onClick={openCreate}>Add Tag</button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search tags..."
          className="input input-bordered w-full max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select select-bordered select-sm"
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
          aria-label="Filter by scope"
        >
          <option value="ALL">All scopes</option>
          <option value="GLOBAL">Global</option>
          <option value="COMMUNITY">Community</option>
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
                  <th>Scope</th>
                  <th>Community</th>
                  <th className="text-right">Recipes</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tags.length > 0 ? (
                  tags.map((tag) => (
                    <tr key={tag.id}>
                      <td className="font-medium">{tag.name}</td>
                      <td>
                        <span className={`badge badge-sm ${tag.scope === "GLOBAL" ? "badge-primary" : "badge-secondary"}`}>
                          {tag.scope || "GLOBAL"}
                        </span>
                      </td>
                      <td className="text-base-content/60">
                        {tag.community?.name || "-"}
                      </td>
                      <td className="text-right">
                        {tag.recipeCount > 0 ? (
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => openRecipesModal(tag)}
                          >
                            {tag.recipeCount}
                          </button>
                        ) : (
                          <span>{tag.recipeCount}</span>
                        )}
                      </td>
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
                    <td colSpan={5} className="text-center text-base-content/50">No tags found</td>
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

      {/* Recipes List Modal */}
      {recipesModalTag && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg">Recipes with tag &quot;{recipesModalTag.name}&quot;</h3>

            <div className="form-control mt-3">
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                />
                <span className="label-text">Show deleted recipes</span>
              </label>
            </div>

            {recipesLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : (
              <div className="overflow-x-auto mt-2">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Community</th>
                      <th>Creator</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipes.length > 0 ? (
                      recipes.map((recipe) => (
                        <tr
                          key={recipe.id}
                          className="hover cursor-pointer"
                          onClick={() => openRecipeDetail(recipe.id)}
                        >
                          <td className="font-medium">{recipe.title}</td>
                          <td className="text-base-content/60">{recipe.community?.name || "-"}</td>
                          <td className="text-base-content/60">{recipe.creator.username}</td>
                          <td>
                            {recipe.deletedAt ? (
                              <span className="badge badge-sm badge-error">Deleted</span>
                            ) : (
                              <span className="badge badge-sm badge-success">Active</span>
                            )}
                          </td>
                          <td className="text-base-content/60">
                            {new Date(recipe.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center text-base-content/50">No recipes found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={closeRecipesModal}>Close</button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={closeRecipesModal} />
        </div>
      )}

      {/* Recipe Detail Modal */}
      {(recipeDetail || recipeDetailLoading) && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl max-h-[90vh] overflow-y-auto">
            {recipeDetailLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : recipeDetail && (
              <>
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-lg">{recipeDetail.title}</h3>
                  {recipeDetail.deletedAt && (
                    <span className="badge badge-error">Deleted</span>
                  )}
                </div>

                {!editingRecipe ? (
                  <>
                    {/* Read-only view */}
                    <div className="card bg-base-200 mt-4 p-4">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="font-semibold">Servings:</span> {recipeDetail.servings}</div>
                        <div><span className="font-semibold">Prep:</span> {formatTime(recipeDetail.prepTime)}</div>
                        <div><span className="font-semibold">Cook:</span> {formatTime(recipeDetail.cookTime)}</div>
                        <div><span className="font-semibold">Rest:</span> {formatTime(recipeDetail.restTime)}</div>
                        <div><span className="font-semibold">Creator:</span> {recipeDetail.creator.username}</div>
                        <div><span className="font-semibold">Community:</span> {recipeDetail.community?.name || "-"}</div>
                      </div>
                    </div>

                    {/* Tags */}
                    {recipeDetail.tags.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-sm mb-1">Tags</h4>
                        <div className="flex flex-wrap gap-1">
                          {recipeDetail.tags.map(({ tag }) => (
                            <span key={tag.id} className="badge badge-sm badge-outline">{tag.name}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ingredients */}
                    {recipeDetail.ingredients.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-sm mb-1">Ingredients</h4>
                        <ul className="list-disc list-inside text-sm space-y-0.5">
                          {recipeDetail.ingredients.map((ing) => (
                            <li key={ing.id}>
                              {ing.quantity != null && <span>{ing.quantity} </span>}
                              {ing.unit && <span>{ing.unit.abbreviation} </span>}
                              {ing.ingredient.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Steps */}
                    {recipeDetail.steps.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-sm mb-1">Steps</h4>
                        <ol className="list-decimal list-inside text-sm space-y-1">
                          {recipeDetail.steps.map((step) => (
                            <li key={step.id}>{step.instruction}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="modal-action">
                      <button className="btn btn-ghost" onClick={closeRecipeDetail}>Close</button>
                      {!recipeDetail.deletedAt && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={startEditRecipe}>Edit</button>
                          <button className="btn btn-error btn-sm" onClick={handleDeleteRecipe}>Delete</button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Edit form */}
                    <div className="card bg-base-200 mt-4 p-4 space-y-3">
                      <div className="form-control">
                        <label className="label"><span className="label-text text-sm">Title</span></label>
                        <input
                          type="text"
                          className="input input-bordered input-sm"
                          value={recipeForm.title ?? ""}
                          onChange={(e) => setRecipeForm({ ...recipeForm, title: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-control">
                          <label className="label"><span className="label-text text-sm">Servings</span></label>
                          <input
                            type="number"
                            className="input input-bordered input-sm"
                            value={recipeForm.servings ?? ""}
                            onChange={(e) => setRecipeForm({ ...recipeForm, servings: e.target.value ? Number(e.target.value) : undefined })}
                          />
                        </div>
                        <div className="form-control">
                          <label className="label"><span className="label-text text-sm">Prep time (min)</span></label>
                          <input
                            type="number"
                            className="input input-bordered input-sm"
                            value={recipeForm.prepTime ?? ""}
                            onChange={(e) => setRecipeForm({ ...recipeForm, prepTime: e.target.value ? Number(e.target.value) : null })}
                          />
                        </div>
                        <div className="form-control">
                          <label className="label"><span className="label-text text-sm">Cook time (min)</span></label>
                          <input
                            type="number"
                            className="input input-bordered input-sm"
                            value={recipeForm.cookTime ?? ""}
                            onChange={(e) => setRecipeForm({ ...recipeForm, cookTime: e.target.value ? Number(e.target.value) : null })}
                          />
                        </div>
                        <div className="form-control">
                          <label className="label"><span className="label-text text-sm">Rest time (min)</span></label>
                          <input
                            type="number"
                            className="input input-bordered input-sm"
                            value={recipeForm.restTime ?? ""}
                            onChange={(e) => setRecipeForm({ ...recipeForm, restTime: e.target.value ? Number(e.target.value) : null })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="modal-action">
                      <button className="btn btn-ghost" onClick={() => setEditingRecipe(false)}>Cancel</button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveRecipe}
                        disabled={savingRecipe || !recipeForm.title?.trim()}
                      >
                        {savingRecipe ? <span className="loading loading-spinner loading-sm"></span> : "Save"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          <div className="modal-backdrop bg-black/50" onClick={closeRecipeDetail} />
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}

export default AdminTagsPage;
