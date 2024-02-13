import styles from "../styles/Note.module.css";
import styleUtils from "../styles/utils.module.css";
import { Note as NoteModel } from "../models/note";
import { formatDate } from "../utils/format.Date";
import { MdDelete } from "react-icons/md";

interface NoteProps {
  note: NoteModel;
  onNoteClicked: (note: NoteModel) => void;
  onDeleteNoteClicked: (note: NoteModel) => void;
  className?: string;
}

const Note = ({
  note,
  onNoteClicked,
  onDeleteNoteClicked,
  className,
}: NoteProps) => {
  const { title, text, createdAt, updatedAT } = note;

  let createdUpdatedText: string;
  if (updatedAT > createdAt) {
    createdUpdatedText = `Updated: ${formatDate(updatedAT)}`;
  } else {
    createdUpdatedText = `Created: ${formatDate(createdAt)}`;
  }

  return (
    <div
      className={`card w-96 bg-base-100 shadow-xl ${styles.noteCard} ${className}`}
      onClick={() => onNoteClicked(note)}
    >
      <div className={`card-body ${styles.cardBody} `}>
        <h2 className={`card-title ${styleUtils.flexCenter}`}>
          {title}{" "}
          <MdDelete
            className="text-secondary ms-auto"
            onClick={(e: { stopPropagation: () => void }) => {
              onDeleteNoteClicked(note);
              e.stopPropagation();
            }}
          />
        </h2>
        <p className={`${styles.cardText} `}>{text}</p>
        <div className="text-secondary">{createdUpdatedText}</div>
        <div className="card-actions justify-end">
          <button className="btn btn-primary">button</button>
        </div>
      </div>
    </div>
  );
};
export default Note;
