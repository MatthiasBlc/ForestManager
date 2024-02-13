import axios from "axios";
import { Note } from "../models/note";
import { User } from "../models/user";
import { ConflictError, UnauthorizedError } from "../errors/http_errors";

const apiUrl = import.meta.env.VITE_BACKEND_URL;
// eslint-disable-next-line react-refresh/only-export-components
const API = axios.create({ withCredentials: true, baseURL: apiUrl });

API.interceptors.request.use(({ headers, ...config }) => ({
  ...config,
  headers: {
    ...headers,
    "Content-Type": "application/json",
  },
}));


export interface NoteInput {
  title: string,
  text: string,
}

export interface SignUpCredentials {
  username: string,
  email: string,
  password: string,
}

export interface LoginCredentials {
  username: string,
  password: string,
}

export default class APIManager {





  // --------------- Notes ---------------

  static async loadNotes() {
    const response = await API.get("/api/notes")
      .catch(error => {
        console.log(error)
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response.status === 409) {
          throw new ConflictError(error.response.data.error)
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      });
    return response.data;
  }

  static async createNote(note: NoteInput): Promise<Note> {
    const response = await API.post("/api/notes", JSON.stringify(note))
      .catch(error => {
        console.log(error)
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response.status === 409) {
          throw new ConflictError(error.response.data.error)
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      });
    return response.data;
  }

  static async updateNote(noteId: string, note: NoteInput): Promise<Note> {
    const response = await API.patch("/api/notes/" + noteId, JSON.stringify(note))
      .catch(error => {
        console.log(error)
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response.status === 409) {
          throw new ConflictError(error.response.data.error)
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      });
    return response.data;
  }

  static async deleteNote(noteId: string) {
    const response = await API.delete("/api/notes/" + noteId)
      .catch(error => {
        console.log(error)
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response.status === 409) {
          throw new ConflictError(error.response.data.error)
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      })
    return response.data;
  }


  // --------------- Users ---------------
  // Need credentials in the header if front and back are on differents domain / sub-domains
  static async getLoggedInUser(): Promise<User> {
    const response = await API.get("/api/users")
      .catch(error => {
        console.log(error)
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response.status === 409) {
          throw new ConflictError(error.response.data.error)
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      })
    return response.data;
  }

  static async signUp(credentials: SignUpCredentials): Promise<User> {
    const response = await API.post("/api/users/signup", JSON.stringify(credentials))
      .catch(error => {
        console.log(error)
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response.status === 409) {
          throw new ConflictError(error.response.data.error)
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      });
    return response.data;
  }

  static async login(credentials: LoginCredentials): Promise<User> {
    const response = await API.post("/api/users/login", JSON.stringify(credentials))
      .catch(error => {
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response.status === 409) {
          throw new ConflictError(error.response.data.error)
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      });
    return response.data;
  }

  static async logout() {
    const response = await API.post("/api/users/logout")
      .catch(error => {
        console.log(error)
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response.status === 409) {
          throw new ConflictError(error.response.data.error)
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      });
    return response.data;
  }


}
