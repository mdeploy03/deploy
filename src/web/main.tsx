import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";
import { Layout } from "./Layout";
import { Dashboard } from "./pages/Dashboard";
import { Placeholder } from "./pages/Placeholder";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "klanten", element: <Placeholder title="Klanten" step="stap 3" /> },
      { path: "pipeline", element: <Placeholder title="Pipeline" step="stap 4" /> },
      { path: "projecten", element: <Placeholder title="Projecten" step="stap 5" /> },
      { path: "mijn-werk", element: <Placeholder title="Mijn werk" step="stap 5" /> },
      { path: "*", element: <Placeholder title="Pagina niet gevonden" /> },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
