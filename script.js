console.log("script loaded ✅");
document.getElementById("btnLogin")?.addEventListener("click", () => console.log("Login clicked ✅"));
"use strict";

/* =========================
   1) Supabase Config
========================= */
const SUPABASE_URL = "https://qcfnilswrabwtkitbofj.supabase.co/";
const SUPABASE_KEY = "sb_publishable_v4TO8Lh2upbkp9byJRBgUA_PSarae05";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
/* =========================
   2) Helpers
========================= */
function $(id) {
  return document.getElementById(id);
}


async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await sb.from("profiles").select("full_name,email,avatar_url").eq("id", userId).maybeSingle();
  if (error) {
    console.warn("fetchProfile error:", error.message);
    return null;
  }
  return data || null;
}

function emailToNiceName(email) {
  if (!email) return "Guest";
  const beforeAt = email.split("@")[0] || email;
  // تحويل بسيط: raghad_hezemy -> Raghad Hezemy
  return beforeAt
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function getDisplayNameFromSession(session) {
  const user = session?.user;
  if (!user) return "Guest";

  // 1) profiles table
  const profile = await fetchProfile(user.id);
  if (profile?.full_name) return profile.full_name;

  // 2) user metadata
  const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
  if (metaName) return metaName;

  // 3) fallback to email
  return emailToNiceName(user.email);
}

async function ensureProfile(session) {
  const user = session?.user;
  if (!user) return;

  // إذا موجودة خلاص
  const existing = await fetchProfile(user.id);
  if (existing?.full_name || existing?.email) return;

  const full_name = user.user_metadata?.full_name || user.user_metadata?.name || emailToNiceName(user.email);
  const email = user.email;

  const { error } = await sb.from("profiles").upsert(
    { id: user.id, full_name, email },
    { onConflict: "id" }
  );

  if (error) console.warn("ensureProfile upsert error:", error.message);
}

function openAuthModal(tab = "login") {
  const modal = $("authModal");
  if (!modal) return;

  // tabs
  const loginTab = $("tabLogin");
  const signupTab = $("tabSignup");
  const loginPane = $("loginPane");
  const signupPane = $("signupPane");

  if (loginTab && signupTab && loginPane && signupPane) {
    const isLogin = tab === "login";
    loginTab.classList.toggle("active", isLogin);
    signupTab.classList.toggle("active", !isLogin);
    loginPane.hidden = !isLogin;
    signupPane.hidden = isLogin;
  }

  modal.style.display = "flex";
}

function closeAuthModal() {
  const modal = $("authModal");
  if (!modal) return;
  modal.style.display = "none";
}

function bindAuthUI() {
  // Buttons (top right)
  const btnLogin = $("btnLogin");
  const btnSignup = $("btnSignup");
  const btnLogout = $("btnLogout");

  if (btnLogin) btnLogin.addEventListener("click", () => openAuthModal("login"));
  if (btnSignup) btnSignup.addEventListener("click", () => openAuthModal("signup"));

  if (btnLogout) btnLogout.addEventListener("click", async () => {
    await sb.auth.signOut();
  });

  // Modal close
  const closeBtn = $("authClose");
  if (closeBtn) closeBtn.addEventListener("click", closeAuthModal);

  const overlay = $("authModal");
  if (overlay) overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeAuthModal();
  });

  // Tabs
  const tabLogin = $("tabLogin");
  const tabSignup = $("tabSignup");
  if (tabLogin) tabLogin.addEventListener("click", () => openAuthModal("login"));
  if (tabSignup) tabSignup.addEventListener("click", () => openAuthModal("signup"));

  // Forms
  const loginForm = $("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await doLogin();
    });
  }

  const signupForm = $("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await doSignup();
    });
  }
}

