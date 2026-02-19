"use strict";

/* ========= 1) SUPABASE ========= */
const SUPABASE_URL = "https://qcfnilswrabwtkitbofj.supabase.co/";
const SUPABASE_KEY = "sb_publishable_v4TO8Lh2upbkp9byJRBgUA_PSarae05";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ========= 2) HELPERS ========= */
function $(id){ return document.getElementById(id); }

function openModal(id){ $(id)?.classList.add("is-open"); }
function closeModal(id){ $(id)?.classList.remove("is-open"); }

function getDisplayName(user){
  const meta = user?.user_metadata?.full_name || user?.user_metadata?.name;
  if (meta && String(meta).trim()) return String(meta).trim();
  const email = user?.email || "";
  return email.includes("@") ? email.split("@")[0] : "User";
}

async function getCurrentUser(){
  const { data } = await supabaseClient.auth.getUser();
  return data.user;
}

async function safeLoadAll(){
  await loadTasks();
  await loadExams();
  await loadStudyPlan();
  await loadPerformance();
  await generateNotifications();   // auto create
  await loadNotifications();       // show
}

/* ========= 3) AUTH UI ========= */
async function updateUI(){
  const user = await getCurrentUser();

  const userEmail = $("userEmail");
  const sidebarName = $("sidebarName");
  const heroName = document.querySelector(".hero__name");

  const btnSignup = $("btnSignup");
  const btnLogin = $("btnLogin");
  const btnLogout = $("btnLogout");

  if (user){
    const name = getDisplayName(user);

    if (userEmail) userEmail.textContent = name;
    if (sidebarName) sidebarName.textContent = name;
    if (heroName) heroName.textContent = name;

    if (btnSignup) btnSignup.style.display = "none";
    if (btnLogin) btnLogin.style.display = "none";
    if (btnLogout) btnLogout.style.display = "inline-flex";

    await safeLoadAll();
  } else {
    if (userEmail) userEmail.textContent = "";
    if (sidebarName) sidebarName.textContent = "Guest";
    if (heroName) heroName.textContent = "Guest";

    if (btnSignup) btnSignup.style.display = "inline-flex";
    if (btnLogin) btnLogin.style.display = "inline-flex";
    if (btnLogout) btnLogout.style.display = "none";

    // clear UI
    if ($("tasksContainer")) $("tasksContainer").innerHTML = "";
    if ($("examsContainer")) $("examsContainer").innerHTML = "";
    if ($("studyPlanContainer")) $("studyPlanContainer").innerHTML = `<div class="list-item__meta">Login to view your plan.</div>`;
    if ($("performanceContainer")) $("performanceContainer").innerHTML = `<div class="list-item__meta">Login to view performance.</div>`;
    if ($("notificationsContainer")) $("notificationsContainer").innerHTML = "";
  }
}

/* ========= 4) TASKS ========= */
async function addTask(title, deadline, progress){
  const user = await getCurrentUser();
  if (!user) return alert("Please login first.");

  const { error } = await supabaseClient.from("tasks").insert({
    user_id: user.id,
    title,
    deadline: deadline || null,
    status: "pending",
    progress_percent: Number(progress || 0)
  });

  if (error) return alert("Add task error: " + error.message);
  await loadTasks();
  await loadPerformance();
}

async function deleteTask(taskId){
  const { error } = await supabaseClient.from("tasks").delete().eq("task_id", taskId);
  if (error) return alert("Delete task error: " + error.message);
  await loadTasks();
  await loadPerformance();
}

async function toggleTaskDone(taskId, currentStatus){
  const next = (currentStatus === "done") ? "pending" : "done";
  const { error } = await supabaseClient.from("tasks").update({ status: next }).eq("task_id", taskId);
  if (error) return alert("Update task error: " + error.message);
  await loadTasks();
  await loadPerformance();
}

async function loadTasks(){
  const user = await getCurrentUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from("tasks").select("*")
    .order("deadline", { ascending: true });

  if (error) return alert("Load tasks error: " + error.message);
  renderTasks(data || []);
}

