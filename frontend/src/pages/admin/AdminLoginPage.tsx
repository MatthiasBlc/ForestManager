import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../../contexts/AdminAuthContext";
import TextInputField from "../../components/form/TextInputField";

interface CredentialsForm {
  email: string;
  password: string;
}

interface TotpForm {
  code: string;
}

function AdminLoginPage() {
  const { admin, authStep, qrCode, error, loginStep1, loginStep2, clearError } = useAdminAuth();
  const [localStep, setLocalStep] = useState<"credentials" | "totp">("credentials");
  const [showQrCode, setShowQrCode] = useState(false);

  const credentialsForm = useForm<CredentialsForm>();
  const totpForm = useForm<TotpForm>();

  // Redirect if already authenticated
  if (admin && authStep === "authenticated") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  async function onCredentialsSubmit(data: CredentialsForm) {
    clearError();
    try {
      const result = await loginStep1(data.email, data.password);
      setLocalStep("totp");
      if (result.requiresTotpSetup) {
        setShowQrCode(true);
      }
    } catch {
      // Error is handled by context
    }
  }

  async function onTotpSubmit(data: TotpForm) {
    clearError();
    try {
      await loginStep2(data.code);
      // Redirect will happen automatically via the check above
    } catch {
      // Error is handled by context
      totpForm.reset();
    }
  }

  function goBackToCredentials() {
    setLocalStep("credentials");
    setShowQrCode(false);
    clearError();
    credentialsForm.reset();
    totpForm.reset();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold text-center justify-center mb-4">
            Admin Login
          </h2>

          {error && (
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
              <span>{error}</span>
            </div>
          )}

          {localStep === "credentials" && (
            <form onSubmit={credentialsForm.handleSubmit(onCredentialsSubmit)}>
              <TextInputField
                name="email"
                label="Email"
                type="email"
                placeholder="admin@example.com"
                className="input input-bordered w-full"
                required
                register={credentialsForm.register}
                registerOptions={{ required: "Email is required" }}
                error={credentialsForm.formState.errors.email}
              />

              <TextInputField
                name="password"
                label="Password"
                type="password"
                placeholder="********"
                className="input input-bordered w-full"
                required
                register={credentialsForm.register}
                registerOptions={{ required: "Password is required" }}
                error={credentialsForm.formState.errors.password}
              />

              <div className="form-control mt-6">
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={credentialsForm.formState.isSubmitting}
                >
                  {credentialsForm.formState.isSubmitting ? (
                    <span className="loading loading-spinner"></span>
                  ) : (
                    "Continue"
                  )}
                </button>
              </div>
            </form>
          )}

          {localStep === "totp" && (
            <div>
              {showQrCode && qrCode && (
                <div className="mb-6">
                  <div className="alert alert-info mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      className="stroke-current shrink-0 w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
                      First time setup: Scan this QR code with your authenticator app
                      (Google Authenticator, Authy, etc.)
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <img
                      src={qrCode}
                      alt="TOTP QR Code"
                      className="border-4 border-base-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {!showQrCode && (
                <p className="text-center text-base-content/70 mb-4">
                  Enter the 6-digit code from your authenticator app
                </p>
              )}

              <form onSubmit={totpForm.handleSubmit(onTotpSubmit)}>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Verification Code</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    className="input input-bordered w-full text-center text-2xl tracking-widest"
                    {...totpForm.register("code", {
                      required: "Code is required",
                      minLength: { value: 6, message: "Code must be 6 digits" },
                      maxLength: { value: 6, message: "Code must be 6 digits" },
                      pattern: { value: /^[0-9]+$/, message: "Code must be numbers only" },
                    })}
                  />
                  {totpForm.formState.errors.code && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {totpForm.formState.errors.code.message}
                      </span>
                    </label>
                  )}
                </div>

                <div className="form-control mt-6">
                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    disabled={totpForm.formState.isSubmitting}
                  >
                    {totpForm.formState.isSubmitting ? (
                      <span className="loading loading-spinner"></span>
                    ) : (
                      "Verify"
                    )}
                  </button>
                </div>
              </form>

              <div className="divider"></div>

              <button
                type="button"
                className="btn btn-ghost btn-sm w-full"
                onClick={goBackToCredentials}
              >
                Back to login
              </button>
            </div>
          )}

          <div className="text-center mt-4 text-xs text-base-content/50">
            Admin access only - Unauthorized access is prohibited
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLoginPage;