function openModal(id) {
  const m = $(id);
  if (m) m.style.display = "flex";
}
function closeModal(id) {
  const m = $(id);
  if (m) m.style.display = "none";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function getUser() {
  const { data } = await sb.auth.getUser();
  return data.user;
}

function displayName(user) {
  const n = user?.user_metadata?.full_name || user?.user_metadata?.name;
  if (n && String(n).trim()) return String(n).trim();
  const email = user?.email || "";
  return email.includes("@") ? email.split("@")[0] : "User";
}

function isEl(id) {
  return !!document.getElementById(id);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* =========================
   3) Auth UI + Actions
========================= */

async function updateAuthUI() {
  const { data } = await sb.auth.getSession();
  const session = data?.session || null;

  // Ensure profile row exists (optional but useful)
  if (session) await ensureProfile(session);

  const name = await getDisplayNameFromSession(session);

  // Common UI targets
  const userNameEl = $("userName");
  const sidebarNameEl = $("sidebarName");
  const welcomeNameEl = $("welcomeName");
  const userEmailEl = $("userEmail");

  if (userNameEl) userNameEl.textContent = name;
  if (sidebarNameEl) sidebarNameEl.textContent = name;
  if (welcomeNameEl) welcomeNameEl.textContent = name;

  if (userEmailEl) userEmailEl.textContent = session?.user?.email || "";

  // Toggle auth buttons visibility
  const btnLogin = $("btnLogin");
  const btnSignup = $("btnSignup");
  const btnLogout = $("btnLogout");

  const isAuthed = !!session;
  if (btnLogin) btnLogin.style.display = isAuthed ? "none" : "inline-flex";
  if (btnSignup) btnSignup.style.display = isAuthed ? "none" : "inline-flex";
  if (btnLogout) btnLogout.style.display = isAuthed ? "inline-flex" : "none";

  // If logged in, close modal
  if (isAuthed) closeAuthModal();
}


async function doSignup() {
  const fullName = ($("signupName")?.value || "").trim();
  const email = ($("signupEmail")?.value || "").trim();
  const pass = $("signupPassword")?.value || "";

  if (!fullName || !email || !pass) return alert("Please fill all fields.");

  // Redirect back to current page (make sure it's in Supabase Redirect URLs)
  const redirectTo = window.location.href;

  const { data, error } = await sb.auth.signUp({
    email,
    password: pass,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: redirectTo
    }
  });

  if (error) return alert("Signup error: " + error.message);

  // If email confirmation is OFF, session may exist immediately
  if (data?.session) await ensureProfile(data.session);

  alert("تم إنشاء الحساب ✅ افحصي الإيميل للتأكيد (إذا التفعيل مطلوب).");
  closeAuthModal();
}


async function doLogin() {
  try {
    const email = ($("loginEmail")?.value || "").trim();
    const pass = $("loginPassword")?.value || "";

    if (!email || !pass) return alert("Please enter email + password.");

    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) return alert("Login error: " + error.message);

    if (data?.session) await ensureProfile(data.session);

    await updateAuthUI();
    closeAuthModal();

  } catch (e) {
    alert("Login crashed: " + (e?.message || e));
    console.error(e);
  }
}

async function doLogout() {
  const { error } = await sb.auth.signOut();
  if (error) return alert("Logout error: " + error.message);
  await updateAuthUI();
}

/* =========================
   4) Tasks (CRUD)
========================= */
let tasksCache = [];

async function loadTasks() {
  if (!isEl("tasksContainer") && !isEl("dashboardTasks")) return;

  const user = await getUser();
  if (!user) return;

  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("deadline", { ascending: true });

  if (error) return alert("Load tasks error: " + error.message);
  tasksCache = data || [];

  if (isEl("tasksContainer")) renderTasks(tasksCache);
  if (isEl("dashboardTasks")) renderDashboardTasks(tasksCache.slice(0, 5));
}

