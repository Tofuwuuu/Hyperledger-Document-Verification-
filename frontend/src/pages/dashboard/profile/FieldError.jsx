// Inline validation message under a profile field.
export default function FieldError({ name, errors }) {
  return errors[name] ? (
    <p className="mt-1 text-sm text-red-600">{errors[name]}</p>
  ) : null;
}
