import { t } from "./i18n.js";
import { supabase, moduleName } from "./db.js";

export function root() {
  return window.BGUC_ROOT || ".";
}

export function path(p) {
  return `${root()}/${p.replace(/^\//, "")}`;
}

function brand(href, subtitle) {
  return `<a class="brand" href="${href}">
    <span>
      <b>${t("org")}</b>
      <span>${subtitle}</span>
    </span>
  </a>`;
}

export async function mountChrome() {
  const header = document.getElementById("site-header");
  if (!header) return;
  const mod = moduleName();

  if (mod === "student") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    header.innerHTML = `<div class="top-inner">
      ${brand("index.html", t("studentPortal"))}
      <nav class="nav">
        ${
          user
            ? `<a href="index.html">My project</a><a href="details.html">Details</a><a href="ranking.html">Ranking</a>
               <form id="logout"><button type="submit">${t("signOut")}</button></form>`
            : `<a href="login.html">${t("signIn")}</a><a href="register.html">Register</a>`
        }
      </nav>
    </div>`;
  } else if (mod === "admin") {
    header.innerHTML = `<div class="top-inner">
      ${brand("projects.html", t("admin"))}
      <nav class="nav">
        <a href="projects.html">Projects</a>
        <a href="votes.html">Leaderboard</a>
        <a href="settings.html">Voting</a>
      </nav>
    </div>`;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.rpc("ensure_voter").catch(() => {});
    header.innerHTML = `<div class="top-inner">
      ${brand(user ? path("list.html") : path("index.html"), t("exhibition"))}
      <nav class="nav">
        ${
          user
            ? `<a href="${path("list.html")}">${t("projects")}</a>
               <form id="logout"><button class="btn line" type="submit">${t("signOut")}</button></form>`
            : ""
        }
      </nav>
    </div>`;
  }

  const logout = header.querySelector("#logout");
  if (logout) {
    logout.addEventListener("submit", async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      location.href = mod === "student" ? "login.html" : mod === "admin" ? "index.html" : path("index.html");
    });
  }
}
