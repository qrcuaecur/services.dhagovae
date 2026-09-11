import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, makePdf, makeSpoofedPdf } from "./fixtures";

const DOC_TITLE = `Annual Safety Report ${Date.now()}`;
const DOC_NUMBER = "DOC-2026-001";

/** Filled in by the upload test and reused by everything after it. */
let documentId = "";

/**
 * Drives the real "Choose file" dialog rather than setting the input's files
 * directly, so the test exercises the same path a person does.
 */
async function chooseFile(page: Page, path: string) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Choose file" }).click(),
  ]);
  await chooser.setFiles(path);
}

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin/dashboard");
}

test.describe.configure({ mode: "serial" });

test.describe("public surface stays separate from admin", () => {
  test("the site root shows nothing", async ({ request }) => {
    const response = await request.get("/", { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });

  test("bare /admin shows nothing, not the login form", async ({ request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });
    // A 404, not a redirect to /admin/login: the portal isn't advertised.
    expect(response.status()).toBe(404);
  });

  test("robots.txt does not advertise the admin path", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain("/admin");
  });

  test("protected routes bounce anonymous visitors to the login page", async ({ page }) => {
    await page.goto("/admin/documents");
    await expect(page).toHaveURL(/\/admin\/login\?redirectTo=%2Fadmin%2Fdocuments/);
  });

  test("admin API rejects unauthenticated calls", async ({ request }) => {
    const upload = await request.post("/api/admin/documents/upload-url", {
      data: { fileName: "x.pdf", fileSize: 100, fileType: "application/pdf" },
    });
    expect(upload.status()).toBe(401);

    const finalise = await request.post("/api/admin/documents", { data: { id: crypto.randomUUID() } });
    expect(finalise.status()).toBe(401);
  });
});

test.describe("authentication", () => {
  test("wrong password gives a generic failure", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    const error = page.locator("#login-error");
    await expect(error).toBeVisible();
    // Must not reveal whether the account exists.
    await expect(error).toContainText("Invalid email or password");
  });

  test("correct credentials reach the dashboard", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("an authenticated admin is redirected away from the login page", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });
});

