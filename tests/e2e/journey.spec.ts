// E2E (brief §3.6): register → save recovery codes → create account →
// add expense → transfer → create budget → view report → debt with
// repayment → reload persistence → delete account.
import { expect, test } from "@playwright/test";

const username = `e2e${Math.random().toString(36).slice(2, 8)}`;
const password = "e2e-password-123";

test.describe.serial("full user journey", () => {
  test("register and save recovery codes", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("نام کاربری").fill(username);
    await page.getByLabel("رمز عبور", { exact: false }).first().fill(password);
    await page.getByLabel("تکرار رمز عبور").fill(password);
    await page.getByRole("button", { name: "ثبت‌نام" }).click();

    // Recovery codes are shown exactly once.
    await expect(page.getByRole("heading", { name: "کدهای بازیابی" })).toBeVisible();
    await page.getByText("کدها را در جای امن ذخیره کردم").click();
    await page.getByRole("button", { name: "ادامه" }).click();
    await expect(page.getByRole("heading", { name: "خانه" })).toBeVisible();
  });

  test("creates the first account from the empty dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("نام کاربری").fill(username);
    await page.getByLabel("رمز عبور", { exact: false }).first().fill(password);
    await page.getByRole("button", { name: "ورود" }).click();

    await expect(page.getByText("هنوز چیزی ثبت نکرده‌اید")).toBeVisible();
    await page.getByRole("button", { name: "افزودن حساب" }).click();
    // Lands on /accounts; open the create dialog there.
    await expect(page).toHaveURL(/\/accounts/);
    await page.getByRole("button", { name: "افزودن حساب" }).first().click();
    await page.getByLabel("نام حساب").fill("بانک تست");
    await page.getByLabel("موجودی اولیه").fill("۵٬۰۰۰٬۰۰۰");
    await page.getByRole("button", { name: "ذخیره" }).click();
    await expect(page.getByText("بانک تست").first()).toBeVisible();
    // Back on the dashboard the empty state switches to "record your first transaction".
    await page.goto("/dashboard");
    await expect(page.getByText("اولین درآمد یا هزینهٔ خود را ثبت کنید")).toBeVisible();
  });

  test("adds an expense in three interactions and sees it on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("نام کاربری").fill(username);
    await page.getByLabel("رمز عبور", { exact: false }).first().fill(password);
    await page.getByRole("button", { name: "ورود" }).click();

    await page.goto("/transactions/new");
    await page.getByLabel("مبلغ").fill("۳۵۰٬۰۰۰");
    // Kashi Select: open the listbox, pick the option.
    await page.getByLabel("حساب").click();
    await page.getByRole("option", { name: "بانک تست" }).click();
    await page.getByRole("button", { name: "ثبت" }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByText("۳۵۰٬۰۰۰").first()).toBeVisible();

    // Opening 5,000,000 Toman (50,000,000 Rial) − expense 3,500,000 Rial
    // = 46,500,000 Rial = ۴٬۶۵۰٬۰۰۰ تومان. Kashi Money renders the number
    // aria-hidden; assert via the data value (Toman).
    await page.goto("/dashboard");
    await expect(page.locator(".k-money").first()).toHaveAttribute("value", "4650000");
  });

  test("makes a transfer that never appears as income or expense", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("نام کاربری").fill(username);
    await page.getByLabel("رمز عبور", { exact: false }).first().fill(password);
    await page.getByRole("button", { name: "ورود" }).click();

    await page.goto("/accounts");
    await page.getByRole("button", { name: "افزودن حساب" }).first().click();
    await page.getByLabel("نام حساب").fill("کیف پول");
    await page.getByRole("button", { name: "ذخیره" }).click();
    await expect(page.getByText("کیف پول").first()).toBeVisible();

    await page.goto("/transactions/new");
    await page.getByText("انتقال", { exact: true }).click();
    await page.getByLabel("مبلغ").fill("۲۰۰٬۰۰۰");
    await page.getByLabel("از حساب").click();
    await page.getByRole("option", { name: "بانک تست" }).click();
    await page.getByLabel("به حساب").click();
    await page.getByRole("option", { name: "کیف پول" }).click();
    await page.getByRole("button", { name: "ثبت" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // The money moved exactly: bank 46,500,000 − 2,000,000 = 44,500,000 Rial
    // (۴٬۴۵۰٬۰۰۰ تومان) and wallet 2,000,000 Rial (۲۰۰٬۰۰۰ تومان).
    await page.goto("/accounts");
    await expect(page.locator(".k-money").nth(0)).toHaveAttribute("value", "4450000");
    await expect(page.locator(".k-money").nth(1)).toHaveAttribute("value", "200000");
  });

  test("creates a budget and views the report", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("نام کاربری").fill(username);
    await page.getByLabel("رمز عبور", { exact: false }).first().fill(password);
    await page.getByRole("button", { name: "ورود" }).click();

    await page.goto("/budgets");
    await page.getByRole("button", { name: "بودجهٔ جدید" }).click();
    await page.getByLabel("سقف ماهانه").fill("۱٬۰۰۰٬۰۰۰");
    await page.getByLabel("دسته‌بندی‌ها").selectOption({ index: 1 });
    await page.getByRole("button", { name: "ثبت بودجه" }).click();
    await expect(page.getByText("مصرف شده").first()).toBeVisible();

    await page.goto("/reports");
    await expect(page.getByText("خالص")).toBeVisible();
  });

  test("records a debt with a repayment and the remaining balance updates", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("نام کاربری").fill(username);
    await page.getByLabel("رمز عبور", { exact: false }).first().fill(password);
    await page.getByRole("button", { name: "ورود" }).click();

    await page.goto("/debts");
    await page.getByRole("button", { name: "افزودن" }).click();
    const debtDlg = page.getByLabel("بدهی یا طلب جدید");
    await debtDlg.getByLabel("مبلغ").fill("۱٬۰۰۰٬۰۰۰");
    await debtDlg.getByLabel("طرف‌حساب تازه").fill("علی رضایی");
    await debtDlg.getByRole("button", { name: "ثبت" }).click();
    await expect(page.getByText("بدهی من").first()).toBeVisible();

    await page.getByRole("button", { name: "بازپرداخت" }).click();
    const dlg = page.getByLabel("ثبت بازپرداخت");
    await dlg.getByLabel("مبلغ").fill("۴۰۰٬۰۰۰");
    await dlg.getByLabel("حساب").click();
    await page.getByRole("option", { name: "بانک تست" }).click();
    await dlg.getByRole("button", { name: "ثبت" }).click();
    await expect(page.locator(".k-money").first()).toHaveAttribute("value", "600000");
  });

  test("data persists after a full reload and logout", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("نام کاربری").fill(username);
    await page.getByLabel("رمز عبور", { exact: false }).first().fill(password);
    await page.getByRole("button", { name: "ورود" }).click();

    await page.goto("/accounts");
    await page.reload();
    await expect(page.getByText("بانک تست")).toBeVisible();

    // Sign out and sign back in — data still there.
    await page.getByRole("button", { name: "خروج" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("نام کاربری").fill(username);
    await page.getByLabel("رمز عبور", { exact: false }).first().fill(password);
    await page.getByRole("button", { name: "ورود" }).click();
    await page.goto("/accounts");
    await expect(page.getByText("بانک تست")).toBeVisible();
  });

  test("deletes the account completely", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("نام کاربری").fill(username);
    await page.getByLabel("رمز عبور", { exact: false }).first().fill(password);
    await page.getByRole("button", { name: "ورود" }).click();

    await page.goto("/settings");
    await page.getByRole("button", { name: "حذف کامل حساب" }).click();
    await page.getByLabel("تأیید").fill("حذف حساب");
    await page.getByRole("button", { name: "حذف همیشگی" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // The user can no longer sign in.
    await page.getByLabel("نام کاربری").fill(username);
    await page.getByLabel("رمز عبور", { exact: false }).first().fill(password);
    await page.getByRole("button", { name: "ورود" }).click();
    await expect(page.getByText("نام کاربری یا رمز عبور درست نیست.")).toBeVisible();
  });
});
