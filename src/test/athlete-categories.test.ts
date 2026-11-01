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

describe("Sci da archi in Campo libero (solo Giovani)", () => {
  const w = loadApp();

  function skiTypes(cat: string) {
    w.openF(null);
    w.F.cat = cat;
    w.F.tipo = ["Campo libero"];
    w.F.det = {};
    w.form();
    const sheet = document.getElementById("sheet")!;
    return Array.from(sheet.querySelectorAll('[data-s="Campo libero"]')).map(
      (b) => b.textContent!.trim(),
    );
  }

  it("offers Sci da archi only for the Giovani category", () => {
    expect(skiTypes("Giovani")).toEqual(["Gigante", "Slalom", "Sci da archi"]);
    expect(skiTypes("Ragazzi Race")).toEqual(["Gigante", "Slalom"]);
    expect(skiTypes("Children Race")).toEqual(["Gigante", "Slalom"]);
    expect(skiTypes("")).toEqual(["Gigante", "Slalom"]);
  });

  it("leaves the other activities' option lists untouched", () => {
    expect(w.subOpts("Speciale", "Giovani")).toEqual(["Telemark", "Snowboard", "Snowblade", "Altro"]);
    expect(w.subOpts("Pali", "Giovani")).not.toContain("Sci da archi");
  });

  it("drops Sci da archi when the session is moved out of Giovani", () => {
    w.openF(null);
    w.F.cat = "Giovani";
    w.F.tipo = ["Campo libero"];
    w.F.det = { "Campo libero": { sub: "Sci da archi" } };
    w.form();
    const sel = document.querySelector('select[data-fc="1"]') as HTMLSelectElement;
    sel.value = "Ragazzi Race";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    expect(w.F.det["Campo libero"].sub).toBe("");
  });

  it("keeps Sci da archi when the session stays in Giovani", () => {
    w.openF(null);
    w.F.cat = "Giovani";
    w.F.tipo = ["Campo libero"];
    w.F.det = { "Campo libero": { sub: "Sci da archi" } };
    w.form();
    const sel = document.querySelector('select[data-fc="1"]') as HTMLSelectElement;
    sel.value = "Giovani";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    expect(w.F.det["Campo libero"].sub).toBe("Sci da archi");
  });
});

