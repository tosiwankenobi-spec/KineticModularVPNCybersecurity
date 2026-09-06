import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "./AuthGate";
import { useAuth } from "../lib/auth";

vi.mock("../lib/auth", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function baseAuthValue(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    session: null,
    user: null,
    loading: false,
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUpWithPassword: vi.fn().mockResolvedValue({ error: null, needsEmailConfirmation: false }),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("AuthGate", () => {
  it("shows a loading state while auth is initializing", () => {
    mockedUseAuth.mockReturnValue(baseAuthValue({ loading: true }));
    render(
      <AuthGate>
        <div>Protected content</div>
      </AuthGate>,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("shows the sign-in form when there is no session", () => {
    mockedUseAuth.mockReturnValue(baseAuthValue());
    render(
      <AuthGate>
        <div>Protected content</div>
      </AuthGate>,
    );
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders the protected children when a session exists", () => {
    mockedUseAuth.mockReturnValue(
      baseAuthValue({
        // @ts-expect-error minimal session shape is enough for this test
        session: { user: { id: "u1" } },
      }),
    );
    render(
      <AuthGate>
        <div>Protected content</div>
      </AuthGate>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("switches between sign-in and sign-up modes", async () => {
    mockedUseAuth.mockReturnValue(baseAuthValue());
    const user = userEvent.setup();
    render(
      <AuthGate>
        <div>Protected content</div>
      </AuthGate>,
    );

    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    await user.click(screen.getByText(/need an account/i));
    expect(screen.getByRole("heading", { name: /create an account/i })).toBeInTheDocument();
  });
});
