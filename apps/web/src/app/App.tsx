import { Route, Routes } from "react-router";

// Routes de l'application (completees par le shell et les ecrans en C2.4 et suivants).
export function App() {
  return (
    <Routes>
      <Route path="*" element={<main className="fm-root p-4" />} />
    </Routes>
  );
}
