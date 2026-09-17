export function Alert({ error, children }) {
  const text = children ?? error?.message;
  if (!text) return null;
  return (
    <p className="alert" role="alert">
      {text}
    </p>
  );
}
