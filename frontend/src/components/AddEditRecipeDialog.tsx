import { useForm } from "react-hook-form";
import Modal from "./Modal";
import { Recipe } from "../models/recipe";
import APIManager, { RecipeInput } from "../network/api";
import TextInputField from "./form/TextInputField";

interface AddEditRecipeDialogProps {
  recipeToEdit?: Recipe;
  onDismiss: () => void;
  onRecipeSaved: (recipe: Recipe) => void;
}

const AddEditRecipeDialog = ({
  recipeToEdit,
  onDismiss,
  onRecipeSaved,
}: AddEditRecipeDialogProps) => {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RecipeInput>({
    defaultValues: {
      title: recipeToEdit?.title ?? "",
      text: recipeToEdit?.text ?? "",
    },
  });

  async function onSubmit(input: RecipeInput) {
    try {
      let recipeResponse: Recipe;
      if (recipeToEdit) {
        recipeResponse = await APIManager.updateRecipe(recipeToEdit.id, input);
      } else {
        recipeResponse = await APIManager.createRecipe(input);
      }
      onRecipeSaved(recipeResponse);
    } catch (error) {
      console.log(error);
      alert(error);
    }
  }

  return (
    <div className="container">
      <Modal onClose={onDismiss}>
        <h3 className="font-bold text-lg">
          {recipeToEdit ? "Edit recipe" : "Add recipe"}{" "}
        </h3>
        <form id="addEditRecipeForm" onSubmit={handleSubmit(onSubmit)}>
          <TextInputField
            name="title"
            label="Title"
            type="text"
            placeholder="Title"
            className="input input-bordered w-full max-w-xs"
            required
            register={register}
            registerOptions={{ required: "Required" }}
          />
          <TextInputField
            name="text"
            label="Text"
            type="textarea"
            placeholder="Text"
            textAreaField
            className="textarea textarea-bordered h-24"
            required
            register={register}
            registerOptions={{ required: "Required" }}
          />
        </form>

        <div className="modal-action">
          <button
            type="submit"
            form="addEditRecipeForm"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            Save
          </button>
          <button className="btn btn-primary" onClick={onDismiss}>
            close
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AddEditRecipeDialog;
