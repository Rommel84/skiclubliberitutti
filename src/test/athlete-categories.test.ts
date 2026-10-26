import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The registro is one self-contained HTML file served from public/. Load it into
// jsdom (the vitest environment) so the category rules can be checked as logic.
const html = readFileSync(path.resolve(__dirname, "../../public/app.html"), "utf8");

function loadApp() {
  const body = /<body>([\s\S]*?)<\/body>/.exec(html)![1]!;
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
  document.body.innerHTML = body.replace(/<script>[\s\S]*?<\/script>/g, "");
  (window as any).eval(script);
  return window as any;
}

function tagsOf(main: HTMLElement, category: string, athlete: string) {
  const details = main.querySelector(`details[data-cat="${category}"]`)!;
  expect(details, `expected a "${category}" group`).not.toBeNull();
  const rows = Array.from(details.querySelectorAll(":scope > div.card > div"));
  const row = rows.find((d) =>
    (d.querySelector(".row.sp > span")?.textContent || "").includes(athlete),
  )!;
  expect(row, `expected a card for ${athlete}`).not.toBeNull();
  return Array.from(row.querySelectorAll(".tag")).map((t) => t.textContent!.trim());
}

describe("Categorie in scheda atleta", () => {
  const w = loadApp();

  it("lists both categories for a Ragazzi Race athlete", () => {
    expect(w.catsOf({ cat: "Ragazzi Race" })).toEqual(["Ragazzi Race", "Children Race"]);
  });

  it("lists both categories for an Allievi Race athlete", () => {
    expect(w.catsOf({ cat: "Allievi Race" })).toEqual(["Allievi Race", "Children Race"]);
  });

  it("lists only the own category for an athlete outside Children Race", () => {
    expect(w.catsOf({ cat: "Giovani" })).toEqual(["Giovani"]);
    expect(w.catsOf({ cat: "Cuccioli Race" })).toEqual(["Cuccioli Race"]);
  });

  it("shows the category pills on the athlete card", () => {
    w.view = "reg";
    w.REG.mode = "ath";
    w.render();
    const main = document.getElementById("main")!;
    const ragazzo = w.S.ath.find((a: any) => a.cat === "Ragazzi Race");
    const allievo = w.S.ath.find((a: any) => a.cat === "Allievi Race");
    const giovane = w.S.ath.find((a: any) => a.cat === "Giovani");

    expect(tagsOf(main, "Ragazzi Race", ragazzo.nome)).toEqual(["Ragazzi Race", "Children Race"]);
    expect(tagsOf(main, "Allievi Race", allievo.nome)).toEqual(["Allievi Race", "Children Race"]);
    expect(tagsOf(main, "Giovani", giovane.nome)).toEqual(["Giovani"]);
  });

  it("groups the Children Race athletes under Children Race too", () => {
    const main = document.getElementById("main")!;
    const children = main.querySelector('details[data-cat="Children Race"]')!;
    expect(children, "expected a Children Race group").not.toBeNull();
    const text = children.textContent || "";
    w.S.ath
      .filter((a: any) => a.cat === "Ragazzi Race" || a.cat === "Allievi Race")
      .forEach((a: any) => expect(text).toContain(a.nome));
  });
});

describe("Accesso allenatori", () => {
  it("gates the app on first run and lets the admin log in after setup", async () => {
    localStorage.clear();
    const w = loadApp();
    expect(w.AMODE).toBe("setup");
    expect(document.getElementById("auth")!.classList.contains("hide")).toBe(false);

    expect(await w.auSetup("admin@sciclub.it", "Admin", "123", "123")).toContain("almeno 6");
    expect(await w.auSetup("admin@sciclub.it", "Admin", "segreta1", "segreta1")).toBe("");
    expect(w.curUser().email).toBe("admin@sciclub.it");
    expect(w.curUser().admin).toBe(1);
    expect(document.getElementById("auth")!.classList.contains("hide")).toBe(true);
  });

  it("rejects non-whitelisted emails and lets a whitelisted coach set a password", async () => {
    localStorage.clear();
    const w = loadApp();
    await w.auSetup("admin@sciclub.it", "Admin", "segreta1", "segreta1");
    expect(await w.auLogin("esterno@example.com", "qualunque")).toContain("non è autorizzato");

    expect(w.auAdd("coach@sciclub.it", "Coach")).toBe("");
    w.auLogout();
    expect(w.curUser()).toBeNull();

    // first access: no password yet -> redirected to password creation
    expect(await w.auLogin("coach@sciclub.it", "qualunque")).toContain("Primo accesso");
    expect(w.AMODE).toBe("setpw");
    expect(await w.auSetPw("coach@sciclub.it", "coachpass", "coachpass")).toBe("");
    expect(w.curUser().email).toBe("coach@sciclub.it");

    w.auLogout();
    expect(await w.auLogin("coach@sciclub.it", "sbagliata")).toContain("Password errata");
    expect(await w.auLogin("coach@sciclub.it", "coachpass")).toBe("");
  });

  it("flags reset requests and lets the admin set a temporary password", async () => {
    localStorage.clear();
    const w = loadApp();
    await w.auSetup("admin@sciclub.it", "Admin", "segreta1", "segreta1");
    w.auAdd("coach@sciclub.it", "Coach");
    await w.auSetPw("coach@sciclub.it", "coachpass", "coachpass");
    w.auLogout();

    w.auForgot("coach@sciclub.it");
    expect(w.findUser("coach@sciclub.it").reset).toBe(1);

    await w.auLogin("admin@sciclub.it", "segreta1");
    expect(await w.auAdminPw(w.findUser("coach@sciclub.it").id, "temp123")).toBe("");
    expect(w.findUser("coach@sciclub.it").reset).toBe(0);

    w.auLogout();
    expect(await w.auLogin("coach@sciclub.it", "temp123")).toBe("");
  });
});
