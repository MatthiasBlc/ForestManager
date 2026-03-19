import toast from "react-hot-toast";

export function toastError(err: unknown, fallback = "An error occurred") {
  toast.error(err instanceof Error ? err.message : fallback);
}
