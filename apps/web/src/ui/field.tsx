// Field : libelle, champ (ou zone de texte), aide ou erreur reliees au champ.
// Compatible avec register() de react-hook-form (ref transmise).
import { useId, type InputHTMLAttributes, type Ref, type TextareaHTMLAttributes } from "react";

import { cx } from "./cx.ts";

interface CommonProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

type InputProps = CommonProps &
  InputHTMLAttributes<HTMLInputElement> & { multiline?: false; ref?: Ref<HTMLInputElement> };
type TextareaProps = CommonProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    multiline: true;
    ref?: Ref<HTMLTextAreaElement>;
  };

export type FieldProps = InputProps | TextareaProps;

export function Field(props: FieldProps) {
  const generated = useId();
  const { label, hint, error, className, id = generated } = props;
  const hintId = `${id}-hint`;
  const describedBy = error || hint ? hintId : undefined;
  const control = (() => {
    if (props.multiline) {
      const { label: _l, hint: _h, error: _e, className: _c, multiline: _m, ...rest } = props;
      return (
        <textarea
          {...rest}
          id={id}
          className="fm-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      );
    }
    const { label: _l, hint: _h, error: _e, className: _c, multiline: _m, ...rest } = props;
    return (
      <input
        {...rest}
        id={id}
        className="fm-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
    );
  })();
  return (
    <div className={cx("fm-field", error && "fm-field-error", className)}>
      <label className="fm-label" htmlFor={id}>
        {label}
      </label>
      {control}
      {error || hint ? (
        <span className="fm-hint" id={hintId}>
          {error ?? hint}
        </span>
      ) : null}
    </div>
  );
}