function renderTasks(tasks) {
  const c = $("tasksContainer");
  if (!c) return;

  const q = ($("taskSearch")?.value || "").trim().toLowerCase();
  const list = q ? tasks.filter(t => (t.title || "").toLowerCase().includes(q)) : tasks;

  if (!list.length) {
    c.innerHTML = `<p class="muted">No tasks yet.</p>`;
    return;
  }

  c.innerHTML = "";
  list.forEach(t => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="item-left">
        <b>${escapeHtml(t.title)}</b>
        <div class="muted">Due: ${t.deadline ?? "-"} • Progress: ${t.progress_percent ?? 0}% • Status: ${t.status}</div>
      </div>
      <div class="item-actions">
        <button class="secondary-btn" data-act="edit" data-id="${t.task_id}">Edit</button>
        <button class="primary-btn" data-act="toggle" data-id="${t.task_id}" data-status="${t.status}">
          ${t.status === "done" ? "Undo" : "Done"}
        </button>
        <button class="danger-btn" data-act="del" data-id="${t.task_id}">Delete</button>
      </div>
    `;
    c.appendChild(div);
  });

  c.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      if (act === "del") return await deleteTask(id);
      if (act === "toggle") return await toggleTask(id, btn.getAttribute("data-status"));
      if (act === "edit") return openEditTask(id);
    });
  });
}

function renderDashboardTasks(tasks) {
  const c = $("dashboardTasks");
  if (!c) return;

  if (!tasks.length) {
    c.innerHTML = `<p class="muted">No tasks yet.</p>`;
    return;
  }

  c.innerHTML = tasks.map(t => `
    <div class="mini-row">
      <span><b>${escapeHtml(t.title)}</b></span>
      <span class="muted">${t.deadline ?? "-"}</span>
    </div>
  `).join("");
}

function openAddTask() {
  if (!isEl("taskModal")) return;
  if (isEl("taskModalTitle")) $("taskModalTitle").textContent = "Add Task";
  if (isEl("taskId")) $("taskId").value = "";
  if (isEl("taskTitle")) $("taskTitle").value = "";
  if (isEl("taskDeadline")) $("taskDeadline").value = "";
  if (isEl("taskProgress")) $("taskProgress").value = 0;
  openModal("taskModal");
}

function openEditTask(taskId) {
  const t = tasksCache.find(x => x.task_id === taskId);
  if (!t) return;
  if (isEl("taskModalTitle")) $("taskModalTitle").textContent = "Edit Task";
  $("taskId").value = t.task_id;
  $("taskTitle").value = t.title || "";
  $("taskDeadline").value = t.deadline || "";
  $("taskProgress").value = t.progress_percent ?? 0;
  openModal("taskModal");
}

async function saveTask() {
  const user = await getUser();
  if (!user) return alert("Login first.");

  const id = ($("taskId")?.value || "").trim();
  const title = ($("taskTitle")?.value || "").trim();
  const deadline = $("taskDeadline")?.value || null;
  const progress = Number($("taskProgress")?.value || 0);

  if (!title) return alert("Enter task title.");

  if (!id) {
    const { error } = await sb.from("tasks").insert({
      user_id: user.id,
      title,
      deadline,
      status: "pending",
      progress_percent: progress
    });
    if (error) return alert("Add task error: " + error.message);
  } else {
    const { error } = await sb
      .from("tasks")
      .update({ title, deadline, progress_percent: progress })
      .eq("task_id", id);
    if (error) return alert("Update task error: " + error.message);
  }

  closeModal("taskModal");
  await loadTasks();
  await refreshStats();
  await loadPerformance();
}

async function deleteTask(taskId) {
  const { error } = await sb.from("tasks").delete().eq("task_id", taskId);
  if (error) return alert("Delete task error: " + error.message);
  await loadTasks();
  await refreshStats();
  
  await loadPerformance();
}

async function toggleTask(taskId, currentStatus) {
  const next = currentStatus === "done" ? "pending" : "done";
  const { error } = await sb.from("tasks").update({ status: next }).eq("task_id", taskId);
  if (error) return alert("Toggle error: " + error.message);
  await loadTasks();
  await refreshStats();
  await loadPerformance();
}

/* =========================
   5) Exams (CRUD)
========================= */
let examsCache = [];

async function loadExams() {
  if (!isEl("examsContainer") && !isEl("dashboardExams")) return;

  const user = await getUser();
  if (!user) return;

  const { data, error } = await sb
    .from("exams")
    .select("*")
    .eq("user_id", user.id)
    .order("exam_date", { ascending: true });

  if (error) return alert("Load exams error: " + error.message);
  examsCache = data || [];

  if (isEl("examsContainer")) renderExams(examsCache);
  if (isEl("dashboardExams")) renderDashboardExams(examsCache.slice(0, 5));
}

function renderExams(exams) {
  const c = $("examsContainer");
  if (!c) return;

  if (!exams.length) {
    c.innerHTML = `<p class="muted">No exams yet.</p>`;
    return;
  }

  c.innerHTML = "";
  exams.forEach(ex => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="item-left">
        <b>${escapeHtml(ex.subject)}</b>
        <div class="muted">Date: ${ex.exam_date ?? "-"}</div>
      </div>
      <div class="item-actions">
        <button class="secondary-btn" data-act="edit" data-id="${ex.exam_id}">Edit</button>
        <button class="danger-btn" data-act="del" data-id="${ex.exam_id}">Delete</button>
      </div>
    `;
    c.appendChild(div);
  });

  c.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      if (act === "del") return await deleteExam(id);
      if (act === "edit") return openEditExam(id);
    });
  });
}

