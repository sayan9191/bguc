const nav = document.getElementById("nav");
const menuBtn = document.getElementById("menu-btn");
const links = document.getElementById("links");
const stage = document.getElementById("stage");
const form = document.getElementById("enquiry");
const msg = document.getElementById("form-msg");
const cursor = document.getElementById("cursor");
const fine = matchMedia("(pointer: fine)").matches;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const closeMenu = () => {
  nav?.classList.remove("open");
  menuBtn?.setAttribute("aria-expanded", "false");
};

window.addEventListener(
  "scroll",
  () => {
    nav?.classList.toggle("on", window.scrollY > 12);
  },
  { passive: true }
);

menuBtn?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(open));
});

links?.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));

if (stage && fine && !reduce) {
  stage.addEventListener("mousemove", (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    stage.style.setProperty("--px", `${x * 14}px`);
    stage.style.setProperty("--py", `${y * 10}px`);
  });
}

if (stage) {
  for (let i = 0; i < 16; i += 1) {
    const s = document.createElement("span");
    s.className = "spark";
    s.style.left = `${8 + Math.random() * 84}%`;
    s.style.top = `${10 + Math.random() * 70}%`;
    s.style.animationDelay = `${-Math.random() * 7}s`;
    s.style.animationDuration = `${6 + Math.random() * 5}s`;
    stage.appendChild(s);
  }
}

if (fine && !reduce) {
  document.querySelectorAll(".mag").forEach((btn) => {
    btn.addEventListener("mousemove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.12}px, ${(e.clientY - r.top - r.height / 2) * 0.18}px)`;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "";
    });
  });
}

if (cursor && fine && !reduce) {
  window.addEventListener("pointermove", (e) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  });
  document.querySelectorAll("a, button, input, select, textarea").forEach((el) => {
    el.addEventListener("mouseenter", () => cursor.classList.add("on"));
    el.addEventListener("mouseleave", () => cursor.classList.remove("on"));
  });
}

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
);
document.querySelectorAll(".io, .timeline").forEach((el) => io.observe(el));

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const phoneOk = (v) => v.replace(/\D/g, "").length >= 10;

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  if (!String(data.name || "").trim()) return setMsg("Please enter your name.", true);
  if (!emailOk(String(data.email || ""))) return setMsg("Please enter a valid email.", true);
  if (!phoneOk(String(data.phone || ""))) return setMsg("Please enter a valid phone number.", true);
  if (!String(data.message || "").trim()) return setMsg("Please tell us about the project.", true);

  const payload = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    company: data.company || "-",
    type: data.type,
    message: data.message,
    _subject: "InfusedByte website enquiry",
  };

  try {
    const res = await fetch("https://formsubmit.co/ajax/connect@infusedbyte.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("send failed");
    setMsg("Thank you. Your enquiry has been sent.", false);
    form.reset();
  } catch {
    const body = [
      `Name: ${payload.name}`,
      `Email: ${payload.email}`,
      `Phone: ${payload.phone}`,
      `Company: ${payload.company}`,
      `Project type: ${payload.type}`,
      "",
      payload.message,
    ].join("\n");
    window.location.href = `mailto:connect@infusedbyte.com?subject=${encodeURIComponent("InfusedByte enquiry")}&body=${encodeURIComponent(body)}`;
    setMsg("Opening your email app to send the enquiry.", false);
  }
});

function setMsg(text, err) {
  if (!msg) return;
  msg.textContent = text;
  msg.className = `msg ${err ? "err" : "ok"}`;
}
