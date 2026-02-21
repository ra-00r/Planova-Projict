"use strict";

/********************** 0) Supabase Config ************************/
// ✅ Using YOUR values (public publishable key)
const SUPABASE_URL = "https://qcfnilswrabwtkitbofj.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_v4TO8Lh2upbkp9byJRBgUA_PSarae05";

// Avoid double-init (prevents weird session/lock behavior)
const sb = window.__planova_sb || (window.__planova_sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      // iOS Safari/Chrome: navigator.locks can cause Supabase session storage to hang.
      // We disable built-in persistence and manage tokens ourselves (localStorage) safely.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: true,
    },
  }
));

/********************** 1A) Session persistence (safe for iOS WebKit) **********************/
// We store only the tokens we need to restore the session across pages.
// (Supabase ANON key is public, tokens are user-specific.)
const PLANOVA_SESSION_KEY = "planova.session.v1";

function saveSessionTokens(session) {
  if (!session?.access_token || !session?.refresh_token) return;
  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };
  localStorage.setItem(PLANOVA_SESSION_KEY, JSON.stringify(payload));
}

function clearSessionTokens() {
  localStorage.removeItem(PLANOVA_SESSION_KEY);
}

async function restoreSessionFromStorage() {
  const raw = localStorage.getItem(PLANOVA_SESSION_KEY);
  if (!raw) return null;

  try {
    const { access_token, refresh_token } = JSON.parse(raw);
    if (!access_token || !refresh_token) {
      clearSessionTokens();
      return null;
    }

    // setSession will refresh the access token if needed
    const { data, error } = await sb.auth.setSession({ access_token, refresh_token });
    if (error) {
      clearSessionTokens();
      return null;
    }

    // Store refreshed tokens (if any)
    if (data?.session) saveSessionTokens(data.session);
    return data?.session || null;
  } catch (e) {
    clearSessionTokens();
    return null;
  }
}


/********************** 1) Helpers ************************/
const $ = (id) => document.getElementById(id);
const pageName = () => document.body?.dataset?.page || "";
const show = (el) => { if (el) el.style.display = ""; };
const hide = (el) => { if (el) el.style.display = "none"; };

function fmtDate(d){
  if(!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { weekday:"long", year:"numeric", month:"short", day:"numeric" });
}
function fmtShort(d){
  if(!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
}
function setNotice(id, msg, isError=false){
  const el = $(id);
  if(!el) return;
  el.style.display = msg ? "block" : "none";
  el.textContent = msg || "";
  el.style.borderColor = isError ? "rgba(255,90,90,.35)" : "rgba(255,255,255,.14)";
}

/********************** 2) Date/time ************************/
function updateDateTime(){
  const el = $("dateTime");
  if(!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString(undefined, { weekday:"short", month:"short", day:"numeric" }) + " · " +
                   now.toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit" });
}

/********************** 3) Auth Modal ************************/
let authMode = "login"; // login | signup

function openAuthModal(mode="login"){
  authMode = mode;
  const overlay = $("authOverlay");
  if(!overlay) return;
  overlay.style.display = "flex";
  overlay.setAttribute("aria-hidden","false");

  // Tabs
  const tLogin = $("tabLogin");
  const tSignup = $("tabSignup");
  if(tLogin && tSignup){
    tLogin.classList.toggle("active", mode==="login");
    tSignup.classList.toggle("active", mode==="signup");
  }

  // Extra field for signup
  const extra = $("signupExtra");
  if(extra) extra.style.display = mode==="signup" ? "block" : "none";

  // Button text
  const submit = $("authSubmit");
  if(submit) submit.textContent = mode==="signup" ? "Sign Up" : "Login";

  setNotice("authNotice","");
}
function closeAuthModal(){
  const overlay = $("authOverlay");
  if(!overlay) return;
  overlay.style.display = "none";
  overlay.setAttribute("aria-hidden","true");
  const form = $("authForm");
  if(form) form.reset();
  setNotice("authNotice","");
}

function bindAuthUI(){
  // Top-right buttons
  $("btnLogin")?.addEventListener("click", () => openAuthModal("login"));
  $("btnSignup")?.addEventListener("click", () => openAuthModal("signup"));
  $("btnLogout")?.addEventListener("click", async () => {
    await sb.auth.signOut();
    await updateAuthUI();
    // Optional: go dashboard
    // location.href = "index.html";
  });

  // Modal close
  $("authClose")?.addEventListener("click", closeAuthModal);
  $("authCancel")?.addEventListener("click", closeAuthModal);

  // Tabs
  $("tabLogin")?.addEventListener("click", () => openAuthModal("login"));
  $("tabSignup")?.addEventListener("click", () => openAuthModal("signup"));

  // Submit
  $("authForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("authEmail")?.value?.trim();
    const password = $("authPassword")?.value;
    const fullName = $("authFullName")?.value?.trim();

    if(!email || !password){
      setNotice("authNotice","Please enter email and password.", true);
      return;
    }

    setNotice("authNotice","Working...");

    try{
      if(authMode === "signup"){
        if(!fullName){
          setNotice("authNotice","Please enter your full name.", true);
          return;
        }
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        });
        if(error) throw error;

        // If email confirmation is ON, session may be null until confirmed.
        // We'll still upsert profile when session exists.
        await updateAuthUI();
        closeAuthModal();
      }else{
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if(error) throw error;
        await updateAuthUI();
        closeAuthModal();
      }
    }catch(err){
      setNotice("authNotice", err?.message || "Auth failed.", true);
    }
  });

  // Keep UI in sync across pages/tabs
  sb.auth.onAuthStateChange(async (event, session) => {
    if (session) saveSessionTokens(session);
    if (event === "SIGNED_OUT") clearSessionTokens();
    await updateAuthUI();
    await loadAllForCurrentPage();
  });
}

