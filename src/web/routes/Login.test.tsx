// Component test: the login form renders RTL Persian labels and shows
// validation messages from the shared username rules.
import { render, screen } from "@testing-library/react";
import { expect, it, describe } from "vitest";
import { MemoryRouter } from "react-router";
import { Login } from "./Login";

describe("Login page", () => {
  it("renders Persian labels and a submit button", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getByText("دخل‌وخرج")).toBeTruthy();
    expect(screen.getByText("نام کاربری")).toBeTruthy();
    expect(screen.getByText("رمز عبور")).toBeTruthy();
    expect(screen.getByRole("button", { name: "ورود" })).toBeTruthy();
  });

  it("shows a validation message for an invalid username", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    await user.type(inputByLabel("نام کاربری"), "bad name!");
    await user.type(inputByLabel("رمز عبور"), "long-enough-password");
    const submit = screen.getAllByRole("button", { name: "ورود" })[0]!;
    await user.click(submit);
    expect(await screen.findByText("نام کاربری معتبر نیست.")).toBeTruthy();
  });
});

/** Kashi fields render a visible label and an accessible name; pick the actual input element. */
function inputByLabel(label: string): HTMLElement {
  const matches = screen.getAllByLabelText(label).filter((el) => el.tagName === "INPUT");
  if (matches.length === 0) throw new Error(`input not found: ${label}`);
  return matches[0]!;
}