test.describe("upload", () => {
  test("rejects a file whose bytes do not match its extension", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/documents/new");

    await chooseFile(page, makeSpoofedPdf());
    await page.getByLabel(/Document title/).fill("Spoofed file");
    await page.getByRole("button", { name: "Upload document" }).click();

    await expect(page.getByRole("alert").filter({ hasText: /don't match its type/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("uploads a real PDF and lands on its detail page", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/documents/new");

    await chooseFile(page, makePdf());
    await expect(page.getByText("safety-report.pdf")).toBeVisible();

    await page.getByLabel(/Document title/).fill(DOC_TITLE);
    await page.getByLabel("Document number").fill(DOC_NUMBER);
    await page.getByLabel("Version").fill("1.0");
    await page.getByLabel("Category").fill("Safety");
    await page.getByLabel("Description").fill("Annual safety and compliance report.");
    await page.getByLabel("Tags").fill("safety, compliance");

    await page.getByRole("button", { name: "Upload document" }).click();

    await page.waitForURL(/\/admin\/documents\/[0-9a-f-]{36}/, { timeout: 45_000 });
    documentId = page.url().split("/").pop()!;
    expect(documentId).toMatch(/^[0-9a-f-]{36}$/);

    await expect(page.getByRole("heading", { name: DOC_TITLE })).toBeVisible();
    await expect(page.getByRole("heading", { name: "QR code" })).toBeVisible();
  });

  test("the QR encodes the public document URL, not a storage URL", async ({ page }) => {
    await signIn(page);
    await page.goto(`/admin/documents/${documentId}`);

    const link = page.locator("code").first();
    const text = (await link.textContent())?.trim() ?? "";

    expect(text).toContain(`/document/${documentId}`);
    expect(text).not.toContain("supabase");
    expect(text).not.toContain("storage");
  });

  test("QR downloads work in both formats", async ({ page }) => {
    await signIn(page);

    const svg = await page.request.get(`/api/admin/documents/${documentId}/qr?format=svg`);
    expect(svg.status()).toBe(200);
    expect(svg.headers()["content-type"]).toContain("image/svg+xml");
    expect(await svg.text()).toContain("<svg");

    const png = await page.request.get(`/api/admin/documents/${documentId}/qr?format=png`);
    expect(png.status()).toBe(200);
    expect(png.headers()["content-type"]).toContain("image/png");
    // PNG magic bytes.
    expect((await png.body()).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  test("the document appears in search results", async ({ page }) => {
    await signIn(page);
    await page.goto(`/admin/documents?q=${encodeURIComponent(DOC_NUMBER)}`);
    await expect(page.getByRole("link", { name: new RegExp(DOC_TITLE) })).toBeVisible();
  });
});

test.describe("public document page", () => {
  test("a scanned document redirects straight to the inline file, no app chrome", async ({ page }) => {
    const response = await page.request.get(`/document/${documentId}`, { maxRedirects: 0 });

    // 307 straight to a storage-signed URL - not an app page of our own.
    expect(response.status()).toBe(307);
    const location = response.headers()["location"];
    expect(location).toContain("token=");
    expect(location).not.toContain(`/document/${documentId}`);
  });

  test("following the redirect returns the uploaded PDF itself", async ({ page }) => {
    // maxRedirects default follows the 307 to the signed file.
    const response = await page.request.get(`/document/${documentId}`);
    expect(response.status()).toBe(200);
    expect((await response.body()).subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  test("the download endpoint also returns the file via a signed URL", async ({ page }) => {
    const response = await page.request.get(`/api/public/documents/${documentId}/download`, {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(302);

    const location = response.headers()["location"];
    expect(location).toContain("token=");

    const file = await page.request.get(location);
    expect(file.status()).toBe(200);
    expect((await file.body()).subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});

test.describe("lifecycle keeps QR codes resolvable", () => {
  test("archiving shows a notice instead of the document", async ({ page }) => {
    await signIn(page);
    await page.goto(`/admin/documents/${documentId}`);

    await page.getByRole("button", { name: "Archive document" }).click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("Document archived.")).toBeVisible();

    const anon = await page.context().browser()!.newContext();
    const visitor = await anon.newPage();
    await visitor.goto(`/document/${documentId}`);

    await expect(visitor.getByRole("heading", { name: "Document unavailable" })).toBeVisible();
    // Identifying details stay, the file does not.
    await expect(visitor.getByText(DOC_TITLE)).toBeVisible();
    await expect(visitor.getByRole("link", { name: /Download document/ })).toHaveCount(0);
    await anon.close();
  });

  test("download is refused while archived", async ({ request }) => {
    const response = await request.get(`/api/public/documents/${documentId}/download`, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    // Bounced back to the document page, not to a signed URL.
    expect(response.headers()["location"]).toContain(`/document/${documentId}`);
    expect(response.headers()["location"]).not.toContain("token=");
  });

  test("restoring makes it available again", async ({ page }) => {
    await signIn(page);
    await page.goto(`/admin/documents/${documentId}`);

    await page.getByRole("button", { name: "Restore document" }).click();
    await expect(page.getByText("Document restored.")).toBeVisible();

    // Available again: the public page redirects straight to the file.
    const response = await page.request.get(`/document/${documentId}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("token=");
  });

  test("a past expiry date shows the expired notice", async ({ page }) => {
    await signIn(page);
    await page.goto(`/admin/documents/${documentId}`);

    await page.getByLabel("Expiry date").fill("2020-01-01");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible();

    await page.goto(`/document/${documentId}`);
    await expect(page.getByRole("heading", { name: "Document expired" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Download document/ })).toHaveCount(0);
  });

  test("clearing the expiry restores access", async ({ page }) => {
    await signIn(page);
    await page.goto(`/admin/documents/${documentId}`);

    await page.getByLabel("Expiry date").fill("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible();

    // Available again: the public page redirects straight to the file.
    const response = await page.request.get(`/document/${documentId}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("token=");
  });

  test("deleting gives a controlled page, not a broken link", async ({ page }) => {
    await signIn(page);
    await page.goto(`/admin/documents/${documentId}`);

    await page.getByRole("button", { name: "Delete document" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.waitForURL("**/admin/documents");

    await page.goto(`/document/${documentId}`);
    await expect(page.getByRole("heading", { name: "Document unavailable" })).toBeVisible();
    // A deleted document is indistinguishable from one that never existed.
    await expect(page.getByText(DOC_TITLE)).toHaveCount(0);
  });
});

test.describe("session", () => {
  test("signing out revokes access to admin pages", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await page.waitForURL("**/admin/login");

    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