/********************** 4) Profiles ************************/
async function ensureProfile(session){
  // profiles: id(uuid PK) | full_name | email | avatar_url
  if(!session?.user?.id) return;
  const user = session.user;

  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
  const payload = {
    id: user.id,
    full_name: fullName,
    email: user.email || "",
  };

  // Upsert
  await sb.from("profiles").upsert(payload, { onConflict: "id" });
}

async function getDisplayName(session){
  if(!session?.user) return "Guest";

  // Prefer profiles.full_name
  const { data } = await sb.from("profiles")
    .select("full_name,email")
    .eq("id", session.user.id)
    .maybeSingle();

  const name = data?.full_name?.trim();
  if(name) return name;

  const meta = session.user.user_metadata || {};
  return (meta.full_name || meta.name || session.user.email || "User");
}

async function updateAuthUI(){
  const { data } = await sb.auth.getSession();
  const session = data?.session || null;

  // Make sure profile exists when session exists
  if(session) await ensureProfile(session);

  const name = await getDisplayName(session);

  // Update chips
  if($("userName")) $("userName").textContent = name;
  if($("sidebarName")) $("sidebarName").textContent = name;
  if($("welcomeName")) $("welcomeName").textContent = name;

  const email = session?.user?.email || "Not signed in";
  if($("userEmail")) $("userEmail").textContent = email;
  if($("sidebarEmail")) $("sidebarEmail").textContent = email;

  // Toggle buttons
  const btnLogin = $("btnLogin");
  const btnSignup = $("btnSignup");
  const btnLogout = $("btnLogout");

  if(session){
    hide(btnLogin); hide(btnSignup); show(btnLogout);
  }else{
    show(btnLogin); show(btnSignup); hide(btnLogout);
  }

  return session;
}

/********************** 5) Modals (Tasks/Exams/Plan/Perf/Notif) ************************/
function openOverlay(id){ const el=$(id); if(el){ el.style.display="flex"; el.setAttribute("aria-hidden","false"); } }
function closeOverlay(id){ const el=$(id); if(el){ el.style.display="none"; el.setAttribute("aria-hidden","true"); } }

