import NotesPageLoggedInView from "../components/NotesPageLoggedInView";
import NotesPageLoggedOutView from "../components/NotesPageLoggedOutView";
import { User } from "../models/user";

interface NotesPageProps {
  loggedInUser: User | null;
}

const NotesPage = ({ loggedInUser }: NotesPageProps) => {
  return (
    <div>
      {loggedInUser ? <NotesPageLoggedInView /> : <NotesPageLoggedOutView />}
    </div>
  );
};

export default NotesPage;
