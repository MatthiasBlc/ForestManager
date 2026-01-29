import styles from "../styles/Recipe.module.css";
import styleUtils from "../styles/utils.module.css";
import { Recipe as RecipeModel } from "../models/recipe";
import { formatDate } from "../utils/format.Date";
import { MdDelete } from "react-icons/md";

interface RecipeProps {
  recipe: RecipeModel;
  onRecipeClicked: (recipe: RecipeModel) => void;
  onDeleteRecipeClicked: (recipe: RecipeModel) => void;
  className?: string;
}

const Recipe = ({
  recipe,
  onRecipeClicked,
  onDeleteRecipeClicked,
  className,
}: RecipeProps) => {
  const { title, content, createdAt, updatedAt } = recipe;

  let createdUpdatedText: string;
  if (updatedAt > createdAt) {
    createdUpdatedText = `Updated: ${formatDate(updatedAt)}`;
  } else {
    createdUpdatedText = `Created: ${formatDate(createdAt)}`;
  }

  return (
    <div
      className={`card w-96 bg-base-100 shadow-xl ${styles.recipeCard} ${className}`}
      onClick={() => onRecipeClicked(recipe)}
    >
      <div className={`card-body ${styles.cardBody} `}>
        <h2 className={`card-title ${styleUtils.flexCenter}`}>
          {title}{" "}
          <MdDelete
            className="text-secondary ms-auto"
            onClick={(e: { stopPropagation: () => void }) => {
              onDeleteRecipeClicked(recipe);
              e.stopPropagation();
            }}
          />
        </h2>
        <p className={`${styles.cardText} `}>{content}</p>
        <div className="text-secondary">{createdUpdatedText}</div>
        <div className="card-actions justify-end">
          <button className="btn btn-primary">button</button>
        </div>
      </div>
    </div>
  );
};
export default Recipe;
