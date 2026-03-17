import { useEffect, useState, useMemo } from "react";
import { FaSortUp, FaSortDown, FaSort } from "react-icons/fa";
import { AdminTag } from "../../models/admin";
import APIManager from "../../network/api";
import { useConfirm } from "../../hooks/useConfirm";
import DataContainer from "../../components/DataContainer";
import { useAsyncData } from "../../hooks/useAsyncData";
import TagEditModal from "../../components/admin/TagEditModal";
import TagMergeModal from "../../components/admin/TagMergeModal";
import AdminRecipeListModal from "../../components/admin/AdminRecipeListModal";
import AdminRecipeDetailModal from "../../components/admin/AdminRecipeDetailModal";
import toast from "react-hot-toast";

type ScopeFilter = "ALL" | "GLOBAL" | "COMMUNITY";
type TagSortColumn = "name" | "scope" | "status" | "recipeCount";
type SortDirection = "asc" | "desc";

function AdminTagsPage() {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("ALL");
  const [editModalTag, setEditModalTag] = useState<AdminTag | null | "create">(null);
  const [mergeSource, setMergeSource] = useState<AdminTag | null>(null);
  const [recipesModalTag, setRecipesModalTag] = useState<AdminTag | null>(null);
  const [recipeDetailId, setRecipeDetailId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<TagSortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const { confirm, ConfirmDialog } = useConfirm();

  const {
    data: tags,
    isLoading,
    error,
    refetch: loadTags,
  } = useAsyncData<AdminTag[]>(() => {
    const scope = scopeFilter !== "ALL" ? scopeFilter : undefined;
    return APIManager.getAdminTags(search || undefined, scope);
  }, [search, scopeFilter]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // --- Sorting ---
  const handleSort = (column: TagSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedTags = useMemo(() => {
    const sorted = [...(tags ?? [])].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortColumn) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "scope":
          aVal = a.scope ?? "";
          bVal = b.scope ?? "";
          break;
        case "status":
          aVal = a.status ?? "";
          bVal = b.status ?? "";
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
  }, [tags, sortColumn, sortDirection]);

  const SortIcon = ({ column }: { column: TagSortColumn }) => {
    if (sortColumn !== column) return <FaSort className="ml-1 opacity-30" />;
    return sortDirection === "asc" ? (
      <FaSortUp className="ml-1" />
    ) : (
      <FaSortDown className="ml-1" />
    );
  };

  async function handleSave(name: string) {
    try {
      if (editModalTag && editModalTag !== "create") {
        await APIManager.updateAdminTag(editModalTag.id, name);
        toast.success("Tag updated");
      } else {
        await APIManager.createAdminTag(name);
        toast.success("Tag created");
      }
      setEditModalTag(null);
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tag");
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

  async function handleMerge(target: AdminTag) {
    if (!mergeSource) return;
    try {
      await APIManager.mergeAdminTags(mergeSource.id, target.id);
      toast.success(`Merged "${mergeSource.name}" into "${target.name}"`);
      setMergeSource(null);
      loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to merge tags");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Tags</h1>
        <button className="btn btn-primary" onClick={() => setEditModalTag("create")}>
          Add Tag
        </button>
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
      <DataContainer isLoading={isLoading && !tags} error={null}>
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
                  <th className="cursor-pointer select-none" onClick={() => handleSort("scope")}>
                    <span className="flex items-center">
                      Scope
                      <SortIcon column="scope" />
                    </span>
                  </th>
                  <th>Community</th>
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
                {sortedTags.length > 0 ? (
                  sortedTags.map((tag) => (
                    <tr key={tag.id}>
                      <td className="font-medium">{tag.name}</td>
                      <td>
                        <span
                          className={`badge badge-sm ${tag.scope === "GLOBAL" ? "badge-primary" : "badge-secondary"}`}
                        >
                          {tag.scope || "GLOBAL"}
                        </span>
                      </td>
                      <td className="text-base-content/60">{tag.community?.name || "-"}</td>
                      <td className="text-right">
                        {tag.recipeCount > 0 ? (
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => setRecipesModalTag(tag)}
                          >
                            {tag.recipeCount}
                          </button>
                        ) : (
                          <span>{tag.recipeCount}</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => setEditModalTag(tag)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => setMergeSource(tag)}
                          >
                            Merge
                          </button>
                          <button
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => handleDelete(tag)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center text-base-content/50">
                      No tags found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DataContainer>

      {/* Modals */}
      {editModalTag && (
        <TagEditModal
          editingTag={editModalTag === "create" ? null : editModalTag}
          onSave={handleSave}
          onClose={() => setEditModalTag(null)}
        />
      )}

      {mergeSource && (
        <TagMergeModal
          source={mergeSource}
          tags={tags ?? []}
          onMerge={handleMerge}
          onClose={() => setMergeSource(null)}
        />
      )}

      {recipesModalTag && (
        <AdminRecipeListModal
          tagId={recipesModalTag.id}
          tagName={recipesModalTag.name}
          onSelectRecipe={setRecipeDetailId}
          onClose={() => setRecipesModalTag(null)}
        />
      )}

      {recipeDetailId && (
        <AdminRecipeDetailModal
          recipeId={recipeDetailId}
          onClose={() => setRecipeDetailId(null)}
          onRecipeChanged={() => {
            loadTags();
            if (recipesModalTag) {
              // Force re-mount of recipe list to refresh
              const tag = recipesModalTag;
              setRecipesModalTag(null);
              setTimeout(() => setRecipesModalTag(tag), 0);
            }
          }}
        />
      )}

      {ConfirmDialog}
    </div>
  );
}

export default AdminTagsPage;
