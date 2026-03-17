import { useState, useEffect, useCallback } from "react";
import { AdminRecipeListItem } from "../../models/admin";
import APIManager from "../../network/api";
import toast from "react-hot-toast";

interface AdminRecipeListModalProps {
  tagId: string;
  tagName: string;
  onSelectRecipe: (recipeId: string) => void;
  onClose: () => void;
}

const AdminRecipeListModal = ({
  tagId,
  tagName,
  onSelectRecipe,
  onClose,
}: AdminRecipeListModalProps) => {
  const [recipes, setRecipes] = useState<AdminRecipeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const loadRecipes = useCallback(
    async (includeDeleted: boolean) => {
      setLoading(true);
      try {
        const data = await APIManager.getAdminTagRecipes(tagId, includeDeleted);
        setRecipes(data.recipes);
      } catch {
        toast.error("Failed to load recipes");
      } finally {
        setLoading(false);
      }
    },
    [tagId]
  );

  useEffect(() => {
    loadRecipes(showDeleted);
  }, [showDeleted, loadRecipes]);

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-3xl">
        <h3 className="font-bold text-lg">Recipes with tag &quot;{tagName}&quot;</h3>

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

        {loading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md" />
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
                      onClick={() => onSelectRecipe(recipe.id)}
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
                    <td colSpan={5} className="text-center text-base-content/50">
                      No recipes found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
};

export default AdminRecipeListModal;
