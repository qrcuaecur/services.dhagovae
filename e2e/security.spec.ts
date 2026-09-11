import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Playwright doesn't load .env files; Node 22 can.
process.loadEnvFile(".env.local");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } });
const anon = () => createClient(URL, ANON, { auth: { persistSession: false } });

const VIEWER_EMAIL = `viewer-${Date.now()}@example.com`;
const VIEWER_PASSWORD = "viewer-account-passphrase-2026";

let seededId = "";
let seededPath = "";
let viewerClient: SupabaseClient;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const service = admin();

  seededId = randomUUID();
  seededPath = `${seededId}/probe.pdf`;

  const upload = await service.storage
    .from("documents")
    .upload(seededPath, Buffer.from("%PDF-1.4\nprobe\n%%EOF\n"), { contentType: "application/pdf" });
  expect(upload.error).toBeNull();

  const insert = await service.from("documents").insert({
    id: seededId,
    title: "RLS probe document",
    description: "",
    tags: [],
    file_name: "probe.pdf",
    file_path: seededPath,
    file_type: "application/pdf",
    file_size: 22,
    storage_bucket: "documents",
    status: "active",
  });
  expect(insert.error).toBeNull();

  // A signed-in account that exists but was never promoted to admin.
  const created = await service.auth.admin.createUser({
    email: VIEWER_EMAIL,
    password: VIEWER_PASSWORD,
    email_confirm: true,
  });
  expect(created.error).toBeNull();

  viewerClient = createClient(URL, ANON, { auth: { persistSession: false } });
  const signIn = await viewerClient.auth.signInWithPassword({
    email: VIEWER_EMAIL,
    password: VIEWER_PASSWORD,
  });
  expect(signIn.error).toBeNull();
});

test.afterAll(async () => {
  const service = admin();
  await service.storage.from("documents").remove([seededPath]);
  await service.from("documents").delete().eq("id", seededId);

  // Don't leave probe accounts behind on repeated runs.
  const { data } = await service.from("profiles").select("id").eq("email", VIEWER_EMAIL).maybeSingle();
  if (data?.id) await service.auth.admin.deleteUser(data.id);
});

test.describe("anonymous key is powerless", () => {
  test("cannot read documents", async () => {
    const { data, error } = await anon().from("documents").select("id, title");
    // RLS returns an empty set rather than an error for a blocked select.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("cannot read profiles", async () => {
    const { data } = await anon().from("profiles").select("id, email, role");
    expect(data).toEqual([]);
  });

  test("cannot read access logs", async () => {
    const { data } = await anon().from("document_access_logs").select("id");
    expect(data).toEqual([]);
  });

  test("cannot insert a document", async () => {
    const { error } = await anon().from("documents").insert({
      id: randomUUID(),
      title: "injected",
      description: "",
      tags: [],
      file_name: "x.pdf",
      file_path: "x/x.pdf",
      file_type: "application/pdf",
      file_size: 1,
      storage_bucket: "documents",
      status: "active",
    });
    expect(error).not.toBeNull();
  });

  test("cannot update or delete a document", async () => {
    await anon().from("documents").update({ title: "hijacked" }).eq("id", seededId);
    await anon().from("documents").delete().eq("id", seededId);

    // These report success rather than an error: with no SELECT visibility the
    // WHERE clause matches nothing, so the statement is a no-op. What matters
    // is that the row is untouched.
    const { data } = await admin().from("documents").select("title, deleted_at").eq("id", seededId).single();
    expect(data?.title).toBe("RLS probe document");
    expect(data?.deleted_at).toBeNull();
  });

  test("cannot read a storage object directly", async () => {
    const { error } = await anon().storage.from("documents").download(seededPath);
    expect(error).not.toBeNull();
  });

  test("cannot reach the file through a guessed public URL", async ({ request }) => {
    const guessed = `${URL}/storage/v1/object/public/documents/${seededPath}`;
    const response = await request.get(guessed);
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("cannot list the bucket", async () => {
    const { data } = await anon().storage.from("documents").list("");
    expect(data ?? []).toEqual([]);
  });
});

test.describe("an authenticated non-admin gets nothing", () => {
  test("the new account defaults to the viewer role", async () => {
    const { data } = await admin().from("profiles").select("role").eq("email", VIEWER_EMAIL).single();
    expect(data?.role).toBe("viewer");
  });

  test("cannot read documents", async () => {
    const { data } = await viewerClient.from("documents").select("id, title");
    expect(data).toEqual([]);
  });

  test("cannot insert a document", async () => {
    const { error } = await viewerClient.from("documents").insert({
      id: randomUUID(),
      title: "viewer insert",
      description: "",
      tags: [],
      file_name: "x.pdf",
      file_path: "x/x.pdf",
      file_type: "application/pdf",
      file_size: 1,
      storage_bucket: "documents",
      status: "active",
    });
    expect(error).not.toBeNull();
  });

  test("cannot download from storage", async () => {
    const { error } = await viewerClient.storage.from("documents").download(seededPath);
    expect(error).not.toBeNull();
  });

  test("cannot escalate their own role", async () => {
    await viewerClient.from("profiles").update({ role: "admin" }).eq("email", VIEWER_EMAIL);

    const { data } = await admin().from("profiles").select("role").eq("email", VIEWER_EMAIL).single();
    expect(data?.role).toBe("viewer");
  });

  test("is bounced out of the admin UI", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(VIEWER_EMAIL);
    await page.getByLabel("Password").fill(VIEWER_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Lands on the terminal no-access page rather than looping between
    // login and dashboard.
    await page.waitForURL("**/admin/no-access");
    await expect(page.getByRole("heading", { name: /no admin access/i })).toBeVisible();
  });

  test("gets 403, not 401, from the admin API", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(VIEWER_EMAIL);
    await page.getByLabel("Password").fill(VIEWER_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/admin/no-access");

    const response = await page.request.post("/api/admin/documents/upload-url", {
      data: { fileName: "x.pdf", fileSize: 10, fileType: "application/pdf" },
    });
    expect(response.status()).toBe(403);
  });
});

test.describe("signed URLs are the only way in", () => {
  test("a signed URL works and then expires", async () => {
    const { data } = await admin().storage.from("documents").createSignedUrl(seededPath, 1);
    expect(data?.signedUrl).toBeTruthy();

    const fresh = await fetch(data!.signedUrl);
    expect(fresh.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 2500));

    const stale = await fetch(data!.signedUrl);
    expect(stale.status).toBeGreaterThanOrEqual(400);
  });

  test("a tampered signature is rejected", async () => {
    const { data } = await admin().storage.from("documents").createSignedUrl(seededPath, 60);
    const tampered = data!.signedUrl.replace(/token=.*/, "token=not-a-real-token");

    const response = await fetch(tampered);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
