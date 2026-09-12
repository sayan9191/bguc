import { COLS, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";
import { t, escapeHtml, wordCount, classOptions, isOtherClass, normalizeClass } from "./i18n.js";
import { supabase, mediaUrl, mediaUrls, preview, qs } from "./db.js";
import { mountChrome, path } from "./chrome.js";

const page = document.body.dataset.page;

// The header must never be able to blank the page. If it fails, the content
// below still renders and the reason is reported.
try {
  await mountChrome();
} catch (err) {
  console.error("Header failed to load", err);
}

// Supabase strips its tokens out of the fragment after sign-in but leaves a
// bare "#" in the address bar, which looks like a broken redirect.
if (location.hash && !location.hash.includes("access_token")) {
  history.replaceState(null, "", location.pathname + location.search);
}

try {
  if (page === "home") await homePage();
  if (page === "leaderboard") await leaderboardPage();
  if (page === "login") await voteLoginPage();
  if (page === "project") await projectPage();
  if (page === "student-login") await studentLogin(false);
  if (page === "student-register") await studentLogin(true);
  if (page === "student-home") await studentHome();
  if (page === "student-details") await studentDetails();
  if (page === "student-ranking") await studentRanking();
  if (page === "admin-login") adminLogin();
  if (page === "admin-home") await adminOverview();
  if (page === "admin-projects") await adminProjects();
  if (page === "admin-project") await adminProject();
  if (page === "admin-students") adminStudents();
  if (page === "admin-votes") await adminVotes();
  if (page === "admin-attendance") await adminAttendance();
  if (page === "admin-settings") await adminSettings();
} catch (err) {
  const app = document.getElementById("app");
  if (app) app.innerHTML = `<p class="alert err">${escapeHtml(err.message || String(err))}</p>`;
}

async function homePage() {
  const group = qs("group") || "All";
  const q = (qs("q") || "").trim();
  document.getElementById("app").innerHTML = `
    <section class="hero">
      <p class="k">${t("org")}</p>
      <h1>${t("exhibition")}</h1>
      <p>${t("voteFavourite")}</p>
      <p class="rule">${t("voteRule")}</p>
      <p class="muted">${t("groupHint")}</p>
      <p class="muted" id="my-votes"></p>
    </section>
    <form class="search" method="get">
      ${group !== "All" ? `<input type="hidden" name="group" value="${group}" />` : ""}
      <input name="q" value="${escapeHtml(q)}" placeholder="${t("searchPlaceholder")}" />
      <button class="btn" type="submit">${t("search")}</button>
    </form>
    <div class="chips">
      <a class="${group === "All" ? "on" : ""}" href="index.html${q ? `?q=${encodeURIComponent(q)}` : ""}">${t("allProjects")}</a>
      <a class="${group === "A" ? "on" : ""}" href="index.html?group=A${q ? `&q=${encodeURIComponent(q)}` : ""}">${t("groupA")}</a>
      <a class="${group === "B" ? "on" : ""}" href="index.html?group=B${q ? `&q=${encodeURIComponent(q)}` : ""}">${t("groupB")}</a>
    </div>
    <div id="list" class="cards"></div>
    <div id="modal"></div>
  `;
  let query = supabase.from("projects").select(COLS).eq("approval_status", "APPROVED").order("model_name");
  if (group === "A" || group === "B") query = query.eq("class_group", group);
  if (q) query = query.or(`model_name.ilike.%${q}%,school_name.ilike.%${q}%,team_display_names.ilike.%${q}%`);
  const { data: projects } = await query;
  const { data: settings } = await supabase.from("exhibition_settings").select("*").eq("id", 1).maybeSingle();
  const { data: counts } = settings?.results_visible ? await supabase.rpc("public_vote_counts") : { data: [] };
  const countMap = new Map((counts ?? []).map((c) => [c.project_id, c.vote_count]));
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const groupVotes = user ? (await supabase.rpc("my_group_votes")).data ?? {} : {};
  renderMyVotes(groupVotes, user);

  const list = document.getElementById("list");
  if (!projects?.length) {
    list.innerHTML = `<p class="muted">No approved projects yet.</p>`;
    return;
  }

  // Every photo of every card is signed in one batch, then each card gets its
  // cover first followed by its gallery shots.
  const { data: mediaRows } = await supabase
    .from("project_media")
    .select("project_id, media_url, sort_order")
    .in("project_id", projects.map((p) => p.id))
    .order("sort_order");
  const urls = await mediaUrls([
    ...projects.map((p) => p.cover_image_url),
    ...(mediaRows ?? []).map((m) => m.media_url),
  ]);
  const photosFor = (p) => [
    ...new Set(
      [
        urls.get(p.cover_image_url),
        ...(mediaRows ?? []).filter((m) => m.project_id === p.id).map((m) => urls.get(m.media_url)),
      ].filter(Boolean)
    ),
  ];

  list.innerHTML = projects
    .map((p) => cardHtml(p, photosFor(p), settings?.results_visible ? countMap.get(p.id) ?? 0 : null, user, groupVotes))
    .join("");
  startSliders(list);
  wireDescriptions(list);
  wireCardVotes(list, user, groupVotes);
}

function cardHtml(p, photos, votes, user, groupVotes) {
  const g = p.class_group === "A" ? t("groupA") : p.class_group === "B" ? t("groupB") : "";
  const klass = normalizeClass(p.class_name);
  const full = String(p.description || "");
  // Short enough to keep every card the same tidy height; the rest is behind
  // "View more", which expands in place rather than opening the project page.
  const short = preview(full, 14);
  const truncated = short !== full;
  return `<article class="card" data-card="${p.id}" data-group="${p.class_group}">
    <div class="slider" data-slider>
      ${
        photos.length
          ? photos.map((u, i) => `<img src="${u}" alt="" class="${i === 0 ? "on" : ""}" />`).join("")
          : `<span class="muted no-photo">${t("noImage")}</span>`
      }
    </div>
    <div class="body">
      <div class="card-head">
        <h2><a href="project.html?id=${p.id}">${escapeHtml(p.model_name)}</a></h2>
        ${g ? `<span class="badge">${g}</span>` : ""}
      </div>
      ${
        full
          ? `<p class="desc">
        <span data-short>${escapeHtml(short)}</span><span data-full hidden>${escapeHtml(full)}</span>
        ${truncated ? `<button type="button" class="more" data-more>${t("viewMore")}</button>` : ""}
      </p>`
          : ""
      }
      ${p.team_display_names ? `<p class="muted">Name: ${escapeHtml(p.team_display_names)}</p>` : ""}
      ${
        klass || p.school_name
          ? `<p class="muted">${[klass ? `Class: ${escapeHtml(klass)}` : "", p.school_name ? `School: ${escapeHtml(p.school_name)}` : ""]
              .filter(Boolean)
              .join(" · ")}</p>`
          : ""
      }
      ${p.mentor_name ? `<p class="muted">Guidance: ${escapeHtml(p.mentor_name)}</p>` : ""}
      ${votes == null ? "" : `<p class="muted">${votes} ${t("votesCount")}</p>`}
      ${voteButtonHtml(p, user, groupVotes)}
    </div>
  </article>`;
}

function voteButtonHtml(p, user, groupVotes) {
  const label = groupName(p.class_group);
  const mine = groupVotes[p.class_group];
  if (mine?.voted && mine.project_id === p.id) {
    return `<button class="btn vote voted" type="button" disabled>✓ Voted</button>`;
  }
  if (mine?.voted) {
    return `<button class="btn vote" type="button" disabled>${label} vote already used</button>`;
  }
  return `<button class="btn vote" type="button" data-vote="${p.id}" data-name="${escapeHtml(p.model_name)}" data-group="${p.class_group}">${
    user ? `${t("vote")} in ${label}` : `Sign in to vote`
  }</button>`;
}

/** One timer drives every card, so all sliders advance together every 3s. */
function startSliders(scope) {
  const sliders = [...scope.querySelectorAll("[data-slider]")].filter(
    (s) => s.querySelectorAll("img").length > 1
  );
  if (!sliders.length) return;
  setInterval(() => {
    for (const s of sliders) {
      const imgs = [...s.querySelectorAll("img")];
      const current = imgs.findIndex((img) => img.classList.contains("on"));
      imgs[current]?.classList.remove("on");
      imgs[(current + 1) % imgs.length].classList.add("on");
    }
  }, 3000);
}

function wireDescriptions(scope) {
  scope.querySelectorAll("[data-more]").forEach((btn) => {
    btn.onclick = () => {
      const holder = btn.closest(".desc");
      const short = holder.querySelector("[data-short]");
      const full = holder.querySelector("[data-full]");
      const expanded = !full.hidden;
      full.hidden = expanded;
      short.hidden = !expanded;
      btn.textContent = expanded ? t("viewMore") : "View less";
    };
  });
}

function wireCardVotes(scope, user, groupVotes) {
  scope.querySelectorAll("[data-vote]").forEach((btn) => {
    btn.onclick = async () => {
      if (!user) {
        location.replace(`${path("login.html")}?next=${encodeURIComponent("index.html")}`);
        return;
      }
      const id = btn.dataset.vote;
      const name = btn.dataset.name;
      const group = btn.dataset.group;
      const label = groupName(group);
      if (!(await confirmVote(name, label))) return;
      btn.disabled = true;
      const { data, error } = await supabase.rpc("submit_vote", { p_project_id: id });
      if (error || !data?.ok) {
        btn.disabled = false;
        // Nothing is added under the button; a refusal is explained in a dialog.
        showNotice(error?.message || data?.message || "Could not submit vote.");
        return;
      }
      groupVotes[group] = { voted: true, project_id: id, project_name: name };
      lockGroup(scope, group, id);
      renderMyVotes(groupVotes, user);
    };
  });
}

/** After a vote lands, no card in that group can be voted on again. */
function lockGroup(scope, group, votedId) {
  scope.querySelectorAll(`.card[data-group="${group}"]`).forEach((card) => {
    const btn = card.querySelector("button.vote");
    if (!btn) return;
    btn.disabled = true;
    btn.removeAttribute("data-vote");
    btn.onclick = null;
    if (card.dataset.card === votedId) {
      btn.textContent = "✓ Voted";
      btn.classList.add("voted");
    } else {
      btn.textContent = `${groupName(group)} vote already used`;
    }
  });
}

/** Refusals and failures are shown centred in a dialog, never under a button. */
function showNotice(message) {
  const host = document.getElementById("modal");
  if (!host) return;
  host.innerHTML = `<div class="modal"><div class="box">
    <p>${escapeHtml(message)}</p>
    <div class="actions"><button class="btn" data-ok type="button">OK</button></div>
  </div></div>`;
  host.querySelector("[data-ok]").onclick = () => {
    host.innerHTML = "";
  };
}

function confirmVote(name, label) {
  return new Promise((resolve) => {
    const host = document.getElementById("modal");
    host.innerHTML = `<div class="modal"><div class="box">
      <h2>Confirm ${label} vote</h2>
      <p>You are voting for: <strong>${escapeHtml(name)}</strong></p>
      <p class="muted">This uses your one ${label} vote and cannot be changed afterwards.</p>
      <div class="actions">
        <button class="btn line" data-no type="button">Cancel</button>
        <button class="btn" data-yes type="button">Confirm vote</button>
      </div>
    </div></div>`;
    const close = (answer) => {
      host.innerHTML = "";
      resolve(answer);
    };
    host.querySelector("[data-no]").onclick = () => close(false);
    host.querySelector("[data-yes]").onclick = () => close(true);
  });
}

/** Tells a signed-in voter which of their two group votes are still unused. */
function renderMyVotes(groupVotes, user) {
  const box = document.getElementById("my-votes");
  if (!box) return;
  if (!user) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = ["A", "B"]
    .map((g) => {
      const label = groupName(g);
      const mine = groupVotes[g];
      return mine?.voted
        ? `${label}: voted${mine.project_name ? ` for ${escapeHtml(mine.project_name)}` : ""}`
        : `${label}: vote still available`;
    })
    .join(" · ");
}

async function leaderboardPage() {
  const { data: settings } = await supabase.from("exhibition_settings").select("*").eq("id", 1).maybeSingle();
  const app = document.getElementById("app");
  if (!settings?.results_visible) {
    app.innerHTML = `<div class="hero"><h1>${t("leaderboard")}</h1><p class="muted">Results stay hidden until organisers publish them.</p></div>`;
    return;
  }
  const { data: counts } = await supabase.rpc("public_vote_counts");
  const { data: projects } = await supabase.from("projects").select(COLS).eq("approval_status", "APPROVED");
  const map = new Map((projects ?? []).map((p) => [p.id, p]));
  const rows = (counts ?? [])
    .map((c) => ({ ...c, project: map.get(c.project_id) }))
    .filter((r) => r.project)
    .sort((a, b) => b.vote_count - a.vote_count);
  app.innerHTML = `<h1>${t("leaderboard")}</h1>
    <table><thead><tr><th>#</th><th>${t("projects")}</th><th>School</th><th>${t("votesCount")}</th></tr></thead>
    <tbody>${rows
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(r.project.model_name)}</td><td>${escapeHtml(r.project.school_name)}</td><td>${r.vote_count}</td></tr>`
      )
      .join("")}</tbody></table>`;
}

async function voteLoginPage() {
  const next = qs("next") || path("index.html");
  const app = document.getElementById("app");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Reaching this page while signed in normally means the voter pressed Back.
  // Offer links instead of redirecting, which would bounce them forward again.
  if (user) {
    app.innerHTML = `<div class="form">
      <h1>You are signed in</h1>
      <p class="muted">${escapeHtml(user.email || "")}</p>
      <a class="btn" href="${escapeHtml(next)}">Continue</a>
      <p><a href="${path("index.html")}">← All projects</a></p>
    </div>`;
    return;
  }
  app.innerHTML = `<div class="form">
    <h1>Sign in with Google</h1>
    <p class="muted">${t("voteRule")}</p>
    <button class="btn" id="google" type="button">Continue with Google</button>
    <p id="err"></p>
  </div>`;
  document.getElementById("google").onclick = async () => {
    const err = document.getElementById("err");
    // A disabled provider makes Supabase answer the authorize redirect with raw
    // JSON, so check first and keep the voter on a readable page.
    if ((await googleEnabled()) === false) {
      err.innerHTML = `<p class="alert err">Google sign-in is not switched on yet. Please tell the organisers.</p>`;
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL(next, location.href).href,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) err.innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
  };
}

/** true / false, or null when the check itself could not run. */
async function googleEnabled() {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const settings = await res.json();
    return Boolean(settings?.external?.google);
  } catch {
    return null;
  }
}

async function projectPage() {
  const id = qs("id");
  const app = document.getElementById("app");
  if (!id) {
    app.textContent = "Missing project.";
    return;
  }
  const { data: p } = await supabase.from("projects").select(COLS).eq("id", id).eq("approval_status", "APPROVED").maybeSingle();
  if (!p) {
    app.innerHTML = `<p class="alert err">Project not found.</p>`;
    return;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: members }, { data: media }, voteRes] = await Promise.all([
    supabase.from("project_members").select("*").eq("project_id", id),
    supabase.from("project_media").select("*").eq("project_id", id).order("sort_order"),
    user ? supabase.rpc("my_group_votes") : Promise.resolve({ data: {} }),
  ]);
  const cover = await mediaUrl(p.cover_image_url);
  const gallery = [];
  for (const m of media ?? []) {
    const u = await mediaUrl(m.media_url);
    if (u) gallery.push(u);
  }
  const photos = [...new Set([cover, ...gallery].filter(Boolean))];
  // Each group is voted independently, so only this project's group matters.
  const groupLabel = groupName(p.class_group);
  const myVote = (voteRes.data ?? {})[p.class_group];
  const voted = Boolean(myVote?.voted);
  const votedThis = voted && myVote.project_id === p.id;
  const votedName = myVote?.project_name || "";
  app.innerHTML = `
    <p><a href="${path("index.html")}">← All projects</a></p>
    ${photos.length ? `<div class="gallery">${photos.map((u) => `<img src="${u}" alt="" />`).join("")}</div>` : ""}
    <p class="muted">${escapeHtml(p.project_code)}</p>
    <h1>${escapeHtml(p.model_name)}</h1>
    <p>${escapeHtml(p.description || "")}</p>
    <p class="muted">${escapeHtml(p.school_name || "")} · Class ${escapeHtml(p.class_name || "")} · ${groupLabel}</p>
    <p>${escapeHtml(p.team_display_names || "")}</p>
    ${p.mentor_name ? `<p class="muted">Mentor: ${escapeHtml(p.mentor_name)}</p>` : ""}
    ${(members ?? []).length ? `<h3>Members</h3><ul>${members.map((m) => `<li>${escapeHtml(m.student_name)} · ${escapeHtml(m.class_name)}</li>`).join("")}</ul>` : ""}
    <button class="btn vote ${votedThis ? "voted" : ""}" id="vote" type="button" ${voted ? "disabled" : ""}>${
      votedThis ? "✓ Voted" : voted ? `${groupLabel} vote already used` : `${t("vote")} in ${groupLabel}`
    }</button>
    <div id="modal"></div>
  `;
  document.getElementById("vote").onclick = () => startVote(id, p.model_name, user, voted, votedName, groupLabel);
  if (qs("vote") === "1") document.getElementById("vote").click();
}

function groupName(group) {
  return group === "A" ? "Group A" : "Group B";
}

async function startVote(id, name, user, voted, votedName, groupLabel) {
  if (!user) {
    // replace, not assign: the sign-in hop must not become a history entry the
    // voter has to press Back through afterwards.
    location.replace(`${path("login.html")}?next=${encodeURIComponent(`project.html?id=${id}&vote=1`)}`);
    return;
  }
  if (voted) {
    showNotice(
      `You already used your ${groupLabel} vote${votedName ? ` for ${votedName}` : ""}. ${t("voteRule")}`
    );
    return;
  }
  if (!(await confirmVote(name, groupLabel))) return;
  const btn = document.getElementById("vote");
  btn.disabled = true;
  const { data, error } = await supabase.rpc("submit_vote", { p_project_id: id });
  if (error || !data?.ok) {
    btn.disabled = false;
    showNotice(error?.message || data?.message || "Could not submit vote.");
    return;
  }
  btn.textContent = "✓ Voted";
  btn.classList.add("voted");
}

async function studentLogin(register) {
  const app = document.getElementById("app");
  app.innerHTML = `<form class="form" id="f">
    <h1>${register ? "Create account" : "Student sign in"}</h1>
    <p class="muted">${
      register
        ? "Email and password (at least 6 characters). We ask for your name on the next step."
        : "Sign in with your email and password."
    }</p>
    <label>Email</label><input name="email" type="email" required />
    <label>Password</label><input name="password" type="password" minlength="6" required />
    <button class="btn">${register ? "Register" : t("signIn")}</button>
    <p class="muted">${register ? `<a href="login.html">${t("signIn")}</a>` : `<a href="register.html">Create an account</a>`}</p>
    <p id="err"></p>
  </form>`;
  document.getElementById("f").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const { error } = register
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) document.getElementById("err").innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
    else location.href = "index.html";
  };
}

async function requireStudent() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    location.href = "login.html";
    return null;
  }
  return user;
}

async function studentDetails() {
  const user = await requireStudent();
  if (!user) return;
  const { data: student } = await supabase.from("students").select("*").eq("profile_id", user.id).maybeSingle();
  const { data: project } = student
    ? await supabase.from("projects").select("approval_status").eq("student_id", student.id).maybeSingle()
    : { data: null };
  const locked = project?.approval_status === "APPROVED";
  const app = document.getElementById("app");
  app.innerHTML = `<form class="form wide" id="d">
    <h1>Your details</h1>
    ${locked ? `<p class="alert">Your project is approved. You cannot change these details.</p>` : `<p class="muted">Tell us who you are, then add your science project.</p>`}
    <label>Your name</label><input name="student_names" value="${escapeHtml(student?.student_names || "")}" required ${locked ? "disabled" : ""} />
    <label>Class</label>
    <select name="class_name" id="class-select" required ${locked ? "disabled" : ""}>
      <option value="">Select class</option>${classOptions(student?.class_name)}
    </select>
    <div id="class-other-row" hidden>
      <label for="class-other">Write your class</label>
      <input id="class-other" name="class_other" maxlength="40" placeholder="For example: Nursery or KG"
        value="${escapeHtml(isOtherClass(student?.class_name) ? normalizeClass(student?.class_name) : "")}" ${locked ? "disabled" : ""} />
    </div>
    <label>School</label><input name="school_name" value="${escapeHtml(student?.school_name || "")}" required ${locked ? "disabled" : ""} />
    <label>Mentor / guidance</label><input name="mentor_name" value="${escapeHtml(student?.mentor_name || "")}" ${locked ? "disabled" : ""} />
    <label>Mobile number</label><input name="contact_number" maxlength="10" value="${escapeHtml((student?.contact_number || "").replace(/\D/g, "").slice(0, 10))}" required ${locked ? "disabled" : ""} />
    ${locked ? "" : `<button class="btn">Save</button>`}
    <p id="err"></p>
  </form>`;
  const form = document.getElementById("d");
  if (locked) return;

  const classSelect = form.querySelector("#class-select");
  const otherRow = form.querySelector("#class-other-row");
  const otherInput = form.querySelector("#class-other");
  const syncOtherRow = () => {
    const on = classSelect.value === "other";
    otherRow.hidden = !on;
    otherInput.required = on;
  };
  classSelect.addEventListener("change", syncOtherRow);
  syncOtherRow();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const err = document.getElementById("err");

    const choice = String(fd.get("class_name") || "");
    let className;
    let classGroup;
    if (choice === "other") {
      className = String(fd.get("class_other") || "").trim();
      if (!className) {
        err.innerHTML = `<p class="alert err">Write your class, or pick one from the list.</p>`;
        return;
      }
      // A free-text class cannot be mapped to a group, so the project form decides.
      classGroup = "B";
    } else {
      const klass = Number(choice);
      if (!Number.isInteger(klass) || klass < 1 || klass > 12) {
        err.innerHTML = `<p class="alert err">Choose a class from 1 to 12, or choose Other.</p>`;
        return;
      }
      className = String(klass);
      classGroup = klass <= 5 ? "A" : "B";
    }

    const mobile = String(fd.get("contact_number")).replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      err.innerHTML = `<p class="alert err">Enter a valid 10-digit mobile number.</p>`;
      return;
    }

    const fullName = String(fd.get("student_names")).trim();
    const payload = {
      profile_id: user.id,
      student_names: fullName,
      class_name: className,
      class_group: classGroup,
      school_name: String(fd.get("school_name")),
      mentor_name: String(fd.get("mentor_name") || "").trim() || null,
      contact_number: mobile,
    };
    const { error } = student
      ? await supabase.from("students").update(payload).eq("id", student.id)
      : await supabase.from("students").insert(payload);
    if (error) {
      err.innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
      return;
    }
    // Keep the profile name in step, since registration no longer asks for it.
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    location.href = "index.html";
  };
}

async function studentHome() {
  const user = await requireStudent();
  if (!user) return;
  const { data: student } = await supabase.from("students").select("*").eq("profile_id", user.id).maybeSingle();
  if (!student) {
    location.href = "details.html";
    return;
  }
  const { data: project } = await supabase.from("projects").select(COLS + ", rejection_reason").eq("student_id", student.id).maybeSingle();
  const app = document.getElementById("app");
  if (!project) {
    app.innerHTML = `<h1>Add project</h1><p class="muted">Add your science project.</p>${projectFormHtml(student)}`;
    bindProjectForm(student, null);
    return;
  }
  const locked = project.approval_status === "APPROVED";
  const cover = await mediaUrl(project.cover_image_url);
  const voteUrl = new URL(`../project.html?id=${project.id}`, location.href).href;
  app.innerHTML = `
    ${project.approval_status === "APPROVED" ? `<p class="alert">Organisers approved this project. Details and photos cannot be changed.</p>` : ""}
    ${project.approval_status === "PENDING" ? `<p class="alert">Waiting for organiser approval. After approval you cannot edit.</p>` : ""}
    ${project.approval_status === "REJECTED" ? `<p class="alert err">${escapeHtml(project.rejection_reason || "This project was not approved.")}</p>` : ""}
    ${cover ? `<div class="gallery"><img src="${cover}" alt="" /></div>` : ""}
    <h1>${escapeHtml(project.model_name)}</h1>
    <p class="muted">${escapeHtml(project.approval_status)} · ${escapeHtml(project.class_group === "A" ? "Group A" : "Group B")}</p>
    <p>${escapeHtml(project.description || "")}</p>
    <p class="muted">${escapeHtml(project.school_name)} · Class ${escapeHtml(project.class_name)}</p>
    <p>${escapeHtml(project.team_display_names || "")}</p>
    <div class="actions">
      ${locked ? "" : `<a class="btn line" href="index.html?edit=1">Edit</a>`}
      <a class="btn line" href="ranking.html">Open live ranking</a>
    </div>
    <div class="form">
      <h3>Share for votes</h3>
      <p class="muted">${project.approval_status === "APPROVED" ? "Send this link to friends so they can open the project and vote." : "This link works on the voting site after organisers approve."}</p>
      <input readonly value="${escapeHtml(voteUrl)}" />
      <div class="actions">
        <button class="btn" type="button" id="copy">Copy link</button>
        <a class="btn line" target="_blank" href="https://wa.me/?text=${encodeURIComponent("Please vote for our science project " + voteUrl)}">WhatsApp</a>
      </div>
    </div>
    ${qs("edit") === "1" && !locked ? `<h2>Edit project</h2>${projectFormHtml(student, project)}` : ""}
  `;
  document.getElementById("copy")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(voteUrl);
    document.getElementById("copy").textContent = "Copied";
  });
  if (qs("edit") === "1" && !locked) bindProjectForm(student, project);
}

function projectFormHtml(student, project) {
  const extras = (project?.team_display_names || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(1);
  const group = project?.class_group || student.class_group || "B";
  return `<form class="form wide" id="pf">
    <label>Project name</label><input name="model_name" value="${escapeHtml(project?.model_name || "")}" required />
    <label>Group</label>
    <select name="class_group">
      <option value="A" ${group === "A" ? "selected" : ""}>Group A — class 5 and below</option>
      <option value="B" ${group !== "A" ? "selected" : ""}>Group B — class 6 and above</option>
    </select>
    <label>Description</label><textarea name="description" required>${escapeHtml(project?.description || "")}</textarea>
    <p class="muted">20–150 words.</p>
    <label>Other members (optional)</label>
    ${[0, 1, 2, 3].map((i) => `<input name="member_extra" class="mt" placeholder="Member ${i + 2}" value="${escapeHtml(extras[i] || "")}" />`).join("")}
    <label>Mentor / guidance</label><input name="mentor_name" value="${escapeHtml(project?.mentor_name || student.mentor_name || "")}" />
    <label>Photos (1–3)</label><input name="photos" type="file" accept="image/*" multiple />
    <button class="btn">Save project</button>
    <p id="perr"></p>
  </form>`;
}

function bindProjectForm(student, project) {
  document.getElementById("pf").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get("model_name") || "");
    const about = String(fd.get("description") || "");
    const err = document.getElementById("perr");
    if (wordCount(name) > 12) {
      err.innerHTML = `<p class="alert err">Project name must be 12 words or fewer.</p>`;
      return;
    }
    if (wordCount(about) < 20 || wordCount(about) > 150) {
      err.innerHTML = `<p class="alert err">Project details must be between 20 and 150 words.</p>`;
      return;
    }
    const files = [...(fd.getAll("photos") || [])].filter((f) => f && f.size);
    if (files.length > 3) {
      err.innerHTML = `<p class="alert err">You can upload at most 3 photos.</p>`;
      return;
    }
    if (!project && files.length < 1) {
      err.innerHTML = `<p class="alert err">Add at least 1 photo (maximum 3).</p>`;
      return;
    }
    const extras = fd
      .getAll("member_extra")
      .map((v) => String(v).trim())
      .filter(Boolean);
    const team = [student.student_names, ...extras].filter(Boolean).join(", ");
    const { data, error } = await supabase.rpc("submit_student_project", {
      p_model_name: name.trim(),
      p_description: about.trim(),
      p_class_group: String(fd.get("class_group")) === "A" ? "A" : "B",
      p_team_display_names: team,
      p_project_id: project?.id ?? null,
      p_mentor_name: String(fd.get("mentor_name") || "").trim(),
    });
    if (error || !data?.ok || !data.project_id) {
      err.innerHTML = `<p class="alert err">${escapeHtml(error?.message || data?.message || "Could not save project.")}</p>`;
      return;
    }
    const projectId = data.project_id;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const storagePath = `${projectId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("project-images").upload(storagePath, file, { upsert: true });
      if (upErr) {
        err.innerHTML = `<p class="alert err">${escapeHtml(upErr.message)}</p>`;
        return;
      }
      await supabase.rpc("attach_student_media", {
        p_project_id: projectId,
        p_media_url: `project-images/${storagePath}`,
        p_as_cover: i === 0 && !project?.cover_image_url,
      });
    }
    location.href = "index.html";
  };
}

