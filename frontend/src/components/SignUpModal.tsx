import { useState } from "react";
import { useForm } from "react-hook-form";
import { User } from "../models/user";
import APIManager, { SignUpCredentials } from "../network/api";
import styleUtils from "../styles/utils.module.css";
import Modal from "./Modal";
import TextInputField from "./form/TextInputField";
import { ConflictError } from "../errors/http_errors";

interface SignUpModalProps {
  onDismiss: () => void;
  onSignUpSuccessful: (user: User) => void;
}

const SignUpModal = ({ onDismiss, onSignUpSuccessful }: SignUpModalProps) => {
  const [errorText, setErrorText] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpCredentials>();

  async function onSubmit(credentials: SignUpCredentials) {
    try {
      const newUser = await APIManager.signUp(credentials);
      onSignUpSuccessful(newUser);
    } catch (error) {
      if (error instanceof ConflictError) {
        setErrorText(error.message);
      } else {
        alert(error);
      }
      console.error(error);
    }
  }

  return (
    <div className="container">
      <Modal onClose={onDismiss}>
        <h3 className="font-bold text-lg">
          Sign Up
          <button className="btn btn-primary" onClick={onDismiss}>
            close
          </button>
        </h3>
        {errorText && (
          <div className="alert alert-error">
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
            <span>{errorText}</span>
          </div>
        )}
        <form id="signUpForm" onSubmit={handleSubmit(onSubmit)}>
          <TextInputField
            name="username"
            label="Username"
            type="text"
            placeholder="Username"
            className="input input-bordered w-full max-w-xs"
            required
            register={register}
            registerOptions={{ required: "Required" }}
            error={errors.username}
          />
          <TextInputField
            name="email"
            label="Email"
            type="email"
            placeholder="Email"
            className="input input-bordered w-full max-w-xs"
            required
            register={register}
            registerOptions={{ required: "Required" }}
            error={errors.email}
          />
          <TextInputField
            name="password"
            label="Password"
            type="password"
            placeholder="Password"
            className="input input-bordered w-full max-w-xs"
            required
            register={register}
            registerOptions={{ required: "Required" }}
            error={errors.password}
          />
          <div className="modal-action">
            <button
              type="submit"
              className={`btn btn-primary ${styleUtils.width100}`}
              disabled={isSubmitting}
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SignUpModal;
