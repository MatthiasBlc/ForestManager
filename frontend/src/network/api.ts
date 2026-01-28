import axios from "axios";
import { RecipeDetail, RecipesResponse, TagSearchResult, IngredientSearchResult } from "../models/recipe";
import { User } from "../models/user";
import { AdminLoginResponse, AdminTotpResponse, AdminUser, DashboardStats } from "../models/admin";
import { ConflictError, UnauthorizedError } from "../errors/http_errors";

const apiUrl = import.meta.env.VITE_BACKEND_URL;
// eslint-disable-next-line react-refresh/only-export-components
const API = axios.create({ withCredentials: true, baseURL: apiUrl });

API.interceptors.request.use((config) => {
  config.headers["Content-Type"] = "application/json";
  return config;
});


export interface RecipeInput {
  title: string;
  content: string;
  imageUrl?: string;
  tags?: string[];
  ingredients?: { name: string; quantity?: string }[];
}

export interface GetRecipesParams {
  limit?: number;
  offset?: number;
  tags?: string[];
  search?: string;
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




  // --------------- Recipes ---------------

  static async getRecipes(params: GetRecipesParams = {}): Promise<RecipesResponse> {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set("limit", params.limit.toString());
    if (params.offset) queryParams.set("offset", params.offset.toString());
    if (params.tags && params.tags.length > 0) queryParams.set("tags", params.tags.join(","));
    if (params.search) queryParams.set("search", params.search);

    const queryString = queryParams.toString();
    const url = `/api/recipes${queryString ? `?${queryString}` : ""}`;

    const response = await API.get(url)
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

  // Legacy method for backwards compatibility
  static async loadRecipes() {
    const response = await this.getRecipes();
    return response.data;
  }

  static async getRecipe(recipeId: string): Promise<RecipeDetail> {
    const response = await API.get(`/api/recipes/${recipeId}`)
      .catch(error => {
        console.log(error)
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response.status === 404) {
          throw new Error("Recipe not found");
        } else if (error.response.status === 403) {
          throw new Error("Cannot access this recipe");
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      });
    return response.data;
  }

  static async createRecipe(recipe: RecipeInput): Promise<RecipeDetail> {
    const response = await API.post("/api/recipes", JSON.stringify(recipe))
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

  static async updateRecipe(recipeId: string, recipe: Partial<RecipeInput>): Promise<RecipeDetail> {
    const response = await API.patch("/api/recipes/" + recipeId, JSON.stringify(recipe))
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

  static async deleteRecipe(recipeId: string) {
    const response = await API.delete("/api/recipes/" + recipeId)
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


  // --------------- Tags ---------------

  static async searchTags(search: string = "", limit: number = 20): Promise<TagSearchResult[]> {
    const queryParams = new URLSearchParams();
    if (search) queryParams.set("search", search);
    if (limit) queryParams.set("limit", limit.toString());

    const queryString = queryParams.toString();
    const url = `/api/tags${queryString ? `?${queryString}` : ""}`;

    const response = await API.get(url)
      .catch(error => {
        console.log(error)
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      });
    return response.data.data;
  }


  // --------------- Ingredients ---------------

  static async searchIngredients(search: string = "", limit: number = 20): Promise<IngredientSearchResult[]> {
    const queryParams = new URLSearchParams();
    if (search) queryParams.set("search", search);
    if (limit) queryParams.set("limit", limit.toString());

    const queryString = queryParams.toString();
    const url = `/api/ingredients${queryString ? `?${queryString}` : ""}`;

    const response = await API.get(url)
      .catch(error => {
        console.log(error)
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      });
    return response.data.data;
  }


  // --------------- Users Auth ---------------
  // Need credentials in the header if front and back are on differents domain / sub-domains
  static async getLoggedInUser(): Promise<User> {
    const response = await API.get("/api/auth/me")
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
    return response.data.user;
  }

  static async signUp(credentials: SignUpCredentials): Promise<User> {
    const response = await API.post("/api/auth/signup", JSON.stringify(credentials))
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
    return response.data.user;
  }

  static async login(credentials: LoginCredentials): Promise<User> {
    const response = await API.post("/api/auth/login", JSON.stringify(credentials))
      .catch(error => {
        if (error.response.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response.status === 409) {
          throw new ConflictError(error.response.data.error)
        } else {
          throw Error(`Request failed with status: ${error.response.status} message ${error.response.data.error}`);
        }
      });
    return response.data.user;
  }

  static async logout() {
    const response = await API.post("/api/auth/logout")
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


  // --------------- Admin Auth ---------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
    const response = await API.post("/api/admin/auth/login", JSON.stringify({ email, password }))
      .catch((error: any) => {
        if (error.response?.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response?.status === 429) {
          throw new Error(error.response.data.error || "Too many login attempts");
        } else {
          throw new Error(error.response?.data?.error || "Login failed");
        }
      });
    return response.data;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async adminVerifyTotp(code: string): Promise<AdminTotpResponse> {
    const response = await API.post("/api/admin/auth/totp/verify", JSON.stringify({ code }))
      .catch((error: any) => {
        if (error.response?.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else if (error.response?.status === 429) {
          throw new Error(error.response.data.error || "Too many attempts");
        } else {
          throw new Error(error.response?.data?.error || "TOTP verification failed");
        }
      });
    return response.data;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async adminLogout(): Promise<void> {
    await API.post("/api/admin/auth/logout")
      .catch((error: any) => {
        throw new Error(error.response?.data?.error || "Logout failed");
      });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async getLoggedInAdmin(): Promise<AdminUser> {
    const response = await API.get("/api/admin/auth/me")
      .catch((error: any) => {
        if (error.response?.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else {
          throw new Error(error.response?.data?.error || "Failed to get admin info");
        }
      });
    return response.data.admin;
  }


  // --------------- Admin Dashboard ---------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async getAdminDashboardStats(): Promise<DashboardStats> {
    const response = await API.get("/api/admin/dashboard/stats")
      .catch((error: any) => {
        if (error.response?.status === 401) {
          throw new UnauthorizedError(error.response.data.error);
        } else {
          throw new Error(error.response?.data?.error || "Failed to load dashboard");
        }
      });
    return response.data;
  }

}
