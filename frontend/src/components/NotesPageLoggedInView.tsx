import { useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { Note as NoteModel } from "../models/note";
import APIManager from "../network/api";
import AddEditNoteDialog from "./AddEditNoteDialog";
import Note from "./Note";
import styles from "../styles/NotesPage.module.css";
import styleUtils from "../styles/utils.module.css";

const NotesPageLoggedInView = () => {
  const [notes, setNotes] = useState<NoteModel[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [showNotesLoadingError, setShowNotesLoadingError] = useState(false);

  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<NoteModel | null>(null);

  useEffect(() => {
    async function loadNotes() {
      try {
        setShowNotesLoadingError(false);
        setNotesLoading(true);
        const data = await APIManager.loadNotes();
        setNotes(data);
      } catch (error) {
        console.log(error);
        setShowNotesLoadingError(true);
      } finally {
        setNotesLoading(false);
      }
    }
    loadNotes();
  }, []);

  async function deleteNote(note: NoteModel) {
    try {
      await APIManager.deleteNote(note.id);
      setNotes(notes.filter((existingNote) => existingNote.id !== note.id));
    } catch (error) {
      console.log(error);
      alert(error);
    }
  }

  const notesGrid = (
    <div
      className={`grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${styles.notesGrid}`}
    >
      {notes.map((note) => (
        <div key={note.id}>
          <Note
            note={note}
            onNoteClicked={setNoteToEdit}
            onDeleteNoteClicked={deleteNote}
            className={styles.note}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className={` ${styles.notesPage}`}>
      <button
        className={`mb-4 ${styleUtils.blockCenter} ${styleUtils.flexCenter}`}
        onClick={() => setShowAddNoteDialog(true)}
      >
        <FaPlus />
        Add new note
      </button>
      {notesLoading && <span className="loading loading-spinner loading-lg" />}
      {showNotesLoadingError && (
        <p>Something went wrong. Please refresh the page</p>
      )}
      {!notesLoading && !showNotesLoadingError && (
        <>
          {notes.length > 0 ? (
            notesGrid
          ) : (
            <p>You don&apos;t have any note yet</p>
          )}
        </>
      )}
      {showAddNoteDialog && (
        <AddEditNoteDialog
          onDismiss={() => setShowAddNoteDialog(false)}
          onNoteSaved={(newNote) => {
            setNotes([...notes, newNote]);
            setShowAddNoteDialog(false);
          }}
        />
      )}
      {noteToEdit && (
        <AddEditNoteDialog
          noteToEdit={noteToEdit}
          onDismiss={() => setNoteToEdit(null)}
          onNoteSaved={(updatedNote) => {
            setNotes(
              notes.map((existingNote) =>
                existingNote.id === updatedNote.id ? updatedNote : existingNote
              )
            );
            setNoteToEdit(null);
          }}
        />
      )}
    </div>
  );
};

export default NotesPageLoggedInView;