function renderDashboardExams(exams) {
  const c = $("dashboardExams");
  if (!c) return;

  if (!exams.length) {
    c.innerHTML = `<p class="muted">No exams yet.</p>`;
    return;
  }

  c.innerHTML = exams.map(e => `
    <div class="mini-row">
      <span><b>${escapeHtml(e.subject)}</b></span>
      <span class="muted">${e.exam_date ?? "-"}</span>
    </div>
  `).join("");
}

function openAddExam() {
  if (!isEl("examModal")) return;
  if (isEl("examModalTitle")) $("examModalTitle").textContent = "Add Exam";
  $("examId").value = "";
  $("examSubject").value = "";
  $("examDate").value = "";
  openModal("examModal");
}

function openEditExam(examId) {
  const ex = examsCache.find(x => x.exam_id === examId);
  if (!ex) return;
  if (isEl("examModalTitle")) $("examModalTitle").textContent = "Edit Exam";
  $("examId").value = ex.exam_id;
  $("examSubject").value = ex.subject || "";
  $("examDate").value = ex.exam_date || "";
  openModal("examModal");
}

async function saveExam() {
  const user = await getUser();
  if (!user) return alert("Login first.");

  const id = ($("examId")?.value || "").trim();
  const subject = ($("examSubject")?.value || "").trim();
  const date = $("examDate")?.value || "";

  if (!subject || !date) return alert("Fill subject & date.");

  if (!id) {
    const { error } = await sb.from("exams").insert({
      user_id: user.id,
      subject,
      exam_date: date
    });
    if (error) return alert("Add exam error: " + error.message);
  } else {
    const { error } = await sb
      .from("exams")
      .update({ subject, exam_date: date })
      .eq("exam_id", id);
    if (error) return alert("Update exam error: " + error.message);
  }

  closeModal("examModal");
  await loadExams();
  await refreshStats();
}

async function deleteExam(examId) {
  const { error } = await sb.from("exams").delete().eq("exam_id", examId);
  if (error) return alert("Delete exam error: " + error.message);
  await loadExams();
  await refreshStats();
}