function renderTasks(tasks){
  const c = $("tasksContainer");
  if (!c) return;

  if (!tasks.length){
    c.innerHTML = `<div class="list-item__meta">No tasks yet.</div>`;
    return;
  }

  c.innerHTML = "";
  tasks.forEach(t => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div>
        <div><b>${t.title}</b></div>
        <div class="list-item__meta">Due: ${t.deadline ?? "-"} • Progress: ${t.progress_percent ?? 0}% • Status: ${t.status}</div>
      </div>

      <div style="display:flex; gap:8px;">
        <button class="small-btn success" data-action="toggle" data-id="${t.task_id}" data-status="${t.status}">
          ${t.status === "done" ? "Undo" : "Done"}
        </button>
        <button class="small-btn danger" data-action="del" data-id="${t.task_id}">Delete</button>
      </div>
    `;
    c.appendChild(div);
  });

  c.querySelectorAll("button[data-action='del']").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      await deleteTask(btn.getAttribute("data-id"));
    });
  });

  c.querySelectorAll("button[data-action='toggle']").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      await toggleTaskDone(btn.getAttribute("data-id"), btn.getAttribute("data-status"));
    });
  });
}

/* ========= 5) EXAMS ========= */
async function addExam(subject, examDate){
  const user = await getCurrentUser();
  if (!user) return alert("Please login first.");

  const { error } = await supabaseClient.from("exams").insert({
    user_id: user.id,
    subject,
    exam_date: examDate
  });

  if (error) return alert("Add exam error: " + error.message);
  await loadExams();
  await generateNotifications();
  await loadNotifications();
}

async function deleteExam(examId){
  const { error } = await supabaseClient.from("exams").delete().eq("exam_id", examId);
  if (error) return alert("Delete exam error: " + error.message);
  await loadExams();
}

async function loadExams(){
  const user = await getCurrentUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from("exams").select("*")
    .order("exam_date", { ascending: true });

  if (error) return alert("Load exams error: " + error.message);
  renderExams(data || []);
}

function renderExams(exams){
  const c = $("examsContainer");
  if (!c) return;

  if (!exams.length){
    c.innerHTML = `<div class="list-item__meta">No exams yet.</div>`;
    return;
  }

  c.innerHTML = "";
  exams.forEach(ex => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div>
        <div><b>${ex.subject}</b></div>
        <div class="list-item__meta">Date: ${ex.exam_date ?? "-"}</div>
      </div>

      <button class="small-btn danger" data-id="${ex.exam_id}">Delete</button>
    `;
    c.appendChild(div);
  });

  c.querySelectorAll("button[data-id]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      await deleteExam(btn.getAttribute("data-id"));
    });
  });
}

/* ========= 6) STUDY PLAN ========= */
async function saveStudyPlan(details, startDate, endDate, generatedBy){
  const user = await getCurrentUser();
  if (!user) return alert("Please login first.");

  const { data: existing } = await supabaseClient.from("study_plans").select("plan_id").limit(1);

  if (existing && existing.length){
    const { error } = await supabaseClient.from("study_plans")
      .update({ plan_details: details, start_date: startDate, end_date: endDate, generated_by: generatedBy })
      .eq("plan_id", existing[0].plan_id);
    if (error) return alert("Update plan error: " + error.message);
  } else {
    const { error } = await supabaseClient.from("study_plans").insert({
      user_id: user.id,
      start_date: startDate,
      end_date: endDate,
      plan_details: details,
      generated_by: generatedBy
    });
    if (error) return alert("Create plan error: " + error.message);
  }

  await loadStudyPlan();
}

async function loadStudyPlan(){
  const user = await getCurrentUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from("study_plans").select("*")
    .order("start_date", { ascending: false })
    .limit(1);

  if (error) return alert("Load plan error: " + error.message);
  renderStudyPlan((data && data[0]) ? data[0] : null);
}

function renderStudyPlan(plan){
  const c = $("studyPlanContainer");
  if (!c) return;

  if (!plan){
    c.innerHTML = `<div class="list-item__meta">No study plan yet.</div>`;
    return;
  }

  c.innerHTML = `
    <div style="margin-bottom:6px;"><b>${plan.generated_by || "manual"} plan</b></div>
    <div class="list-item__meta">${plan.start_date ?? "-"} → ${plan.end_date ?? "-"}</div>
    <div style="margin-top:10px; line-height:1.4;">${escapeHtml(plan.plan_details || "")}</div>
  `;
}

async function generateSmartPlan(){
  const user = await getCurrentUser();
  if (!user) return alert("Please login first.");

  const { data: tasks } = await supabaseClient.from("tasks").select("*").order("deadline", { ascending: true }).limit(5);
  const { data: exams } = await supabaseClient.from("exams").select("*").order("exam_date", { ascending: true }).limit(3);

  let text = "Smart Study Suggestions:\n\n";

  if (exams?.length){
    text += "Upcoming Exams:\n";
    exams.forEach(e => text += `- ${e.subject} on ${e.exam_date}\n`);
    text += "\n";
  }

  if (tasks?.length){
    text += "Priority Tasks:\n";
    tasks.forEach(t => text += `- ${t.title} (due ${t.deadline ?? "-"})\n`);
    text += "\n";
  }

  text += "Plan:\n- Study 60–90 minutes daily.\n- Focus on nearest deadlines.\n- Review exam subjects 2–3 days before.\n";

  const today = new Date().toISOString().slice(0,10);
  await saveStudyPlan(text, today, today, "smart");
}