function bindCommonModals(){
  // Tasks
  $("btnAddTask")?.addEventListener("click", () => { setNotice("taskNotice",""); $("taskForm")?.reset(); openOverlay("taskOverlay"); });
  $("taskClose")?.addEventListener("click", () => closeOverlay("taskOverlay"));
  $("taskCancel")?.addEventListener("click", () => closeOverlay("taskOverlay"));

  // Exams
  $("btnAddExam")?.addEventListener("click", () => { setNotice("examNotice",""); $("examForm")?.reset(); openOverlay("examOverlay"); });
  $("examClose")?.addEventListener("click", () => closeOverlay("examOverlay"));
  $("examCancel")?.addEventListener("click", () => closeOverlay("examOverlay"));

  // Study plan
  $("btnEditPlan")?.addEventListener("click", async () => {
    setNotice("planNotice","");
    // Prefill current plan if exists
    const session = await updateAuthUI();
    if(!session) { openAuthModal("login"); return; }
    const plan = await fetchLatestPlan(session.user.id);
    if(plan){
      if($("planStart")) $("planStart").value = (plan.start_date || "").slice(0,10);
      if($("planEnd")) $("planEnd").value = (plan.end_date || "").slice(0,10);
      if($("planDetails")) $("planDetails").value = plan.plan_details || "";
    }else{
      $("planForm")?.reset();
    }
    openOverlay("planOverlay");
  });
  $("planClose")?.addEventListener("click", () => closeOverlay("planOverlay"));
  $("planCancel")?.addEventListener("click", () => closeOverlay("planOverlay"));

  // Performance
  $("btnAddPerf")?.addEventListener("click", async () => {
    const session = await updateAuthUI();
    if(!session){ openAuthModal("login"); return; }
    setNotice("perfNotice","");
    $("perfForm")?.reset();
    openOverlay("perfOverlay");
  });
  $("perfClose")?.addEventListener("click", () => closeOverlay("perfOverlay"));
  $("perfCancel")?.addEventListener("click", () => closeOverlay("perfOverlay"));

  // Notifications
  $("btnAddNotif")?.addEventListener("click", async () => {
    const session = await updateAuthUI();
    if(!session){ openAuthModal("login"); return; }
    setNotice("notifNotice","");
    $("notifForm")?.reset();
    openOverlay("notifOverlay");
  });
  $("notifClose")?.addEventListener("click", () => closeOverlay("notifOverlay"));
  $("notifCancel")?.addEventListener("click", () => closeOverlay("notifOverlay"));
}

/********************** 6) Data: Tasks ************************/
let tasksCache = [];

function renderTasks(list){
  const wrap = $("tasksList");
  const empty = $("tasksEmpty");
  if(!wrap) return;

  wrap.innerHTML = "";
  if(!list || list.length===0){
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  list.forEach(t => {
    const done = !!t.is_done;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="left">
        <div class="dot" style="${done ? "background: rgba(79,141,255,.55)" : ""}"></div>
        <div>
          <div class="title" style="${done ? "text-decoration: line-through; opacity:.85" : ""}">${escapeHtml(t.title || "")}</div>
          <div class="meta">${t.due_date ? "Due: " + fmtShort(t.due_date) : "No due date"} · ${escapeHtml((t.priority || "normal").toUpperCase())} · ${Math.round(t.progress || 0)}%</div>
        </div>
      </div>
      <div class="actions">
        <button class="small-btn primary" type="button" data-act="toggle" data-id="${t.task_id}">${done ? "Undone" : "Done"}</button>
        <button class="small-btn danger" type="button" data-act="del" data-id="${t.task_id}">Delete</button>
      </div>
    `;
    wrap.appendChild(div);
  });

  wrap.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      if(!id) return;
      if(act==="del") await deleteTask(id);
      if(act==="toggle") await toggleTask(id);
    });
  });
}

async function loadTasks(userId){
  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if(error) throw error;
  tasksCache = data || [];
  renderTasks(tasksCache);
  updateDashboardStats();
}

async function saveTask(e){
  e.preventDefault();
  const session = await updateAuthUI();
  if(!session){ openAuthModal("login"); return; }

  try{
    setNotice("taskNotice","Saving...");
    const payload = {
      user_id: session.user.id,
      title: $("taskTitle")?.value?.trim(),
      due_date: $("taskDue")?.value || null,
      priority: $("taskPriority")?.value || "normal",
      progress: Number($("taskProgress")?.value || 0),
      is_done: false,
    };
    if(!payload.title) { setNotice("taskNotice","Title is required.", true); return; }

    const { error } = await sb.from("tasks").insert(payload);
    if(error) throw error;

    closeOverlay("taskOverlay");
    await loadTasks(session.user.id);
  }catch(err){
    setNotice("taskNotice", err?.message || "Failed to save task.", true);
  }
}

async function deleteTask(taskId){
  const session = await updateAuthUI();
  if(!session){ openAuthModal("login"); return; }
  await sb.from("tasks").delete().eq("task_id", taskId).eq("user_id", session.user.id);
  await loadTasks(session.user.id);
}

async function toggleTask(taskId){
  const session = await updateAuthUI();
  if(!session){ openAuthModal("login"); return; }
  const t = tasksCache.find(x => x.task_id === taskId);
  if(!t) return;
  await sb.from("tasks").update({ is_done: !t.is_done }).eq("task_id", taskId).eq("user_id", session.user.id);
  await loadTasks(session.user.id);
}

/********************** 7) Data: Exams ************************/
let examsCache = [];

function renderExams(list){
  const wrap = $("examsList");
  const empty = $("examsEmpty");
  if(!wrap) return;

  wrap.innerHTML = "";
  if(!list || list.length===0){
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  list.forEach(ex => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="left">
        <div class="dot"></div>
        <div>
          <div class="title">${escapeHtml(ex.subject || "")}</div>
          <div class="meta">Due: ${fmtShort(ex.exam_date)} ${ex.reminder_datetime ? "· Reminder set" : ""}</div>
        </div>
      </div>
      <div class="actions">
        <button class="small-btn danger" type="button" data-act="del" data-id="${ex.exam_id}">Delete</button>
      </div>
    `;
    wrap.appendChild(div);
  });

  wrap.querySelectorAll("button[data-act='del']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if(id) await deleteExam(id);
    });
  });
}

