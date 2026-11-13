import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Dashboard } from "../components/dashboard";

vi.mock("@zeaops/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@zeaops/api-client")>()),
  getHealth: vi.fn(async (kind: string) => ({
    status: kind === "live" ? "ok" : "ready",
    service: "zeaops-api",
  })),
}));
afterEach(cleanup);
function mount() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Dashboard />
    </QueryClientProvider>,
  );
}
it("renders real health results and labels future capabilities", async () => {
  mount();
  expect(await screen.findByText("Your control plane is ready")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Infrastructure overview" })).toBeInTheDocument();
  expect(screen.getByText("No production infrastructure is connected.")).toBeInTheDocument();
  expect(screen.getByText("6 planned modules")).toBeInTheDocument();
});
it("opens a read-only module explanation", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: /^Servers$/ }));
  expect(screen.getByRole("heading", { name: "Servers workspace" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to overview" }));
  expect(screen.getByRole("heading", { name: "Infrastructure overview" })).toBeInTheDocument();
});
it("applies validated display preferences", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Display preferences" }));
  fireEvent.change(screen.getByLabelText("Health refresh interval"), { target: { value: "60" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply preference" }));
  expect(await screen.findByText("Preference applied for this session.")).toBeInTheDocument();
});
