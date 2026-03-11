import { RegisterOptions, UseFormRegister } from "react-hook-form";

interface TextInputFieldProps {
  name: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  registerOptions?: RegisterOptions;
  textAreaField?: boolean;
  type?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  [x: string]: unknown;
}

const TextInputField = ({
  name,
  label,
  register,
  registerOptions,
  textAreaField,
  type,
  placeholder,
  className,
  ...props
}: TextInputFieldProps) => {
  return (
    <div className="form-control w-full max-w-xs" id={`${name}-input`}>
      <label className="label">
        <span className="label-text">{label}</span>
      </label>
      {/* if typeInput so input, If typeTextArea so text area etc */}
      {!textAreaField ? (
        <input
          type={type}
          placeholder={placeholder}
          className={className}
          {...props}
          {...register(name, registerOptions)}
        />
      ) : (
        <textarea {...props} {...register(name, registerOptions)} />
      )}

      {/* need a feedback for required */}
    </div>
  );
};

export default TextInputField;