async function loadExams(userId){
  const { data, error } = await sb
    .from("exams")
    .select("*")
    .eq("user_id", userId)
    .order("exam_date", { ascending: true });

  if(error) throw error;
  examsCache = data || [];
  renderExams(examsCache);
  updateDashboardStats();
}

async function saveExam(e){
  e.preventDefault();
  const session = await updateAuthUI();
  if(!session){ openAuthModal("login"); return; }

  try{
    setNotice("examNotice","Saving...");
    const payload = {
      user_id: session.user.id,
      subject: $("examSubject")?.value?.trim(),
      exam_date: $("examDate")?.value || null,
      reminder_datetime: $("examReminder")?.value ? new Date($("examReminder").value).toISOString() : null,
    };
    if(!payload.subject || !payload.exam_date){ setNotice("examNotice","Subject and exam date are required.", true); return; }

    const { error } = await sb.from("exams").insert(payload);
    if(error) throw error;

    closeOverlay("examOverlay");
    await loadExams(session.user.id);
  }catch(err){
    setNotice("examNotice", err?.message || "Failed to save exam.", true);
  }
}

async function deleteExam(examId){
  const session = await updateAuthUI();
  if(!session){ openAuthModal("login"); return; }
  await sb.from("exams").delete().eq("exam_id", examId).eq("user_id", session.user.id);
  await loadExams(session.user.id);
}

