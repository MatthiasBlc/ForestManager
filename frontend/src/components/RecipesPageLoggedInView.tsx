import { useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { Recipe as RecipeModel } from "../models/recipe";
import APIManager from "../network/api";
import AddEditRecipeDialog from "./AddEditRecipeDialog";
import Recipe from "./Recipe";
import styles from "../styles/RecipesPage.module.css";
import styleUtils from "../styles/utils.module.css";

const RecipesPageLoggedInView = () => {
  const [recipes, setRecipes] = useState<RecipeModel[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [showRecipesLoadingError, setShowRecipesLoadingError] = useState(false);

  const [showAddRecipeDialog, setShowAddRecipeDialog] = useState(false);
  const [recipeToEdit, setRecipeToEdit] = useState<RecipeModel | null>(null);

  useEffect(() => {
    async function loadRecipes() {
      try {
        setShowRecipesLoadingError(false);
        setRecipesLoading(true);
        const data = await APIManager.loadRecipes();
        setRecipes(data);
      } catch (error) {
        console.log(error);
        setShowRecipesLoadingError(true);
      } finally {
        setRecipesLoading(false);
      }
    }
    loadRecipes();
  }, []);

  async function deleteRecipe(recipe: RecipeModel) {
    try {
      await APIManager.deleteRecipe(recipe.id);
      setRecipes(
        recipes.filter((existingRecipe) => existingRecipe.id !== recipe.id)
      );
    } catch (error) {
      console.log(error);
      alert(error);
    }
  }

  const recipesGrid = (
    <div
      className={`grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${styles.recipesGrid}`}
    >
      {recipes.map((recipe) => (
        <div key={recipe.id}>
          <Recipe
            recipe={recipe}
            onRecipeClicked={setRecipeToEdit}
            onDeleteRecipeClicked={deleteRecipe}
            className={styles.recipe}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className={` ${styles.recipesPage}`}>
      <button
        className={`mb-4 ${styleUtils.blockCenter} ${styleUtils.flexCenter}`}
        onClick={() => setShowAddRecipeDialog(true)}
      >
        <FaPlus />
        Add new recipe
      </button>
      {recipesLoading && (
        <span className="loading loading-spinner loading-lg" />
      )}
      {showRecipesLoadingError && (
        <p>Something went wrong. Please refresh the page</p>
      )}
      {!recipesLoading && !showRecipesLoadingError && (
        <>
          {recipes.length > 0 ? (
            recipesGrid
          ) : (
            <p>You don&apos;t have any recipe yet</p>
          )}
        </>
      )}
      {showAddRecipeDialog && (
        <AddEditRecipeDialog
          onDismiss={() => setShowAddRecipeDialog(false)}
          onRecipeSaved={(newRecipe) => {
            setRecipes([...recipes, newRecipe]);
            setShowAddRecipeDialog(false);
          }}
        />
      )}
      {recipeToEdit && (
        <AddEditRecipeDialog
          recipeToEdit={recipeToEdit}
          onDismiss={() => setRecipeToEdit(null)}
          onRecipeSaved={(updatedRecipe) => {
            setRecipes(
              recipes.map((existingRecipe) =>
                existingRecipe.id === updatedRecipe.id
                  ? updatedRecipe
                  : existingRecipe
              )
            );
            setRecipeToEdit(null);
          }}
        />
      )}
    </div>
  );
};

export default RecipesPageLoggedInView;
