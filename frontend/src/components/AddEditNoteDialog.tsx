import { useForm } from "react-hook-form";
import Modal from "./Modal";
import { Note } from "../models/note";
import APIManager, { NoteInput } from "../network/api";
import TextInputField from "./form/TextInputField";

interface AddEditNoteDialogProps {
  noteToEdit?: Note;
  onDismiss: () => void;
  onNoteSaved: (note: Note) => void;
}

const AddEditNoteDialog = ({
  noteToEdit,
  onDismiss,
  onNoteSaved,
}: AddEditNoteDialogProps) => {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<NoteInput>({
    defaultValues: {
      title: noteToEdit?.title ?? "",
      text: noteToEdit?.text ?? "",
    },
  });

  async function onSubmit(input: NoteInput) {
    try {
      let noteResponse: Note;
      if (noteToEdit) {
        noteResponse = await APIManager.updateNote(noteToEdit.id, input);
      } else {
        noteResponse = await APIManager.createNote(input);
      }
      onNoteSaved(noteResponse);
    } catch (error) {
      console.log(error);
      alert(error);
    }
  }

  return (
    <div className="container">
      <Modal onClose={onDismiss}>
        <h3 className="font-bold text-lg">
          {noteToEdit ? "Edit note" : "Add note"}{" "}
        </h3>
        <form id="addEditNoteForm" onSubmit={handleSubmit(onSubmit)}>
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
            form="addEditNoteForm"
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

export default AddEditNoteDialog;
