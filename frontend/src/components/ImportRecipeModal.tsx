import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import Modal from "./Modal";
import { parseRecipeText, ParsedRecipe } from "../services/recipeParser";
import APIManager from "../network/api";

interface ImportRecipeModalProps {
  onImport: (parsed: ParsedRecipe) => void;
  onClose: () => void;
}

const ImportRecipeModal = ({ onImport, onClose }: ImportRecipeModalProps) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUrl = /^https?:\/\//i.test(input.trim());
  const canAnalyze = input.trim().length > 0 && !isLoading;

  const handleAnalyze = async () => {
    setError(null);
    const trimmed = input.trim();

    if (isUrl) {
      // Import URL via backend
      try {
        setIsLoading(true);
        const parsed = await APIManager.importRecipeFromUrl(trimmed);
        onImport(parsed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        if (msg.includes("IMPORT_001")) {
          setError("URL invalide");
        } else if (msg.includes("IMPORT_002")) {
          setError("Impossible d'acceder a cette URL");
        } else if (msg.includes("IMPORT_003")) {
          setError("Aucune recette detectee sur cette page");
        } else {
          setError("Erreur de connexion");
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // Import texte via parser local
      const parsed = parseRecipeText(trimmed);

      const hasContent = parsed.title || parsed.ingredients.length > 0 || parsed.steps.length > 0;

      if (!hasContent) {
        setError("Aucune recette detectee dans le texte. Verifiez le format.");
        return;
      }

      onImport(parsed);
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Importer une recette</h3>
        <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onClose}>
          <FaTimes />
        </button>
      </div>

      <textarea
        className="textarea textarea-bordered w-full min-h-[200px] resize-y"
        placeholder={"Collez un texte de recette ou une URL (ex: https://marmiton.org/...)"}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setError(null);
        }}
        disabled={isLoading}
      />

      {isUrl && (
        <p className="text-sm text-base-content/60 mt-1">
          URL detectee — l'import se fera via le site web
        </p>
      )}

      {error && (
        <div className="alert alert-error mt-3 py-2">
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="modal-action">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canAnalyze}
          onClick={handleAnalyze}
        >
          {isLoading ? <span className="loading loading-spinner loading-sm" /> : "Analyser"}
        </button>
      </div>
    </Modal>
  );
};

export default ImportRecipeModal;
