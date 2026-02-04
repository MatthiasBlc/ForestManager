import { useState, useEffect, useRef, useCallback } from "react";
import { FaPaperPlane } from "react-icons/fa";
import Modal from "../Modal";
import APIManager from "../../network/api";

interface InviteUserModalProps {
  communityId: string;
  onClose: () => void;
  onInviteSent: () => void;
}

const InviteUserModal = ({ communityId, onClose, onInviteSent }: InviteUserModalProps) => {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; username: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  const isEmail = identifier.includes("@");

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 3 || query.includes("@")) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const results = await APIManager.searchUsers(query);
      setSuggestions(results);
      setShowSuggestions(results.length > 0 && results.length <= 5);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = identifier.trim();
    if (trimmed.length >= 3 && !isEmail) {
      const timer = setTimeout(() => searchUsers(trimmed), 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [identifier, isEmail, searchUsers]);

  const handleSelectSuggestion = (username: string) => {
    setIdentifier(username);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveSuggestion(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[activeSuggestion].username);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const payload = isEmail ? { email: trimmed } : { username: trimmed };
      await APIManager.sendInvite(communityId, payload);
      onInviteSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="font-bold text-lg mb-4">Invite a user</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control relative">
          <label className="label">
            <span className="label-text">Username or email</span>
          </label>
          <input
            ref={inputRef}
            type="text"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setActiveSuggestion(-1);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Delay to allow click on suggestion
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            onFocus={() => {
              if (suggestions.length > 0 && suggestions.length <= 5 && !isEmail) {
                setShowSuggestions(true);
              }
            }}
            placeholder="Enter username or email"
            className="input input-bordered w-full"
            autoFocus
            autoComplete="off"
          />

          {showSuggestions && suggestions.length > 0 && (
            <ul
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 z-10 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
            >
              {suggestions.map((user, index) => (
                <li
                  key={user.id}
                  className={`px-4 py-2 cursor-pointer hover:bg-base-200 ${
                    index === activeSuggestion ? "bg-base-200" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(user.username);
                  }}
                >
                  {user.username}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary gap-2"
            disabled={isSubmitting || !identifier.trim()}
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <FaPaperPlane className="w-3 h-3" />
            )}
            Send invitation
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default InviteUserModal;
