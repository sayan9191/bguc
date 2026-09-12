import { COLS, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";
import { t, escapeHtml, wordCount, classOptions, isOtherClass, normalizeClass } from "./i18n.js";
import { supabase, mediaUrl, preview, qs } from "./db.js";
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
  if (page === "admin-students") await adminStudents();
  if (page === "admin-votes") await adminVotes();
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
  `;
  let query = supabase.from("projects").select(COLS).eq("approval_status", "APPROVED").order("model_name");
  if (group === "A" || group === "B") query = query.eq("class_group", group);
  if (q) query = query.or(`model_name.ilike.%${q}%,school_name.ilike.%${q}%,team_display_names.ilike.%${q}%`);
  const { data: projects } = await query;
  const { data: settings } = await supabase.from("exhibition_settings").select("*").eq("id", 1).maybeSingle();
  const { data: counts } = settings?.results_visible ? await supabase.rpc("public_vote_counts") : { data: [] };
  const countMap = new Map((counts ?? []).map((c) => [c.project_id, c.vote_count]));
  await showMyVotes();
  const list = document.getElementById("list");
  if (!projects?.length) {
    list.innerHTML = `<p class="muted">No approved projects yet.</p>`;
    return;
  }
  const cards = await Promise.all(
    projects.map(async (p) => {
      const image = await mediaUrl(p.cover_image_url);
      const votes = settings?.results_visible ? countMap.get(p.id) ?? 0 : null;
      const g = p.class_group === "A" ? t("groupA") : p.class_group === "B" ? t("groupB") : "";
      const text = preview(p.description);
      const klass = String(p.class_name || "").replace(/^Class\s+/i, "");
      return `<article class="card">
        <div class="thumb">${image ? `<img src="${image}" alt="" />` : `<span class="muted">${t("noImage")}</span>`}</div>
        <div class="body">
          <div style="display:flex;justify-content:space-between;gap:.5rem">
            <h2>${escapeHtml(p.model_name)}</h2>
            ${g ? `<span class="badge">${g}</span>` : ""}
          </div>
          <p class="muted">${escapeHtml(text)} <a href="project.html?id=${p.id}">${t("viewMore")}</a></p>
          <p class="muted">${escapeHtml(p.school_name || "")}</p>
          <p class="muted">${klass ? `Class ${escapeHtml(klass)}` : ""}</p>
          <p>${escapeHtml(p.team_display_names || "")}</p>
          ${votes == null ? "" : `<p>${votes} ${t("votesCount")}</p>`}
          <div class="row2">
            <a class="btn line" href="project.html?id=${p.id}">${t("view")}</a>
            <a class="btn" href="project.html?id=${p.id}&vote=1">${t("vote")}</a>
          </div>
        </div>
      </article>`;
    })
  );
  list.innerHTML = cards.join("");
}

/** Tells a signed-in voter which of their two group votes are still unused. */
async function showMyVotes() {
  const box = document.getElementById("my-votes");
  if (!box) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase.rpc("my_group_votes");
  const used = data ?? {};
  const parts = ["A", "B"].map((g) => {
    const label = groupName(g);
    return used[g]?.voted
      ? `${label}: voted${used[g].project_name ? ` for ${escapeHtml(used[g].project_name)}` : ""}`
      : `${label}: vote still available`;
  });
  box.innerHTML = parts.join(" · ");
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
  const votedName = myVote?.project_name || "";
  app.innerHTML = `
    ${photos.length ? `<div class="gallery">${photos.map((u) => `<img src="${u}" alt="" />`).join("")}</div>` : ""}
    <p class="muted">${escapeHtml(p.project_code)}</p>
    <h1>${escapeHtml(p.model_name)}</h1>
    <p>${escapeHtml(p.description || "")}</p>
    <p class="muted">${escapeHtml(p.school_name || "")} · Class ${escapeHtml(p.class_name || "")} · ${groupLabel}</p>
    <p>${escapeHtml(p.team_display_names || "")}</p>
    ${p.mentor_name ? `<p class="muted">Mentor: ${escapeHtml(p.mentor_name)}</p>` : ""}
    ${(members ?? []).length ? `<h3>Members</h3><ul>${members.map((m) => `<li>${escapeHtml(m.student_name)} · ${escapeHtml(m.class_name)}</li>`).join("")}</ul>` : ""}
    <p id="msg">${
      voted
        ? `<span class="alert">You already used your ${groupLabel} vote${votedName ? ` for ${escapeHtml(votedName)}` : ""}.</span>`
        : ""
    }</p>
    <button class="btn" id="vote" type="button">${t("vote")} in ${groupLabel}</button>
    <div id="modal"></div>
  `;
  document.getElementById("vote").onclick = () => startVote(id, p.model_name, user, voted, votedName, groupLabel);
  if (qs("vote") === "1") document.getElementById("vote").click();
}

function groupName(group) {
  return group === "A" ? "Group A" : "Group B";
}

function startVote(id, name, user, voted, votedName, groupLabel) {
  const msg = document.getElementById("msg");
  if (!user) {
    location.href = `${path("login.html")}?next=${encodeURIComponent(`project.html?id=${id}&vote=1`)}`;
    return;
  }
  if (voted) {
    msg.innerHTML = `<p class="alert err">You already used your ${groupLabel} vote${
      votedName ? ` for ${escapeHtml(votedName)}` : ""
    }. ${t("voteRule")}</p>`;
    return;
  }
  document.getElementById("modal").innerHTML = `<div class="modal"><div class="box">
    <h2>Confirm ${groupLabel} vote</h2>
    <p>You are voting for: <strong>${escapeHtml(name)}</strong></p>
    <p class="muted">This uses your one ${groupLabel} vote and cannot be changed. Are you sure?</p>
    <div class="actions">
      <button class="btn line" id="no" type="button">Cancel</button>
      <button class="btn" id="yes" type="button">Confirm vote</button>
    </div>
  </div></div>`;
  document.getElementById("no").onclick = () => {
    document.getElementById("modal").innerHTML = "";
  };
  document.getElementById("yes").onclick = async () => {
    const { data, error } = await supabase.rpc("submit_vote", { p_project_id: id });
    document.getElementById("modal").innerHTML = "";
    if (error) {
      msg.innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
      return;
    }
    if (data?.ok) msg.innerHTML = `<p class="alert ok">${escapeHtml(data.message || `Your ${groupLabel} vote has been submitted.`)}</p>`;
    else msg.innerHTML = `<p class="alert err">${escapeHtml(data?.message || "Could not submit vote.")}</p>`;
  };
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

async function adminProject() {
  const id = qs("id");
  const { data: all } = await supabase.rpc("organiser_projects");
  const p = (all ?? []).find((x) => x.id === id);
  const app = document.getElementById("app");
  if (!p) {
    app.innerHTML = `<p class="alert err">Project not found.</p>`;
    return;
  }
  const { data: media } = await supabase.rpc("organiser_project_media", { p_project_id: id });
  const { data: members } = await supabase.rpc("organiser_project_members", { p_project_id: id });
  const cover = await mediaUrl(p.cover_image_url);
  const photos = [cover];
  for (const m of media ?? []) photos.push(await mediaUrl(m.media_url));
  const unique = [...new Set(photos.filter(Boolean))];
  app.innerHTML = `<a href="projects.html">← Projects</a>
    ${unique.length ? `<div class="gallery">${unique.map((u) => `<img src="${u}" alt="" />`).join("")}</div>` : ""}
    <h1>${escapeHtml(p.model_name)}</h1>
    <p class="muted">${escapeHtml(p.project_code)} · ${escapeHtml(p.approval_status)}</p>
    <p>${escapeHtml(p.description || "")}</p>
    <p class="muted">${escapeHtml(p.school_name)} · Class ${escapeHtml(p.class_name)}</p>
    <p>${escapeHtml(p.team_display_names || "")}</p>
    ${(members ?? []).length ? `<h3>Members</h3><ul>${members.map((m) => `<li>${escapeHtml(m.student_name)}</li>`).join("")}</ul>` : ""}
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

async function adminStudents() {
  const { data: students, error } = await supabase.rpc("organiser_students");
  const app = document.getElementById("app");
  if (error) {
    app.innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
    return;
  }
  app.innerHTML = `<h1>Students</h1>
    <table><thead><tr><th>Name</th><th>Class</th><th>School</th><th>Mobile</th></tr></thead>
    <tbody>${(students ?? [])
      .map(
        (s) =>
          `<tr><td>${escapeHtml(s.student_names)}</td><td>${escapeHtml(s.class_name)}</td><td>${escapeHtml(s.school_name)}</td><td>${escapeHtml(s.contact_number)}</td></tr>`
      )
      .join("")}</tbody></table>`;
}

async function adminVotes() {
  const { data: votes, error } = await supabase.rpc("organiser_votes");
  const app = document.getElementById("app");
  if (error) {
    app.innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
    return;
  }
  app.innerHTML = `<h1>Vote records</h1>
    <p class="muted">One Google account equals one vote. Records cannot be edited here.</p>
    <table><thead><tr><th>When</th><th>Project</th></tr></thead>
    <tbody>${(votes ?? [])
      .map((v) => `<tr><td>${escapeHtml(String(v.created_at || "").slice(0, 19))}</td><td>${escapeHtml(v.project_name)}</td></tr>`)
      .join("")}</tbody></table>`;
}

async function adminSettings() {
  const { data: rows, error } = await supabase.rpc("organiser_settings");
  const s = rows?.[0];
  const app = document.getElementById("app");
  if (error) {
    app.innerHTML = `<p class="alert err">${escapeHtml(error.message)}</p>`;
    return;
  }
  app.innerHTML = `<form class="form" id="s">
    <h1>Settings</h1>
    <label><input type="checkbox" name="voting_enabled" ${s?.voting_enabled ? "checked" : ""} /> Voting enabled</label>
    <label><input type="checkbox" name="results_visible" ${s?.results_visible ? "checked" : ""} /> Show public results</label>
    <button class="btn">Save</button>
    <p id="ok"></p>
  </form>`;
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
}
