import { test, expect } from "@playwright/test";

test.describe("Authentication flows", () => {
  test("user can sign in with valid credentials", async ({ page }) => {
    await page.goto("https://app.example.com/login");
    await page.getByLabel("Email address").fill("user@example.com");
    await page.getByLabel("Password").fill("SecurePass123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("shows error message with wrong password", async ({ page }) => {
    await page.goto("https://app.example.com/login");
    await page.getByLabel("Email address").fill("user@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL(/login/);
  });

  test("user can reset password via email", async ({ page }) => {
    await page.goto("https://app.example.com/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/forgot-password/);
    await page.getByLabel("Email address").fill("user@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
  });
});

test.describe("Checkout flow", () => {
  test("user can add item to cart and checkout", async ({ page }) => {
    await page.goto("https://app.example.com/products");
    await page.getByRole("button", { name: "Add to cart" }).first().click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.getByRole("link", { name: "View cart" }).click();
    await expect(page).toHaveURL(/cart/);
    await page.getByRole("button", { name: "Proceed to checkout" }).click();
    await page.getByLabel("Card number").fill("4242424242424242");
    await page.getByLabel("Expiry date").fill("12/26");
    await page.getByLabel("CVV").fill("123");
    await page.getByRole("button", { name: "Complete purchase" }).click();
    await expect(page.getByText("Order confirmed")).toBeVisible();
  });

  test("cart persists across page refresh", async ({ page }) => {
    await page.goto("https://app.example.com/products");
    await page.getByRole("button", { name: "Add to cart" }).first().click();
    await page.reload();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
  });
});

test.describe("User profile", () => {
  test("user can update their display name", async ({ page }) => {
    await page.goto("https://app.example.com/profile");
    await page.getByLabel("Display name").clear();
    await page.getByLabel("Display name").fill("Jane Smith");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Profile updated")).toBeVisible();
    await expect(page.getByLabel("Display name")).toHaveValue("Jane Smith");
  });
});
