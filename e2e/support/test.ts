// Socle des parcours : base videe avant chaque test, donnees creees par la
// route de test [D79], connexion sans formulaire, axe, et echec sur toute
// erreur de la console.
import { AxeBuilder } from "@axe-core/playwright";
import {
  expect,
  test as base,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import { routeStorage } from "./storage.ts";

const API = "/api/v1";
const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "x-xsrf-token";

/** Compte rendu par un scenario : de quoi se connecter. */
export interface Account {
  id: string;
  username: string;
  email: string;
  password: string;
  personalSpaceId: string;
}

export type MemberRole = "MEMBER" | "MODERATOR";

/** Scenarios de `apps/api/test/e2e/routes.ts` et ce qu'ils rendent. */
interface Scenarios {
  user: { input: { username?: string }; output: { user: Account } };
  group: {
    input: { spaceName?: string; ownerName?: string; members?: MemberRole[] };
    output: {
      owner: Account;
      space: { id: string; name: string };
      members: (Account & { role: MemberRole })[];
    };
  };
  admin: {
    input: object;
    output: { admin: { id: string; username: string; password: string; totpSecret: string } };
  };
}

export type Scenario = <N extends keyof Scenarios>(
  name: N,
  input?: Scenarios[N]["input"]
) => Promise<Scenarios[N]["output"]>;

/**
 * Bruit attendu : Chromium ecrit une erreur de console pour toute reponse 4xx
 * (le 401 de `GET /me` d'un visiteur, par exemple). Les erreurs 5xx, elles,
 * font echouer le parcours.
 */
const EXPECTED_CONSOLE = /Failed to load resource: the server responded with a status of 4\d\d/;

/** Releve les erreurs de console et les exceptions d'une page. */
export function watchConsole(page: Page, errors: string[]): void {
  page.on("console", (message) => {
    if (message.type() === "error" && !EXPECTED_CONSOLE.test(message.text()))
      errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    errors.push(`exception: ${error.message}`);
  });
}

/**
 * Connecte le contexte de la page par l'API (cookie de session pose sans
 * passer par le formulaire). Les parcours 1 et 13 passent par les ecrans.
 */
export async function loginAs(page: Page, account: Account): Promise<void> {
  const response = await apiCall(page, "POST", "/auth/login", {
    identifier: account.username,
    password: account.password,
  });
  expect(response.status(), "login by API").toBe(200);
}

/**
 * Appel de l'API avec la session du contexte de la page (jeton CSRF compris) :
 * prepare l'etat d'un parcours par les vraies routes, sans passer par les ecrans.
 */
export async function apiCall(
  page: Page,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  data?: unknown
): Promise<APIResponse> {
  const request = page.context().request;
  const csrf = async () =>
    (await page.context().cookies()).find((cookie) => cookie.name === CSRF_COOKIE)?.value;
  if (!(await csrf())) await request.get(`${API}/config`);
  const token = await csrf();
  if (!token) throw new Error("CSRF cookie missing");
  return request.fetch(`${API}${path}`, {
    method,
    headers: { [CSRF_HEADER]: decodeURIComponent(token) },
    data,
  });
}

/** Comme `apiCall`, pour une creation : exige le statut attendu et rend le corps. */
export async function apiCreate<T>(page: Page, path: string, data: unknown): Promise<T> {
  const response = await apiCall(page, "POST", path, data);
  expect(response.status(), `POST ${path}: ${await response.text()}`).toBe(201);
  return (await response.json()) as T;
}

/** Aucune violation axe "serious" ou "critical" sur l'ecran affiche [15-Plan-Tests S8]. */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target.join(" ")),
    }));
  expect(blocking, `axe sur ${page.url()}`).toEqual([]);
}

async function resetDatabase(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${API}/__test/reset`);
  expect(response.status(), "reset de la base").toBe(204);
}

interface Fixtures {
  /** Automatique : base videe avant le test, console surveillee pendant. */
  journey: undefined;
  /** Cree les donnees du parcours et rend les identifiants utiles. */
  scenario: Scenario;
  /** Ouvre la page d'une autre personne (contexte separe, console surveillee aussi). */
  otherPage: () => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  journey: [
    async ({ page, request }, use) => {
      await resetDatabase(request);
      await routeStorage(page.context());
      const errors: string[] = [];
      watchConsole(page, errors);
      await use(undefined);
      expect(errors, "erreurs de console pendant le parcours").toEqual([]);
    },
    { auto: true },
  ],
  scenario: async ({ request }, use) => {
    await use(async (name, input = {}) => {
      const response = await request.post(`${API}/__test/scenario`, { data: { name, ...input } });
      expect(response.status(), `scenario ${name}`).toBe(201);
      return (await response.json()) as never;
    });
  },
  otherPage: async ({ browser }, use) => {
    const errors: string[] = [];
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext();
      contexts.push(context);
      await routeStorage(context);
      const page = await context.newPage();
      watchConsole(page, errors);
      return page;
    });
    for (const context of contexts) await context.close();
    expect(errors, "erreurs de console de l'autre personne").toEqual([]);
  },
});

/** Toast affiche (cherche dans la zone des toasts : `role="status"` le repete ailleurs). */
export async function expectToast(page: Page, text: string): Promise<void> {
  const toasts = page.getByRole("region", { name: /^Notifications/ });
  await expect(toasts.getByText(text, { exact: true })).toBeVisible();
}

export { expect };