/********************** 8) Data: Study plans ************************/
async function fetchLatestPlan(userId){
  const { data, error } = await sb
    .from("study_plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if(error) throw error;
  return (data && data[0]) || null;
}

async function loadPlan(userId){
  const plan = await fetchLatestPlan(userId);
  if($("planRange")){
    $("planRange").textContent = plan ? (fmtDate(plan.start_date) + " → " + fmtDate(plan.end_date)) : "—";
  }
  if($("planText")){
    $("planText").textContent = plan?.plan_details || "No plan yet.";
  }
}

async function savePlan(e){
  e.preventDefault();
  const session = await updateAuthUI();
  if(!session){ openAuthModal("login"); return; }

  try{
    setNotice("planNotice","Saving...");
    const payload = {
      user_id: session.user.id,
      start_date: $("planStart")?.value || null,
      end_date: $("planEnd")?.value || null,
      plan_details: $("planDetails")?.value || "",
      generated_by: "manual",
    };
    if(!payload.start_date || !payload.end_date){ setNotice("planNotice","Start and end dates are required.", true); return; }

    const { error } = await sb.from("study_plans").insert(payload);
    if(error) throw error;

    closeOverlay("planOverlay");
    await loadPlan(session.user.id);
  }catch(err){
    setNotice("planNotice", err?.message || "Failed to save plan.", true);
  }
}

/********************** 9) Data: Performance ************************/
let perfCache = [];

function renderPerf(list){
  const wrap = $("perfList");
  const empty = $("perfEmpty");
  if(!wrap) return;

  wrap.innerHTML = "";
  if(!list || list.length===0){
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  list.forEach(r => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="left">
        <div class="dot"></div>
        <div>
          <div class="title">${Number(r.average_grade).toFixed(0)}% grade · ${Number(r.completion_rate_percent).toFixed(0)}% completion</div>
          <div class="meta">${r.notes ? escapeHtml(r.notes) : "—"} · ${r.updated_at ? fmtShort(r.updated_at) : ""}</div>
        </div>
      </div>
      <div class="actions">
        <button class="small-btn danger" type="button" data-act="del" data-id="${r.record_id}">Delete</button>
      </div>
    `;
    wrap.appendChild(div);
  });

  wrap.querySelectorAll("button[data-act='del']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if(id) await deletePerf(id);
    });
  });
}

async function loadPerf(userId){
  const { data, error } = await sb
    .from("performance_records")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if(error) throw error;
  perfCache = data || [];
  renderPerf(perfCache);

  if($("perfCount")) $("perfCount").textContent = String(perfCache.length);

  if(perfCache.length){
    const avg = perfCache.reduce((s,x)=>s+Number(x.average_grade||0),0)/perfCache.length;
    const comp = perfCache.reduce((s,x)=>s+Number(x.completion_rate_percent||0),0)/perfCache.length;
    if($("perfAvg")) $("perfAvg").textContent = avg.toFixed(0) + "%";
    if($("perfComp")) $("perfComp").textContent = comp.toFixed(0) + "%";
  }else{
    if($("perfAvg")) $("perfAvg").textContent = "—";
    if($("perfComp")) $("perfComp").textContent = "—";
  }
}

async function savePerf(e){
  e.preventDefault();
  const session = await updateAuthUI();
  if(!session){ openAuthModal("login"); return; }

  try{
    setNotice("perfNotice","Saving...");
    const payload = {
      user_id: session.user.id,
      average_grade: Number($("perfGrade")?.value || 0),
      completion_rate_percent: Number($("perfRate")?.value || 0),
      notes: $("perfNotes")?.value || "",
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from("performance_records").insert(payload);
    if(error) throw error;

    closeOverlay("perfOverlay");
    await loadPerf(session.user.id);
  }catch(err){
    setNotice("perfNotice", err?.message || "Failed to save record.", true);
  }
}

async function deletePerf(id){
  const session = await updateAuthUI();
  if(!session){ openAuthModal("login"); return; }
  await sb.from("performance_records").delete().eq("record_id", id).eq("user_id", session.user.id);
  await loadPerf(session.user.id);
}

/********************** 10) Data: Notifications ************************/
let notifCache = [];

function renderNotifs(list){
  const wrap = $("notifList");
  const empty = $("notifEmpty");
  if(!wrap) return;

  wrap.innerHTML = "";
  if(!list || list.length===0){
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  list.forEach(n => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="left">
        <div class="dot"></div>
        <div>
          <div class="title">${escapeHtml(n.title || "Notification")}</div>
          <div class="meta">${escapeHtml(n.message || "")}</div>
        </div>
      </div>
      <div class="actions">
        <button class="small-btn danger" type="button" data-act="del" data-id="${n.notification_id}">Delete</button>
      </div>
    `;
    wrap.appendChild(div);
  });

  wrap.querySelectorAll("button[data-act='del']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if(id) await deleteNotif(id);
    });
  });
}

async function loadNotifs(userId){
  const { data, error } = await sb
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if(error) throw error;
  notifCache = data || [];
  renderNotifs(notifCache);
}

async function saveNotif(e){
  e.preventDefault();
  const session = await updateAuthUI();
  if(!session){ openAuthModal("login"); return; }

  try{
    setNotice("notifNotice","Saving...");
    const payload = {
      user_id: session.user.id,
      title: $("notifTitle")?.value?.trim(),
      message: $("notifMsg")?.value || "",
      type: $("notifType")?.value || "info",
      is_read: false,
      created_at: new Date().toISOString(),
    };
    if(!payload.title){ setNotice("notifNotice","Title is required.", true); return; }

    const { error } = await sb.from("notifications").insert(payload);
    if(error) throw error;

    closeOverlay("notifOverlay");
    await loadNotifs(session.user.id);
  }catch(err){
    setNotice("notifNotice", err?.message || "Failed to save notification.", true);
  }
}