async function studentRanking() {
  const user = await requireStudent();
  if (!user) return;
  const { data: rows, error } = await supabase.rpc("student_live_rankings");
  const list = rows ?? [];
  const mine = list.find((r) => r.is_mine);
  const app = document.getElementById("app");
  app.innerHTML = `<h1>Live ranking</h1>
    <p class="muted">Updates as votes come in.</p>
    ${mine ? `<p>Your position: <strong>#${mine.rank_in_group}</strong> with ${mine.vote_count} votes.</p>` : `<p class="muted">Your project is not on the board yet. Rankings include approved projects only.</p>`}
    ${error ? `<p class="alert err">${escapeHtml(error.message)}</p>` : ""}
    <table><thead><tr><th>Rank</th><th>Project</th><th>School</th><th>Votes</th></tr></thead>
    <tbody>${
      list.length
        ? list
            .map(
              (r) =>
                `<tr><td>#${r.rank_in_group}</td><td>${escapeHtml(r.model_name)}${r.is_mine ? " (you)" : ""}</td><td>${escapeHtml(r.school_name)}</td><td>${r.vote_count}</td></tr>`
            )
            .join("")
        : `<tr><td colspan="4">No approved projects in your group yet.</td></tr>`
    }</tbody></table>`;
}

/** The admin module has no login, so this page only forwards to the overview. */
function adminLogin() {
  location.replace("index.html");
}

async function adminOverview() {
  const { data: projects, error } = await supabase.rpc("organiser_projects");
  const { data: students } = await supabase.rpc("organiser_students");
  const { data: votes } = await supabase.rpc("organiser_votes");
  const list = projects ?? [];
  if (error) {
    document.getElementById("app").innerHTML = `<p class="alert err">Run supabase/migrations/0016_open_organiser.sql in Supabase so admin can load all projects. ${escapeHtml(error.message)}</p>`;
    return;
  }
  document.getElementById("app").innerHTML = `<h1>Exhibition overview</h1>
    <div class="stats">
      <div class="stat"><span>Total students</span><b>${students?.length ?? 0}</b></div>
      <div class="stat"><span>Total projects</span><b>${list.length}</b></div>
      <div class="stat"><span>Approved</span><b>${list.filter((p) => p.approval_status === "APPROVED").length}</b></div>
      <div class="stat"><span>Pending</span><b>${list.filter((p) => p.approval_status === "PENDING").length}</b></div>
      <div class="stat"><span>Rejected</span><b>${list.filter((p) => p.approval_status === "REJECTED").length}</b></div>
      <div class="stat"><span>Total votes</span><b>${votes?.length ?? 0}</b></div>
    </div>
    <div class="actions">
      <a class="btn" href="projects.html">Open projects</a>
    </div>`;
}

async function adminProjects() {
  const { data: projects, error } = await supabase.rpc("organiser_projects");
  const app = document.getElementById("app");
  if (error) {
    app.innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
    return;
  }
  app.innerHTML = `<h1>Projects</h1>
    <p class="muted">Approve or reject from this list.</p>
    ${(projects ?? [])
      .map(
        (p) => `<article class="card" style="margin-top:.8rem"><div class="body">
        <h2>${escapeHtml(p.model_name)}</h2>
        <p class="muted">${escapeHtml(p.project_code)} · ${p.class_group === "A" ? "Group A" : "Group B"} · ${escapeHtml(p.approval_status)}</p>
        <div class="actions">
          <button class="btn" data-act="APPROVED" data-id="${p.id}" type="button">Approve</button>
          <button class="btn line" data-act="REJECTED" data-id="${p.id}" type="button">Reject</button>
          <a class="btn line" href="project.html?id=${p.id}">View</a>
        </div>
      </div></article>`
      )
      .join("")}`;
  app.querySelectorAll("[data-act]").forEach((btn) => {
    btn.onclick = async () => {
      const status = btn.getAttribute("data-act");
      const { data } = await supabase.rpc("organiser_set_status", {
        p_project_id: btn.getAttribute("data-id"),
        p_status: status,
        p_reason: status === "REJECTED" ? "Does not meet exhibition guidelines" : null,
      });
      if (!data?.ok) alert(data?.message || "Could not update");
      else location.reload();
    };
  });
}

function detailRow(label, value) {
  const text = String(value ?? "").trim();
  return `<div class="drow"><dt>${label}</dt><dd>${text ? escapeHtml(text) : "—"}</dd></div>`;
}

function phoneRow(label, value) {
  const digits = String(value ?? "").replace(/\s/g, "");
  if (!digits) return `<div class="drow"><dt>${label}</dt><dd>—</dd></div>`;
  return `<div class="drow"><dt>${label}</dt><dd><a href="tel:${escapeHtml(digits)}">${escapeHtml(digits)}</a></dd></div>`;
}

function dayLabel(day) {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(day);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function adminProject() {
  const id = qs("id");
  const app = document.getElementById("app");
  const { data: detail, error } = await supabase.rpc("organiser_project_detail", { p_project_id: id });
  if (error) {
    app.innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
    return;
  }
  const p = detail?.project;
  if (!p) {
    app.innerHTML = `<p class="alert err">Project not found.</p>`;
    return;
  }
  const student = detail.student ?? {};
  const members = detail.members ?? [];
  const urls = await mediaUrls([p.cover_image_url, ...(detail.media ?? []).map((m) => m.media_url)]);
  const photos = [...new Set([...urls.values()].filter(Boolean))];
  const memberText = members.length
    ? members.map((m) => `${m.student_name}${m.class_name ? ` (Class ${m.class_name})` : ""}`).join(", ")
    : p.team_display_names;

  app.innerHTML = `<p><a href="projects.html">← Projects</a></p>
    <h1>${escapeHtml(p.model_name)}</h1>
    <p class="muted">${escapeHtml(p.project_code)} · ${groupName(p.class_group)} · ${escapeHtml(p.approval_status)}</p>
    ${photos.length ? `<div class="gallery">${photos.map((u) => `<img src="${u}" alt="" />`).join("")}</div>` : ""}
    <dl class="detail">
      ${detailRow("Project name", p.model_name)}
      ${detailRow("Project description", p.description)}
      ${detailRow("Member", memberText)}
      ${detailRow("Class", normalizeClass(p.class_name))}
      ${detailRow("School", p.school_name)}
      ${detailRow("Group", groupName(p.class_group))}
      ${detailRow("Category", p.category)}
      ${detailRow("Guidance / mentor", p.mentor_name)}
      ${detailRow("Project code", p.project_code)}
      ${detailRow("Approval status", p.approval_status)}
      ${p.rejection_reason ? detailRow("Rejection reason", p.rejection_reason) : ""}
      ${detailRow("Votes received", detail.vote_count ?? 0)}
      ${detailRow("Registered by", student.student_names)}
      ${phoneRow("Contact number", student.contact_number)}
      ${phoneRow("WhatsApp", student.whatsapp_number)}
      ${detailRow("Guardian", student.guardian_name)}
      ${phoneRow("Guardian contact", student.guardian_contact)}
      ${detailRow("Submitted on", p.created_at ? dayLabel(String(p.created_at).slice(0, 10)) : "")}
    </dl>
    ${
      members.length
        ? `<h3>Team members</h3>
      <table><thead><tr><th>Name</th><th>Class</th><th>School</th></tr></thead><tbody>${members
        .map(
          (m) =>
            `<tr><td>${escapeHtml(m.student_name)}</td><td>${escapeHtml(normalizeClass(m.class_name))}</td><td>${escapeHtml(m.school_name || "")}</td></tr>`
        )
        .join("")}</tbody></table>`
        : ""
    }
    <div class="actions">
      <button class="btn" id="ap" type="button">Approve</button>
      <button class="btn line" id="rj" type="button">Reject</button>
      <button class="btn line" id="pd" type="button">Reset to pending</button>
    </div>`;
  const set = async (status) => {
    await supabase.rpc("organiser_set_status", {
      p_project_id: id,
      p_status: status,
      p_reason: status === "REJECTED" ? "Does not meet exhibition guidelines" : null,
    });
    location.reload();
  };
  document.getElementById("ap").onclick = () => set("APPROVED");
  document.getElementById("rj").onclick = () => set("REJECTED");
  document.getElementById("pd").onclick = () => set("PENDING");
}

/** The Students screen was removed; keep old links working. */
function adminStudents() {
  location.replace("projects.html");
}

async function adminVotes() {
  const app = document.getElementById("app");
  const [{ data: votes, error }, { data: totals }] = await Promise.all([
    supabase.rpc("organiser_votes"),
    supabase.rpc("organiser_vote_totals"),
  ]);
  if (error) {
    app.innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
    return;
  }
  const list = votes ?? [];
  const totalsList = totals ?? [];
  const totalsFor = (g) => totalsList.filter((r) => r.class_group === g);

  const totalsTable = (g) => {
    const rows = totalsFor(g);
    return `<h3>${groupName(g)} · ${rows.reduce((n, r) => n + r.vote_count, 0)} votes</h3>
      <table><thead><tr><th>#</th><th>Project</th><th>Code</th><th>Votes</th></tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (r, i) =>
                  `<tr><td>${i + 1}</td><td>${escapeHtml(r.project_name)}</td><td>${escapeHtml(r.project_code)}</td><td>${r.vote_count}</td></tr>`
              )
              .join("")
          : `<tr><td colspan="4">No approved projects in this group.</td></tr>`
      }</tbody></table>`;
  };

  app.innerHTML = `<h1>Votes</h1>
    <p class="muted">Each voter gets one vote in Group A and one in Group B. Records cannot be edited.</p>
    <div class="stats">
      <div class="stat"><span>Total votes</span><b>${list.length}</b></div>
      <div class="stat"><span>Group A votes</span><b>${list.filter((v) => v.class_group === "A").length}</b></div>
      <div class="stat"><span>Group B votes</span><b>${list.filter((v) => v.class_group === "B").length}</b></div>
      <div class="stat"><span>Voters</span><b>${new Set(list.map((v) => v.voter_email)).size}</b></div>
    </div>
    <h2>Vote totals</h2>
    ${totalsTable("A")}
    ${totalsTable("B")}
    <h2>Who voted for what</h2>
    <table><thead><tr><th>Voter</th><th>Email</th><th>Project</th><th>Group</th><th>When</th></tr></thead>
    <tbody>${
      list.length
        ? list
            .map(
              (v) =>
                `<tr><td>${escapeHtml(v.voter_name || "—")}</td><td>${escapeHtml(v.voter_email || "—")}</td><td>${escapeHtml(
                  v.project_name || "—"
                )}</td><td>${groupName(v.class_group)}</td><td>${escapeHtml(String(v.created_at || "").slice(0, 16).replace("T", " "))}</td></tr>`
            )
            .join("")
        : `<tr><td colspan="5">No votes yet.</td></tr>`
    }</tbody></table>`;
}

async function adminAttendance() {
  const group = (qs("group") || "A").toUpperCase() === "B" ? "B" : "A";
  const app = document.getElementById("app");
  const { data: rows, error } = await supabase.rpc("organiser_attendance", { p_class_group: group });
  if (error) {
    app.innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
    return;
  }
  const list = rows ?? [];
  const byDay = new Map();
  for (const r of list) {
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  }

  const statusSelect = (r) =>
    `<select class="mini" data-att data-project="${r.project_id}" data-day="${r.day}">
      ${["EXPECTED", "PRESENT", "ABSENT"]
        .map(
          (s) =>
            `<option value="${s}" ${r.status === s ? "selected" : ""}>${s === "EXPECTED" ? "Not marked" : s === "PRESENT" ? "Came" : "Did not come"}</option>`
        )
        .join("")}
    </select>`;

  const phone = (n) => {
    const digits = String(n ?? "").replace(/\s/g, "");
    return digits ? `<a href="tel:${escapeHtml(digits)}">${escapeHtml(digits)}</a>` : "—";
  };

  app.innerHTML = `<h1>Attendance</h1>
    <p class="muted">Group A exhibits on 14 and 15 September, Group B on 17 and 18 September. Mark who came; call anyone who did not.</p>
    <div class="chips">
      <a class="${group === "A" ? "on" : ""}" href="attendance.html?group=A">Group A</a>
      <a class="${group === "B" ? "on" : ""}" href="attendance.html?group=B">Group B</a>
    </div>
    ${
      byDay.size
        ? [...byDay.entries()]
            .map(
              ([day, dayRows]) => `<h2>${dayLabel(day)}</h2>
      <div class="stats">
        <div class="stat"><span>Expected</span><b>${dayRows.length}</b></div>
        <div class="stat"><span>Came</span><b>${dayRows.filter((r) => r.status === "PRESENT").length}</b></div>
        <div class="stat"><span>Did not come</span><b>${dayRows.filter((r) => r.status === "ABSENT").length}</b></div>
        <div class="stat"><span>Not marked</span><b>${dayRows.filter((r) => r.status === "EXPECTED").length}</b></div>
      </div>
      <div class="scroll-x">
      <table><thead><tr>
        <th>Project</th><th>Class</th><th>School</th><th>Members</th>
        <th>Contact</th><th>WhatsApp</th><th>Guardian</th><th>Guardian contact</th><th>Attendance</th>
      </tr></thead>
      <tbody>${dayRows
        .map(
          (r) => `<tr>
          <td><a href="project.html?id=${r.project_id}">${escapeHtml(r.project_name)}</a><br /><span class="muted">${escapeHtml(
            r.project_code
          )}</span></td>
          <td>${escapeHtml(normalizeClass(r.class_name))}</td>
          <td>${escapeHtml(r.school_name || "")}</td>
          <td>${escapeHtml(r.team_display_names || "")}</td>
          <td>${phone(r.contact_number)}</td>
          <td>${phone(r.whatsapp_number)}</td>
          <td>${escapeHtml(r.guardian_name || "—")}</td>
          <td>${phone(r.guardian_contact)}</td>
          <td>${statusSelect(r)}</td>
        </tr>`
        )
        .join("")}</tbody></table></div>`
            )
            .join("")
        : `<p class="muted">No approved projects in ${groupName(group)} yet.</p>`
    }
    <p id="att-msg"></p>`;

  app.querySelectorAll("[data-att]").forEach((sel) => {
    sel.onchange = async () => {
      const msg = document.getElementById("att-msg");
      sel.disabled = true;
      const { data, error: setErr } = await supabase.rpc("organiser_set_attendance", {
        p_project_id: sel.dataset.project,
        p_day: sel.dataset.day,
        p_status: sel.value,
      });
      sel.disabled = false;
      msg.innerHTML =
        setErr || !data?.ok
          ? `<span class="alert err">${escapeHtml(setErr?.message || data?.message || "Could not save.")}</span>`
          : `<span class="alert ok">Saved.</span>`;
    };
  });
}

/** datetime-local needs "YYYY-MM-DDTHH:mm" in local time. */
function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function adminSettings() {
  const app = document.getElementById("app");
  const [{ data: rows, error }, { data: groups }] = await Promise.all([
    supabase.rpc("organiser_settings"),
    supabase.rpc("organiser_group_voting"),
  ]);
  if (error) {
    app.innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
    return;
  }
  const s = rows?.[0];
  const byGroup = new Map((groups ?? []).map((g) => [g.class_group, g]));

  const groupForm = (g) => {
    const row = byGroup.get(g) ?? {};
    return `<form class="form" data-group-form="${g}">
      <h2>${groupName(g)} voting</h2>
      <label><input type="checkbox" name="voting_enabled" ${row.voting_enabled ? "checked" : ""} /> Voting open for ${groupName(g)}</label>
      <label>Start date and time</label>
      <input type="datetime-local" name="voting_start" value="${toLocalInput(row.voting_start)}" />
      <label>End date and time</label>
      <input type="datetime-local" name="voting_end" value="${toLocalInput(row.voting_end)}" />
      <button class="btn">Save ${groupName(g)}</button>
      <p data-msg></p>
    </form>`;
  };

  app.innerHTML = `<h1>Settings</h1>
    <form class="form" id="s">
      <h2>Master switches</h2>
      <label><input type="checkbox" name="voting_enabled" ${s?.voting_enabled ? "checked" : ""} /> Voting enabled (turns both groups off when unchecked)</label>
      <label><input type="checkbox" name="results_visible" ${s?.results_visible ? "checked" : ""} /> Show public results</label>
      <button class="btn">Save</button>
      <p id="ok"></p>
    </form>
    <div class="two-up">${groupForm("A")}${groupForm("B")}</div>`;

  document.getElementById("s").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { data } = await supabase.rpc("organiser_save_settings", {
      p_voting_enabled: fd.get("voting_enabled") === "on",
      p_results_visible: fd.get("results_visible") === "on",
    });
    document.getElementById("ok").innerHTML = data?.ok
      ? `<p class="alert ok">Saved.</p>`
      : `<p class="alert err">${escapeHtml(data?.message || "Failed")}</p>`;
  };

  app.querySelectorAll("[data-group-form]").forEach((form) => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const msg = form.querySelector("[data-msg]");
      const { data, error: saveErr } = await supabase.rpc("organiser_save_group_voting", {
        p_class_group: form.dataset.groupForm,
        p_voting_enabled: fd.get("voting_enabled") === "on",
        p_voting_start: fd.get("voting_start") ? new Date(String(fd.get("voting_start"))).toISOString() : null,
        p_voting_end: fd.get("voting_end") ? new Date(String(fd.get("voting_end"))).toISOString() : null,
      });
      msg.innerHTML =
        saveErr || !data?.ok
          ? `<p class="alert err">${escapeHtml(saveErr?.message || data?.message || "Failed")}</p>`
          : `<p class="alert ok">Saved.</p>`;
    };
  });
}