/* ========= 7) PERFORMANCE ========= */
async function upsertPerformance(avgGrade){
  const user = await getCurrentUser();
  if (!user) return alert("Please login first.");

  // completion rate based on tasks
  const { data: tasks } = await supabaseClient.from("tasks").select("status");
  const total = tasks?.length || 0;
  const done = tasks?.filter(t => t.status === "done")?.length || 0;
  const completion = total ? Math.round((done/total)*100) : 0;

  const { data: existing } = await supabaseClient
    .from("performance_records")
    .select("record_id")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (existing && existing.length){
    const { error } = await supabaseClient.from("performance_records")
      .update({ average_grade: avgGrade, completion_rate_percent: completion, updated_at: new Date().toISOString() })
      .eq("record_id", existing[0].record_id);
    if (error) return alert("Update performance error: " + error.message);
  } else {
    const { error } = await supabaseClient.from("performance_records").insert({
      user_id: user.id,
      average_grade: avgGrade,
      completion_rate_percent: completion
    });
    if (error) return alert("Create performance error: " + error.message);
  }

  await loadPerformance();
}

async function loadPerformance(){
  const user = await getCurrentUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from("performance_records")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) return alert("Load performance error: " + error.message);
  renderPerformance((data && data[0]) ? data[0] : null);
}

function renderPerformance(p){
  const c = $("performanceContainer");
  if (!c) return;

  if (!p){
    c.innerHTML = `<div class="list-item__meta">No performance data yet.</div>`;
    return;
  }

  c.innerHTML = `
    <div class="list-item">
      <div>
        <div><b>Average Grade:</b> ${p.average_grade ?? "-"}</div>
        <div class="list-item__meta">Completion Rate: ${p.completion_rate_percent ?? 0}%</div>
      </div>
    </div>
  `;
}

/* ========= 8) NOTIFICATIONS ========= */
function daysDiff(dateStr){
  if (!dateStr) return null;
  const today = new Date();
  const d = new Date(dateStr);
  return Math.ceil((d - today) / (1000*60*60*24));
}

async function notificationExistsToday(title, message){
  const user = await getCurrentUser();
  if (!user) return false;

  const today = new Date();
  today.setHours(0,0,0,0);
  const iso = today.toISOString();

  const { data } = await supabaseClient
    .from("notifications")
    .select("notification_id")
    .eq("title", title)
    .eq("message", message)
    .gte("created_at", iso)
    .limit(1);

  return !!(data && data.length);
}

async function createNotification(title, message, type){
  const user = await getCurrentUser();
  if (!user) return;

  const exists = await notificationExistsToday(title, message);
  if (exists) return;

  await supabaseClient.from("notifications").insert({
    user_id: user.id,
    title,
    message,
    type,
    is_read: false
  });
}

async function generateNotifications(){
  const user = await getCurrentUser();
  if (!user) return;

  const { data: tasks } = await supabaseClient.from("tasks").select("*");
  const { data: exams } = await supabaseClient.from("exams").select("*");

  // tasks due soon
  for (const t of (tasks || [])){
    const dd = daysDiff(t.deadline);
    if (dd !== null && dd >= 0 && dd <= 2 && t.status !== "done"){
      await createNotification("Upcoming Task Deadline", `${t.title} is due in ${dd} day(s).`, "task");
    }
  }

  // exams soon
  for (const e of (exams || [])){
    const dd = daysDiff(e.exam_date);
    if (dd !== null && dd >= 0 && dd <= 2){
      await createNotification("Upcoming Exam", `${e.subject} exam is in ${dd} day(s).`, "exam");
    }
  }
}

async function loadNotifications(){
  const user = await getCurrentUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return alert("Load notifications error: " + error.message);
  renderNotifications(data || []);
}

