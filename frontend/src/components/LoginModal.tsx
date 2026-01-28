import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LoginCredentials } from "../network/api";
import Modal from "./Modal";
import TextInputField from "./form/TextInputField";

const LoginModal = () => {
  const { showLoginModal, closeLoginModal, login, error, clearError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LoginCredentials>();

  if (!showLoginModal) {
    return null;
  }

  async function onSubmit(credentials: LoginCredentials) {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await login(credentials.username, credentials.password);
      reset();
    } catch (err) {
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError("Login failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setLocalError(null);
    clearError();
    reset();
    closeLoginModal();
  }

  function handleSignUpClick() {
    handleClose();
  }

  const displayError = localError || error;

  return (
    <div className="container">
      <Modal onClose={handleClose}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Log In</h3>
          <button
            type="button"
            className="btn btn-sm btn-circle btn-ghost"
            onClick={handleClose}
          >
            X
          </button>
        </div>

        {displayError && (
          <div className="alert alert-error mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{displayError}</span>
          </div>
        )}

        <form id="logInForm" onSubmit={handleSubmit(onSubmit)}>
          <TextInputField
            name="username"
            label="Username"
            type="text"
            placeholder="Username"
            className="input input-bordered w-full"
            required
            register={register}
            registerOptions={{ required: "Required" }}
            error={errors.username}
          />
          <TextInputField
            name="password"
            label="Password"
            type="password"
            placeholder="Password"
            className="input input-bordered w-full"
            required
            register={register}
            registerOptions={{ required: "Required" }}
            error={errors.password}
          />
          <div className="modal-action flex-col gap-2">
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                "Log In"
              )}
            </button>
            <p className="text-center text-sm text-base-content/70 mt-2">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="link link-primary"
                onClick={handleSignUpClick}
              >
                Create one
              </Link>
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LoginModal;
