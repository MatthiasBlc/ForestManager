import { useState, useEffect, useRef } from "react";
import { FaSave } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import APIManager from "../network/api";

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();

  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const profileTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const passwordTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (profileTimerRef.current) clearTimeout(profileTimerRef.current);
      if (passwordTimerRef.current) clearTimeout(passwordTimerRef.current);
    };
  }, []);

  const showProfileSuccess = (msg: string) => {
    setProfileSuccess(msg);
    profileTimerRef.current = setTimeout(() => setProfileSuccess(null), 3000);
  };

  const showPasswordSuccess = (msg: string) => {
    setPasswordSuccess(msg);
    passwordTimerRef.current = setTimeout(() => setPasswordSuccess(null), 3000);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const updates: { username?: string; email?: string } = {};
    if (username !== user?.username) updates.username = username;
    if (email !== user?.email) updates.email = email;

    if (Object.keys(updates).length === 0) {
      setProfileError("No changes to save");
      return;
    }

    try {
      setProfileLoading(true);
      await APIManager.updateProfile(updates);
      await refreshUser();
      showProfileSuccess("Profile updated successfully");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    try {
      setPasswordLoading(true);
      await APIManager.updateProfile({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showPasswordSuccess("Password changed successfully");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      {/* Profile Info */}
      <div className="bg-base-100 rounded-lg shadow-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Account Information</h2>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Username</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input input-bordered"
              required
              minLength={3}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Email</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered"
              required
            />
          </div>

          {profileError && (
            <div className="alert alert-error py-2">
              <span>{profileError}</span>
            </div>
          )}
          {profileSuccess && (
            <div className="alert alert-success py-2">
              <span>{profileSuccess}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary gap-2" disabled={profileLoading}>
            {profileLoading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <FaSave className="w-4 h-4" />
            )}
            Save changes
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-base-100 rounded-lg shadow-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Current password</span>
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input input-bordered"
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">New password</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input input-bordered"
              required
              minLength={8}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Confirm new password</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input input-bordered"
              required
              minLength={8}
            />
          </div>

          {passwordError && (
            <div className="alert alert-error py-2">
              <span>{passwordError}</span>
            </div>
          )}
          {passwordSuccess && (
            <div className="alert alert-success py-2">
              <span>{passwordSuccess}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary gap-2" disabled={passwordLoading}>
            {passwordLoading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <FaSave className="w-4 h-4" />
            )}
            Change password
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