function renderNotifications(list){
  const c = $("notificationsContainer");
  if (!c) return;

  if (!list.length){
    c.innerHTML = `<div class="list-item__meta">No notifications.</div>`;
    return;
  }

  c.innerHTML = "";
  list.forEach(n => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div>
        <div><b>${n.title}</b></div>
        <div class="list-item__meta">${n.message}</div>
      </div>
    `;
    c.appendChild(div);
  });
}

/* ========= 9) MODAL WIRING ========= */
function wireModalClose(){
  document.querySelectorAll(".modal__overlay").forEach(ov=>{
    ov.addEventListener("click", ()=>{
      const id = ov.getAttribute("data-close");
      if (id) closeModal(id);
    });
  });

  document.querySelectorAll("[data-close]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-close");
      if (id) closeModal(id);
    });
  });
}

function escapeHtml(str){
  // minimal safe display
  return String(str).replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll("\n","<br>");
}

/* ========= 10) STARTUP ========= */
document.addEventListener("DOMContentLoaded", async () => {
  wireModalClose();

  // open auth modals
  $("btnSignup")?.addEventListener("click", ()=> openModal("signupModal"));
  $("btnLogin")?.addEventListener("click", ()=> openModal("loginModal"));

  $("btnLogout")?.addEventListener("click", async ()=>{
    const { error } = await supabaseClient.auth.signOut();
    if (error) alert("Logout error: " + error.message);
    await updateUI();
  });

  // signup submit
  $("signupSubmit")?.addEventListener("click", async ()=>{
    const fullName = $("signupName")?.value?.trim();
    const email = $("signupEmail")?.value?.trim();
    const pass = $("signupPassword")?.value;

    if (!fullName) return alert("Please enter full name");
    if (!email) return alert("Please enter email");
    if (!pass) return alert("Please enter password");

    const { error } = await supabaseClient.auth.signUp({
      email,
      password: pass,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });

    if (error) return alert("Signup error: " + error.message);
    alert("Account created! Check your email to confirm.");
    closeModal("signupModal");
  });

  // login submit
  $("loginSubmit")?.addEventListener("click", async ()=>{
    const email = $("loginEmail")?.value?.trim();
    const pass = $("loginPassword")?.value;

    if (!email) return alert("Please enter email");
    if (!pass) return alert("Please enter password");

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
    if (error) return alert("Login error: " + error.message);

    closeModal("loginModal");
    await updateUI();
  });

  // tasks modal
  $("btnAddTask")?.addEventListener("click", async ()=>{
    const user = await getCurrentUser();
    if (!user) return alert("Please login first.");
    $("taskTitle").value = "";
    $("taskDeadline").value = "";
    $("taskProgress").value = 0;
    openModal("taskModal");
  });

  $("taskSave")?.addEventListener("click", async ()=>{
    const title = $("taskTitle").value.trim();
    const deadline = $("taskDeadline").value;
    const progress = $("taskProgress").value;

    if (!title) return alert("Please enter task title");
    await addTask(title, deadline, progress);
    closeModal("taskModal");
  });

  // exams modal
  $("btnAddExam")?.addEventListener("click", async ()=>{
    const user = await getCurrentUser();
    if (!user) return alert("Please login first.");
    $("examSubject").value = "";
    $("examDate").value = "";
    openModal("examModal");
  });

  $("examSave")?.addEventListener("click", async ()=>{
    const subject = $("examSubject").value.trim();
    const date = $("examDate").value;

    if (!subject) return alert("Please enter subject");
    if (!date) return alert("Please choose a date");

    await addExam(subject, date);
    closeModal("examModal");
  });

  // study plan modal
  $("btnEditPlan")?.addEventListener("click", async ()=>{
    const user = await getCurrentUser();
    if (!user) return alert("Please login first.");
    openModal("planModal");
  });

  $("planSave")?.addEventListener("click", async ()=>{
    const start = $("planStart").value;
    const end = $("planEnd").value;
    const details = $("planDetails").value;

    if (!start || !end) return alert("Please choose start and end date");
    if (!details.trim()) return alert("Please write plan details");

    await saveStudyPlan(details, start, end, "manual");
    closeModal("planModal");
  });

  // smart plan
  $("btnSmartPlan")?.addEventListener("click", async ()=>{
    await generateSmartPlan();
  });

  // grade modal
  $("btnUpdateGrade")?.addEventListener("click", async ()=>{
    const user = await getCurrentUser();
    if (!user) return alert("Please login first.");
    $("gradeValue").value = "";
    openModal("gradeModal");
  });

  $("gradeSave")?.addEventListener("click", async ()=>{
    const v = Number($("gradeValue").value);
    if (!Number.isFinite(v)) return alert("Please enter a valid number");
    await upsertPerformance(v);
    closeModal("gradeModal");
  });

  // react to auth changes (tab refresh etc.)
  supabaseClient.auth.onAuthStateChange(async () => {
    await updateUI();
  });

  // initial
  await updateUI();
});