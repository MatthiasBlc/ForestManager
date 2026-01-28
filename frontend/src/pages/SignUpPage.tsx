import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { SignUpCredentials } from "../network/api";
import TextInputField from "../components/form/TextInputField";

// Password strength calculation
function calculatePasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "Weak", color: "bg-error" };
  if (score <= 4) return { score, label: "Medium", color: "bg-warning" };
  return { score, label: "Strong", color: "bg-success" };
}

const SignUpPage = () => {
  const { user, isLoading, signUp, openLoginModal } = useAuth();
  const navigate = useNavigate();
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpCredentials>();

  const password = watch("password", "");
  const passwordStrength = useMemo(() => calculatePasswordStrength(password || ""), [password]);

  // Redirect if already logged in
  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  async function onSubmit(credentials: SignUpCredentials) {
    setErrorText(null);
    setIsSubmitting(true);
    try {
      await signUp(credentials.username, credentials.email, credentials.password);
      navigate("/");
    } catch (error) {
      if (error instanceof Error) {
        setErrorText(error.message);
      } else {
        setErrorText("Sign up failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLoginClick() {
    openLoginModal();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold justify-center mb-4">
            Create an Account
          </h2>

          {errorText && (
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
              <span>{errorText}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextInputField
              name="username"
              label="Username"
              type="text"
              placeholder="Enter your username"
              className="input input-bordered w-full"
              required
              register={register}
              registerOptions={{
                required: "Username is required",
                minLength: {
                  value: 3,
                  message: "Username must be at least 3 characters",
                },
                pattern: {
                  value: /^[a-zA-Z0-9_]+$/,
                  message: "Username can only contain letters, numbers, and underscores",
                },
              }}
              error={errors.username}
            />

            <TextInputField
              name="email"
              label="Email"
              type="email"
              placeholder="Enter your email"
              className="input input-bordered w-full"
              required
              register={register}
              registerOptions={{
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address",
                },
              }}
              error={errors.email}
            />

            <div>
              <TextInputField
                name="password"
                label="Password"
                type="password"
                placeholder="Enter your password"
                className="input input-bordered w-full"
                required
                register={register}
                registerOptions={{
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                }}
                error={errors.password}
              />
              {password && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                        style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-base-content/70">
                      {passwordStrength.label}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                "Sign Up"
              )}
            </button>
          </form>

          <div className="divider">OR</div>

          <p className="text-center text-base-content/70">
            Already have an account?{" "}
            <button
              type="button"
              className="link link-primary"
              onClick={handleLoginClick}
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
