import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";
import { Layout } from "./Layout";
import { Dashboard } from "./pages/Dashboard";
import { Placeholder } from "./pages/Placeholder";
import { Customers } from "./pages/Customers";
import { CustomerDetail } from "./pages/CustomerDetail";
import { Pipeline } from "./pages/Pipeline";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "klanten", element: <Customers /> },
      { path: "klanten/:id", element: <CustomerDetail /> },
      { path: "pipeline", element: <Pipeline /> },
      { path: "projecten", element: <Placeholder title="Projecten" step="stap 5" /> },
      { path: "projecten/:id", element: <Placeholder title="Project" step="stap 5" /> },
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