/* =========================
   6) Study Plan
========================= */
async function loadStudyPlan() {
  if (!isEl("studyPlanContainer") && !isEl("dashboardPlan")) return;

  const user = await getUser();
  if (!user) return;

  const { data, error } = await sb
    .from("study_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return alert("Load plan error: " + error.message);
  const plan = data?.[0] || null;

  const html = plan
    ? `<div class="muted">${plan.start_date ?? "-"} → ${plan.end_date ?? "-"}</div>
       <div style="margin-top:8px; line-height:1.5">${escapeHtml(plan.plan_details).replaceAll("\n","<br>")}</div>`
    : `<p class="muted">No study plan yet.</p>`;

  if (isEl("studyPlanContainer")) $("studyPlanContainer").innerHTML = html;
  if (isEl("dashboardPlan")) $("dashboardPlan").innerHTML = html;

  if (plan && isEl("planStart")) $("planStart").value = plan.start_date || "";
  if (plan && isEl("planEnd")) $("planEnd").value = plan.end_date || "";
  if (plan && isEl("planDetails")) $("planDetails").value = plan.plan_details || "";
}

async function savePlan() {
  const user = await getUser();
  if (!user) return alert("Login first.");

  const start = $("planStart")?.value || "";
  const end = $("planEnd")?.value || "";
  const details = ($("planDetails")?.value || "").trim();
  if (!start || !end || !details) return alert("Fill all plan fields.");

  const { data: existing } = await sb
    .from("study_plans")
    .select("plan_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing?.length) {
    const { error } = await sb
      .from("study_plans")
      .update({ start_date: start, end_date: end, plan_details: details, generated_by: "manual" })
      .eq("plan_id", existing[0].plan_id);
    if (error) return alert("Update plan error: " + error.message);
  } else {
    const { error } = await sb.from("study_plans").insert({
      user_id: user.id,
      start_date: start,
      end_date: end,
      plan_details: details,
      generated_by: "manual"
    });
    if (error) return alert("Create plan error: " + error.message);
  }

  closeModal("planModal");
  await loadStudyPlan();
}

async function smartPlan() {
  const user = await getUser();
  if (!user) return alert("Login first.");

  const { data: tasks } = await sb
    .from("tasks")
    .select("title,deadline,status")
    .eq("user_id", user.id)
    .order("deadline", { ascending: true })
    .limit(5);

  const { data: exams } = await sb
    .from("exams")
    .select("subject,exam_date")
    .eq("user_id", user.id)
    .order("exam_date", { ascending: true })
    .limit(3);

  let text = "Smart Study Suggestions\n\n";

  if (exams?.length) {
    text += "Upcoming Exams:\n";
    exams.forEach(e => text += `- ${e.subject} (${e.exam_date})\n`);
    text += "\n";
  }
  if (tasks?.length) {
    text += "Priority Tasks:\n";
    tasks.forEach(t => {
      if (t.status !== "done") text += `- ${t.title} (due ${t.deadline ?? "-"})\n`;
    });
    text += "\n";
  }

  text += "Suggested Plan:\n";
  text += "- Study 60–90 minutes daily.\n";
  text += "- Focus on nearest deadlines.\n";
  text += "- Review exams 2–3 days before.\n";

  const start = todayISO();
  const end = todayISO();

  const { data: existing } = await sb
    .from("study_plans")
    .select("plan_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing?.length) {
    await sb
      .from("study_plans")
      .update({ start_date: start, end_date: end, plan_details: text, generated_by: "smart" })
      .eq("plan_id", existing[0].plan_id);
  } else {
    await sb.from("study_plans").insert({
      user_id: user.id,
      start_date: start,
      end_date: end,
      plan_details: text,
      generated_by: "smart"
    });
  }

  await loadStudyPlan();
}

/* =========================
   7) Performance
========================= */
async function refreshStats() {
  const user = await getUser();
  if (!user) return;

  const { data: tasks } = await sb.from("tasks").select("status").eq("user_id", user.id);
  const { data: exams } = await sb.from("exams").select("exam_date").eq("user_id", user.id);

  const total = tasks?.length || 0;
  const done = tasks?.filter(t => t.status === "done")?.length || 0;
  const completion = total ? Math.round((done / total) * 100) : 0;

  const now = new Date();
  const upcoming = (exams || []).filter(e => e.exam_date && new Date(e.exam_date) >= now).length;

  if (isEl("statTasks")) $("statTasks").textContent = String(done);
  if (isEl("statExams")) $("statExams").textContent = String(upcoming);
  if (isEl("statCompletion")) $("statCompletion").textContent = `${completion}%`;
  if (isEl("completionBar")) $("completionBar").style.width = `${completion}%`;
}

async function loadPerformance() {
  if (!isEl("performanceContainer") && !isEl("dashboardPerformance")) return;

  const user = await getUser();
  if (!user) return;

  const { data, error } = await sb
    .from("performance_records")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) return alert("Load performance error: " + error.message);
  const p = data?.[0] || null;

  let html = `<p class="muted">No performance data yet.</p>`;
  if (p) {
    html = `
      <div><b>Average Grade:</b> ${p.average_grade ?? "-"}</div>
      <div class="muted" style="margin-top:6px">Completion Rate: ${p.completion_rate_percent ?? 0}%</div>
    `;
    if (isEl("completionBar")) $("completionBar").style.width = `${p.completion_rate_percent ?? 0}%`;
  }

  if (isEl("performanceContainer")) $("performanceContainer").innerHTML = html;
  if (isEl("dashboardPerformance")) $("dashboardPerformance").innerHTML = html;
}

async function saveGrade() {
  const user = await getUser();
  if (!user) return alert("Login first.");

  const v = Number($("gradeValue")?.value);
  if (!Number.isFinite(v)) return alert("Enter a valid grade.");

  const { data: tasks } = await sb.from("tasks").select("status").eq("user_id", user.id);
  const total = tasks?.length || 0;
  const done = tasks?.filter(t => t.status === "done")?.length || 0;
  const completion = total ? Math.round((done / total) * 100) : 0;

  const { data: existing } = await sb
    .from("performance_records")
    .select("record_id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (existing?.length) {
    const { error } = await sb
      .from("performance_records")
      .update({
        average_grade: v,
        completion_rate_percent: completion,
        updated_at: new Date().toISOString()
      })
      .eq("record_id", existing[0].record_id);
    if (error) return alert("Update grade error: " + error.message);
  } else {
    const { error } = await sb
      .from("performance_records")
      .insert({
        user_id: user.id,
        average_grade: v,
        completion_rate_percent: completion
      });
    if (error) return alert("Create grade error: " + error.message);
  }

  closeModal("gradeModal");
  await loadPerformance();
  await refreshStats();
}

