import { useState } from "react";
import { FaSave } from "react-icons/fa";
import APIManager from "../../network/api";

interface CommunityEditFormProps {
  communityId: string;
  initialName: string;
  initialDescription: string;
  onSaved: () => void;
  onCancel: () => void;
}

const CommunityEditForm = ({
  communityId,
  initialName,
  initialDescription,
  onSaved,
  onCancel,
}: CommunityEditFormProps) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      setIsSaving(true);
      setError(null);
      await APIManager.updateCommunity(communityId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update community");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      )}
      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Name *</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Community name"
          className="input input-bordered input-sm w-full"
          disabled={isSaving}
        />
      </div>
      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Description</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your community..."
          rows={4}
          className="textarea textarea-bordered textarea-sm w-full"
          disabled={isSaving}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          className="btn btn-primary btn-sm gap-2"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
        >
          {isSaving ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <FaSave className="w-3 h-3" />
          )}
          Save
        </button>
      </div>
    </div>
  );
};

export default CommunityEditForm;
