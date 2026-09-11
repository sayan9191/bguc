import { t } from "./i18n.js";
import { supabase, moduleName } from "./db.js";
import { organiserToken, clearOrganiserSession } from "./organiser.js";

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
    const inAdmin = Boolean(organiserToken());
    header.innerHTML = `<div class="top-inner">
      ${brand(inAdmin ? "index.html" : "login.html", t("admin"))}
      <nav class="nav">
        ${
          inAdmin
            ? `<a href="index.html">Overview</a><a href="projects.html">Projects</a><a href="students.html">Students</a>
               <a href="votes.html">Votes</a><a href="settings.html">Settings</a>
               <button type="button" id="admin-out">${t("signOut")}</button>`
            : ""
        }
      </nav>
    </div>`;
    document.getElementById("admin-out")?.addEventListener("click", async () => {
      const token = organiserToken();
      if (token) await supabase.rpc("organiser_logout", { p_token: token }).catch(() => {});
      clearOrganiserSession();
      location.href = "login.html";
    });
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.rpc("ensure_voter").catch(() => {});
    header.innerHTML = `<div class="top-inner">
      ${brand(path("index.html"), t("exhibition"))}
      <nav class="nav">
        <a href="${path("index.html")}">${t("projects")}</a>
        <a href="${path("leaderboard.html")}">${t("leaderboard")}</a>
        ${
          user
            ? `<form id="logout"><button type="submit">${t("signOut")}</button></form>`
            : `<a href="${path("login.html")}">${t("signIn")}</a>`
        }
      </nav>
    </div>`;
  }

  const logout = header.querySelector("#logout");
  if (logout) {
    logout.addEventListener("submit", async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      location.href = mod === "student" ? "login.html" : path("index.html");
    });
  }
}