/* =========================
   8) Notifications
========================= */
function daysDiff(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  const d = new Date(dateStr);
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

async function createNotification(title, message, type) {
  const user = await getUser();
  if (!user) return;

  const start = new Date();
  start.setHours(0,0,0,0);

  const { data: exist } = await sb
    .from("notifications")
    .select("notification_id")
    .eq("user_id", user.id)
    .eq("title", title)
    .eq("message", message)
    .gte("created_at", start.toISOString())
    .limit(1);

  if (exist?.length) return;

  await sb.from("notifications").insert({
    user_id: user.id,
    title,
    message,
    type,
    is_read: false
  });
}

async function generateNotifications() {
  const user = await getUser();
  if (!user) return;

  const { data: tasks } = await sb.from("tasks").select("*").eq("user_id", user.id);
  const { data: exams } = await sb.from("exams").select("*").eq("user_id", user.id);

  for (const t of (tasks || [])) {
    const dd = daysDiff(t.deadline);
    if (dd !== null && dd >= 0 && dd <= 2 && t.status !== "done") {
      await createNotification("Upcoming Task Deadline", `${t.title} is due in ${dd} day(s).`, "task");
    }
  }
  for (const e of (exams || [])) {
    const dd = daysDiff(e.exam_date);
    if (dd !== null && dd >= 0 && dd <= 2) {
      await createNotification("Upcoming Exam", `${e.subject} exam is in ${dd} day(s).`, "exam");
    }
  }
}

async function loadNotifications() {
  if (!isEl("notificationsContainer") && !isEl("dashboardNotifications")) return;

  const user = await getUser();
  if (!user) return;

  const { data, error } = await sb
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return alert("Load notifications error: " + error.message);

  const html = (data && data.length)
    ? data.map(n => `
        <div class="item">
          <div class="item-left">
            <b>${escapeHtml(n.title)}</b>
            <div class="muted">${escapeHtml(n.message)}</div>
          </div>
        </div>
      `).join("")
    : `<p class="muted">No notifications.</p>`;

  if (isEl("notificationsContainer")) $("notificationsContainer").innerHTML = html;
  if (isEl("dashboardNotifications")) $("dashboardNotifications").innerHTML = html;
}

async function clearAllNotifications() {
  const user = await getUser();
  if (!user) return;

  const { error } = await sb.from("notifications").delete().eq("user_id", user.id);
  if (error) return alert("Clear notifications error: " + error.message);
  await loadNotifications();
}

/* =========================
   9) Dashboard loader
========================= */
async function loadDashboard() {
  if (!isEl("dashboardTasks")) return; // فقط موجود في index

  await loadTasks();
  await loadExams();
  await loadStudyPlan();
  await loadPerformance();
  await generateNotifications();
  await loadNotifications();
  await refreshStats();
}

/* =========================
   10) Load all per page
========================= */
async function loadAllForCurrentPage() {
  await loadTasks();
  await loadExams();
  await loadStudyPlan();
  await loadPerformance();
  await generateNotifications();
  await loadNotifications();
  await refreshStats();
  await loadDashboard();
}

/* =========================
   11) Wire events
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  // Close modals initially
  ["authModal","taskModal","examModal","planModal","gradeModal"].forEach(id => {
    if (isEl(id)) closeModal(id);
  });

  // Auth (styled modal)
  bindAuthUI();

  // Tasks
  $("btnAddTask")?.addEventListener("click", openAddTask);
  $("saveTask")?.addEventListener("click", saveTask);
  $("closeTaskModal")?.addEventListener("click", () => closeModal("taskModal"));
  $("taskSearch")?.addEventListener("input", () => renderTasks(tasksCache));

  // Exams
  $("btnAddExam")?.addEventListener("click", openAddExam);
  $("saveExam")?.addEventListener("click", saveExam);
  $("closeExamModal")?.addEventListener("click", () => closeModal("examModal"));

  // Study plan
  $("btnEditPlan")?.addEventListener("click", () => openModal("planModal"));
  $("savePlan")?.addEventListener("click", savePlan);
  $("closePlanModal")?.addEventListener("click", () => closeModal("planModal"));
  $("btnSmartPlan")?.addEventListener("click", smartPlan);

  // Grade
  $("btnEditGrade")?.addEventListener("click", () => openModal("gradeModal"));
  $("saveGrade")?.addEventListener("click", saveGrade);
  $("closeGradeModal")?.addEventListener("click", () => closeModal("gradeModal"));

  // Notifications
  $("btnClearNotifications")?.addEventListener("click", clearAllNotifications);

  // Listen auth change
  sb.auth.onAuthStateChange(async () => {
    await updateAuthUI();
  });

  await updateAuthUI();
});