async function deleteNotif(id){
  const session = await updateAuthUI();
  if(!session){ openAuthModal("login"); return; }
  await sb.from("notifications").delete().eq("notification_id", id).eq("user_id", session.user.id);
  await loadNotifs(session.user.id);
}

/********************** 11) Dashboard Stats ************************/
function updateDashboardStats(){
  if(pageName() !== "Dashboard") return;

  const done = tasksCache.filter(t=>t.is_done).length;
  const total = tasksCache.length;
  const completion = total ? Math.round((done/total)*100) : 0;

  if($("statDone")) $("statDone").textContent = String(done);
  if($("statCompletion")) $("statCompletion").textContent = completion + "%";
  if($("statExams")) $("statExams").textContent = String(examsCache.length);

  // Tasks due in next 7 days
  const now = new Date();
  const week = new Date(now.getTime() + 7*24*3600*1000);
  const due = tasksCache.filter(t=>{
    if(!t.due_date) return false;
    const d = new Date(t.due_date);
    return d >= now && d <= week && !t.is_done;
  }).length;

  if($("tasksDueCount")) $("tasksDueCount").textContent = String(due);

  // Render only first few tasks/exams on dashboard
  const dashTasks = tasksCache.filter(t=>!t.is_done).slice(0,4);
  const dashExams = examsCache.slice(0,4);
  renderTasks(dashTasks);
  renderExams(dashExams);
}

/********************** 12) Misc ************************/
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
}

async function loadAllForCurrentPage(){
  const session = await updateAuthUI();
  const userId = session?.user?.id;

  // If not logged in, show empty states but keep UI clickable (login/signup work)
  if(!userId){
    if($("tasksList")) renderTasks([]);
    if($("examsList")) renderExams([]);
    if($("notifList")) renderNotifs([]);
    if($("perfList")) renderPerf([]);
    if($("planText")) $("planText").textContent = "Please login to see your data.";
    if($("planRange")) $("planRange").textContent = "—";
    if(pageName()==="Dashboard"){
      if($("statDone")) $("statDone").textContent = "0";
      if($("statExams")) $("statExams").textContent = "0";
      if($("statCompletion")) $("statCompletion").textContent = "0%";
      if($("tasksDueCount")) $("tasksDueCount").textContent = "0";
    }
    return;
  }

  // Load based on page
  if(pageName()==="Dashboard"){
    await loadTasks(userId);
    await loadExams(userId);
    await loadPlan(userId);
  }else if(pageName()==="Tasks"){
    await loadTasks(userId);
  }else if(pageName()==="Exams"){
    await loadExams(userId);
  }else if(pageName()==="Study Plan"){
    await loadPlan(userId);
  }else if(pageName()==="Performance"){
    await loadPerf(userId);
  }else if(pageName()==="Notifications"){
    await loadNotifs(userId);
  }
}

/********************** 13) Wire events ************************/
document.addEventListener("DOMContentLoaded", async () => {
  updateDateTime();
  setInterval(updateDateTime, 30_000);

  // quick links
  $("btnOpenNotifications")?.addEventListener("click", () => location.href="notifications.html");
  $("btnOpenMail")?.addEventListener("click", () => window.open("mailto:support@planova.app","_blank"));

  bindAuthUI();
  bindCommonModals();

  // Form handlers (must be bound AFTER DOM exists)
  $("taskForm")?.addEventListener("submit", saveTask);
  $("examForm")?.addEventListener("submit", saveExam);
  $("planForm")?.addEventListener("submit", savePlan);
  $("perfForm")?.addEventListener("submit", savePerf);
  $("notifForm")?.addEventListener("submit", saveNotif);

  // Search handlers
  $("tasksSearch")?.addEventListener("input", (e) => {
    const q = (e.target.value || "").toLowerCase();
    renderTasks(tasksCache.filter(t => (t.title||"").toLowerCase().includes(q)));
  });
  $("examsSearch")?.addEventListener("input", (e) => {
    const q = (e.target.value || "").toLowerCase();
    renderExams(examsCache.filter(x => (x.subject||"").toLowerCase().includes(q)));
  });

  await loadAllForCurrentPage();
});
