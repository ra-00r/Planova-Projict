// =============================================
// PLANOVA - Main Application JavaScript
// =============================================

// ─── Supabase Configuration ─────────────────
// 🔧 REPLACE WITH YOUR SUPABASE CREDENTIALS
const SUPABASE_URL = "https://qcfnilswrabwtkitbofj.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_v4TO8Lh2upbkp9byJRBgUA_PSarae05";

let supabase = null;

// Initialize Supabase
function initSupabase() {
  if (typeof window.supabase !== "undefined") {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  }
  return false;
}

// ─── Auth State ─────────────────────────────
let currentUser = null;
let currentProfile = null;

// ─── Toast Notifications ─────────────────────
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icons = { success: "✓", error: "✕", warning: "⚠" };
  toast.innerHTML = `<span>${icons[type] || "•"}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function createToastContainer() {
  const c = document.createElement("div");
  c.id = "toast-container";
  c.className = "toast-container";
  document.body.appendChild(c);
  return c;
}

// ─── Auth Functions ──────────────────────────
async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
  if (error) throw error;

  // Create profile
  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      email: email
    });
  }
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}

async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

// ─── Auth Guard ──────────────────────────────
async function initAuthGuard() {
  if (!supabase) return;

  const { data } = await supabase.auth.getSession();
  currentUser = data?.session?.user || null;

  if (currentUser) {
    currentProfile = await getProfile(currentUser.id).catch(() => null);
  }

  // Listen to auth changes
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    currentProfile = currentUser ? await getProfile(currentUser.id).catch(() => null) : null;
  });
}

// ─── UI Helpers ──────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function getUserName() {
  return currentProfile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email || "User";
}

function showSection(id) {
  document.querySelectorAll("main > section").forEach(s => s.classList.add("hidden"));
  const section = document.getElementById(id);
  if (section) section.classList.remove("hidden");
}

function setActiveNav(target) {
  document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
  const active = document.querySelector(`.nav-item[data-target="${target}"]`);
  if (active) active.classList.add("active");
}

// ─── Sidebar & Navigation ────────────────────
function initNavigation() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const target = item.dataset.target;
      if (!target) return;
      showSection(target);
      setActiveNav(target);

      // Page-specific initialization
      if (target === "tasks-section") initTasksPage();
      if (target === "attendance-section") initAttendancePage();
      if (target === "exams-section") initExamsPage();
      if (target === "plans-section") initStudyPlanPage();
      if (target === "performance-section") initPerformancePage();
      if (target === "dashboard-section") initDashboardPage();
      if (target === "notifications-section") initNotificationsPage();
      if (target === "settings-section") initSettingsPage();
    });
  });

  // Default
  showSection("dashboard-section");
  setActiveNav("dashboard-section");
}

// ─── Modal Helper ────────────────────────────
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.classList.add("open");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("open");
}

function initModals() {
  document.querySelectorAll("[data-modal-close]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.dataset.modalClose));
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", e => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });
}

// ─── TASKS ──────────────────────────────────
let tasksLoaded = false;

function renderTaskItem(task) {
  const due = task.due_date ? formatDate(task.due_date) : "No due date";
  const pri = task.priority || "normal";
  const done = task.is_done ? "done" : "";
  return `
    <div class="task-card ${done}" data-id="${task.id}">
      <div class="task-left">
        <input type="checkbox" class="task-check" ${task.is_done ? "checked" : ""} />
        <div>
          <div class="task-title">${task.title || "Untitled task"}</div>
          <div class="task-meta">
            <span class="tag pri-${pri}">${pri}</span>
            <span class="tag">${due}</span>
          </div>
        </div>
      </div>
      <div class="task-actions">
        <button class="action-btn edit-btn" data-id="${task.id}" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button class="action-btn delete-btn" data-id="${task.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

async function loadTasks() {
  const container = document.getElementById("tasks-list");
  if (!container || !currentUser) return;

  const { data, error } = await supabase.from("tasks").select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    showToast("Error loading tasks", "error");
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 12h6m-6 4h6M7 20h10a2 2 0 002-2V6a2 2 0 00-2-2H9.414a2 2 0 01-1.414-.586L6.586 2.586A2 2 0 005.172 2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
      </svg>
      <p>No tasks yet. Add your first task!</p>
    </div>`;
    return;
  }

  container.innerHTML = data.map(t => renderTaskItem(t)).join("");
  attachTaskEvents(container);
}

function attachTaskEvents(container) {
  container.querySelectorAll(".task-check").forEach(chk => {
    chk.addEventListener("change", async (e) => {
      const card = e.target.closest(".task-card");
      if (!card) return;
      const id = card.dataset.id;
      await supabase.from("tasks").update({ is_done: e.target.checked }).eq("id", id);
      card.classList.toggle("done", e.target.checked);
      showToast(e.target.checked ? "Task completed" : "Task marked as pending", "success");
      await loadDashboard();
    });
  });

  container.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const { data } = await supabase.from("tasks").select("*").eq("id", id).single();
      if (!data) return;
      document.getElementById("task-title").value = data.title || "";
      document.getElementById("task-due").value = data.due_date?.slice(0, 10) || "";
      document.getElementById("task-priority").value = data.priority || "normal";
      document.getElementById("task-notes").value = data.notes || "";
      document.getElementById("save-task-btn").dataset.editId = id;
      document.getElementById("modal-task-title").textContent = "Edit Task";
      openModal("task-modal");
    });
  });

  container.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this task?")) return;
      await supabase.from("tasks").delete().eq("id", btn.dataset.id);
      showToast("Task deleted", "warning");
      await loadTasks();
      await loadDashboard();
    });
  });
}

function initTasksPage() {
  if (tasksLoaded) {
    loadTasks();
    return;
  }
  tasksLoaded = true;

  document.getElementById("btn-add-task")?.addEventListener("click", () => {
    document.getElementById("task-form")?.reset();
    document.getElementById("save-task-btn").dataset.editId = "";
    document.getElementById("modal-task-title").textContent = "Add Task";
    openModal("task-modal");
  });

  document.getElementById("task-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("save-task-btn");
    const editId = btn.dataset.editId;
    btn.disabled = true;
    try {
      const taskData = {
        title: document.getElementById("task-title").value,
        due_date: document.getElementById("task-due").value || null,
        priority: document.getElementById("task-priority").value,
        notes: document.getElementById("task-notes").value
      };

      if (editId) {
        await supabase.from("tasks").update(taskData).eq("id", editId);
        showToast("Task updated!");
      } else {
        await supabase.from("tasks").insert({ ...taskData, user_id: currentUser.id, is_done: false });
        showToast("Task created!");
      }

      closeModal("task-modal");
      await loadTasks();
      await loadDashboard();
    } catch (err) {
      showToast(err.message || "Error saving task", "error");
    } finally {
      btn.disabled = false;
    }
  });

  loadTasks();
}

// ─── ATTENDANCE ──────────────────────────────
async function loadAttendance() {
  const container = document.getElementById("attendance-list");
  if (!container || !currentUser) return;

  const { data, error } = await supabase.from("attendance").select("*")
    .eq("user_id", currentUser.id)
    .order("date", { ascending: false });

  if (error) {
    showToast("Error loading attendance", "error");
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      <p>No attendance records yet.</p>
    </div>`;
    return;
  }

  container.innerHTML = data.map(rec => `
    <div class="attendance-card">
      <div>
        <div class="attendance-date">${formatDate(rec.date)}</div>
        <div class="attendance-status">${rec.status || ""}</div>
      </div>
      <div class="task-actions">
        <button class="action-btn delete-btn" data-id="${rec.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this record?")) return;
      await supabase.from("attendance").delete().eq("id", btn.dataset.id);
      showToast("Attendance record deleted", "warning");
      await loadAttendance();
    });
  });
}

function initAttendancePage() {
  document.getElementById("attendance-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("save-attendance-btn");
    btn.disabled = true;
    try {
      const date = document.getElementById("attendance-date").value;
      const status = document.getElementById("attendance-status").value;

      if (!date || !status) {
        showToast("Please fill all fields", "warning");
        return;
      }

      await supabase.from("attendance").insert({
        user_id: currentUser.id,
        date,
        status
      });

      showToast("Attendance saved!");
      document.getElementById("attendance-form").reset();
      await loadAttendance();
    } catch (err) {
      showToast(err.message || "Error saving attendance", "error");
    } finally {
      btn.disabled = false;
    }
  });

  loadAttendance();
}

// ─── EXAMS ───────────────────────────────────
let editingExamId = null;

function renderExamItem(exam) {
  return `
    <div class="exam-card" data-id="${exam.id}">
      <div>
        <div class="exam-title">${exam.subject || "Exam"}</div>
        <div class="exam-date">${formatDate(exam.exam_date)}</div>
        ${exam.reminder_datetime ? `<div class="tag">Reminder: ${formatDateTime(exam.reminder_datetime)}</div>` : ""}
        ${exam.notes ? `<div class="exam-notes">${exam.notes}</div>` : ""}
      </div>
      <div class="task-actions">
        <button class="action-btn edit-btn" data-id="${exam.id}" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button class="action-btn delete-btn" data-id="${exam.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

async function loadExams() {
  const container = document.getElementById("exams-list");
  if (!container || !currentUser) return;

  const { data, error } = await supabase.from("exams").select("*")
    .eq("user_id", currentUser.id)
    .order("exam_date", { ascending: true });

  if (error) {
    showToast("Error loading exams", "error");
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
      </svg>
      <p>No exams scheduled. Add your first exam!</p>
    </div>`;
    return;
  }

  container.innerHTML = data.map(exam => renderExamItem(exam)).join("");

  container.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { data: exam } = await supabase.from("exams").select("*").eq("id", btn.dataset.id).single();
      if (!exam) return;
      editingExamId = exam.id;
      document.getElementById("exam-subject").value = exam.subject || "";
      document.getElementById("exam-date").value = exam.exam_date?.slice(0, 10) || "";
      document.getElementById("exam-reminder").value = exam.reminder_datetime?.slice(0, 16) || "";
      document.getElementById("exam-notes").value = exam.notes || "";
      document.getElementById("modal-exam-title").textContent = "Edit Exam";
      openModal("exam-modal");
    });
  });

  container.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this exam?")) return;
      await supabase.from("exams").delete().eq("id", btn.dataset.id);
      showToast("Exam deleted", "warning");
      await loadExams();
    });
  });
}

function initExamsPage() {
  document.getElementById("btn-add-exam")?.addEventListener("click", () => {
    editingExamId = null;
    document.getElementById("exam-form")?.reset();
    document.getElementById("modal-exam-title").textContent = "Add Exam";
    openModal("exam-modal");
  });

  document.getElementById("exam-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("save-exam-btn");
    btn.disabled = true;
    try {
      const examData = {
        subject: document.getElementById("exam-subject").value,
        exam_date: document.getElementById("exam-date").value,
        reminder_datetime: document.getElementById("exam-reminder").value || null,
        notes: document.getElementById("exam-notes").value
      };

      if (editingExamId) {
        await supabase.from("exams").update(examData).eq("id", editingExamId);
        showToast("Exam updated!");
      } else {
        await supabase.from("exams").insert({ ...examData, user_id: currentUser.id });
        showToast("Exam added!");
        await createNotification(
          "Exam Scheduled",
          `Exam "${examData.subject}" scheduled for ${formatDate(examData.exam_date)}`,
          "exam"
        );
      }

      editingExamId = null;
      closeModal("exam-modal");
      await loadExams();
    } catch (err) {
      showToast(err.message || "Error saving exam", "error");
    } finally {
      btn.disabled = false;
    }
  });

  loadExams();
}

// ─── STUDY PLANS ─────────────────────────────
let editingPlanId = null;

async function loadStudyPlans() {
  const container = document.getElementById("plans-list");
  if (!container || !currentUser) return;

  const { data, error } = await supabase.from("study_plans").select("*")
    .eq("user_id", currentUser.id)
    .order("start_date", { ascending: false });

  if (error) {
    showToast("Error loading plans", "error");
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
      </svg>
      <p>No study plans yet. Create your first plan!</p>
    </div>`;
    return;
  }

  container.innerHTML = data.map(plan => `
    <div class="plan-card" data-id="${plan.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="plan-card-title">${plan.title || "Study Plan"}</div>
          <div class="plan-card-dates">${formatDate(plan.start_date)} → ${formatDate(plan.end_date)}</div>
        </div>
        <div class="task-actions">
          <button class="action-btn edit-btn" data-id="${plan.id}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button class="action-btn delete-btn" data-id="${plan.id}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="plan-card-details">${plan.plan_details || ""}</div>
    </div>
  `).join("");

  container.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { data: plan } = await supabase.from("study_plans").select("*").eq("id", btn.dataset.id).single();
      if (!plan) return;
      editingPlanId = plan.id;
      document.getElementById("plan-title").value = plan.title || "";
      document.getElementById("plan-start").value = plan.start_date?.slice(0, 10) || "";
      document.getElementById("plan-end").value = plan.end_date?.slice(0, 10) || "";
      document.getElementById("plan-details").value = plan.plan_details || "";
      document.getElementById("modal-plan-title").textContent = "Edit Study Plan";
      openModal("plan-modal");
    });
  });

  container.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this plan?")) return;
      await supabase.from("study_plans").delete().eq("id", btn.dataset.id);
      showToast("Plan deleted", "warning");
      await loadStudyPlans();
    });
  });
}

function initStudyPlanPage() {
  document.getElementById("btn-add-plan")?.addEventListener("click", () => {
    editingPlanId = null;
    document.getElementById("plan-form")?.reset();
    document.getElementById("modal-plan-title").textContent = "Add Study Plan";
    openModal("plan-modal");
  });

  document.getElementById("plan-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("save-plan-btn");
    btn.disabled = true;
    try {
      const planData = {
        title: document.getElementById("plan-title").value,
        start_date: document.getElementById("plan-start").value,
        end_date: document.getElementById("plan-end").value,
        plan_details: document.getElementById("plan-details").value
      };

      if (editingPlanId) {
        await supabase.from("study_plans").update(planData).eq("id", editingPlanId);
        showToast("Plan updated!");
      } else {
        await supabase.from("study_plans").insert({ ...planData, user_id: currentUser.id });
        showToast("Study plan created!");
      }

      editingPlanId = null;
      closeModal("plan-modal");
      await loadStudyPlans();
    } catch (err) {
      showToast(err.message || "Error saving plan", "error");
    } finally {
      btn.disabled = false;
    }
  });

  loadStudyPlans();
}

// ─── PERFORMANCE ─────────────────────────────
async function loadPerformance() {
  const container = document.getElementById("performance-list");
  if (!container || !currentUser) return;

  const { data } = await supabase.from("performance_records").select("*")
    .eq("user_id", currentUser.id)
    .order("recorded_at", { ascending: false });

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No performance data. Add your first record!</p></div>`;
    updatePerformanceDashboard(null);
    return;
  }

  const latest = data[0];
  updatePerformanceDashboard(latest);

  container.innerHTML = data.map(rec => `
    <div class="performance-card" data-id="${rec.id}">
      <div class="perf-head">
        <div class="tag">Avg: ${rec.average_grade || 0}%</div>
        <div class="tag">Completion: ${rec.completion_rate || 0}%</div>
        <div class="tag">${formatDateTime(rec.recorded_at)}</div>
      </div>
      ${rec.notes ? `<div class="perf-notes">${rec.notes}</div>` : ""}
      <div class="task-actions">
        <button class="action-btn edit-btn" data-id="${rec.id}" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button class="action-btn delete-btn" data-id="${rec.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { data: rec } = await supabase.from("performance_records").select("*").eq("id", btn.dataset.id).single();
      if (!rec) return;
      document.getElementById("perf-grade").value = rec.average_grade || 0;
      document.getElementById("perf-completion").value = rec.completion_rate || 0;
      document.getElementById("perf-grade-val").textContent = (rec.average_grade || 0) + "%";
      document.getElementById("perf-completion-val").textContent = (rec.completion_rate || 0) + "%";
      document.getElementById("perf-notes").value = rec.notes || "";
      document.getElementById("save-perf-btn").dataset.editId = rec.id;
      document.getElementById("modal-perf-title").textContent = "Edit Performance Record";
      openModal("perf-modal");
    });
  });

  container.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this record?")) return;
      await supabase.from("performance_records").delete().eq("id", btn.dataset.id);
      showToast("Record deleted", "warning");
      await loadPerformance();
    });
  });
}

function updatePerformanceDashboard(data) {
  const gradeEl = document.getElementById("dash-grade");
  const completionEl = document.getElementById("dash-completion");
  const gradeBar = document.getElementById("dash-grade-bar");
  const completionBar = document.getElementById("dash-completion-bar");

  if (!data) {
    if (gradeEl) gradeEl.textContent = "0";
    if (completionEl) completionEl.textContent = "0";
    if (gradeBar) gradeBar.style.width = "0%";
    if (completionBar) completionBar.style.width = "0%";
    return;
  }

  if (gradeEl) gradeEl.textContent = data?.average_grade || 0;
  if (completionEl) completionEl.textContent = data?.completion_rate || 0;
  if (gradeBar) gradeBar.style.width = (data?.average_grade || 0) + "%";
  if (completionBar) completionBar.style.width = (data?.completion_rate || 0) + "%";
}

function drawPerformanceChart(records) {
  const canvas = document.getElementById("perf-chart");
  if (!canvas || !records.length) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = 160;

  ctx.clearRect(0, 0, w, h);

  const grades = records.map(r => r.average_grade || 0);
  const max = Math.max(...grades, 100);
  const min = 0;
  const range = max - min;
  const padding = { top: 16, right: 16, bottom: 32, left: 36 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const xStep = chartW / (grades.length - 1 || 1);
  const yScale = y => chartH - ((y - min) / range) * chartH;

  // Grid lines
  ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1;
  [0, 25, 50, 75, 100].forEach(v => {
    const y = padding.top + yScale(v);
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.font = "10px Plus Jakarta Sans"; ctx.textAlign = "right";
    ctx.fillText(v + "%", padding.left - 4, y + 3);
  });

  // Axes labels
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "center";
  ctx.font = "10px Plus Jakarta Sans";
  records.forEach((r, i) => {
    const x = padding.left + i * xStep;
    const label = new Date(r.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    ctx.fillText(label, x, h - 12);
  });

  // Line
  ctx.beginPath();
  grades.forEach((g, i) => {
    const x = padding.left + i * xStep;
    const y = padding.top + yScale(g);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Points
  grades.forEach((g, i) => {
    const x = padding.left + i * xStep;
    const y = padding.top + yScale(g);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#6366f1";
    ctx.fill();
  });
}

function initPerformancePage() {
  document.getElementById("btn-add-perf")?.addEventListener("click", () => {
    document.getElementById("perf-form")?.reset();
    document.getElementById("perf-grade-val").textContent = "0%";
    document.getElementById("perf-completion-val").textContent = "0%";
    document.getElementById("modal-perf-title").textContent = "Add Performance Record";
    delete document.getElementById("save-perf-btn").dataset.editId;
    openModal("perf-modal");
  });

  document.getElementById("perf-grade")?.addEventListener("input", e => {
    document.getElementById("perf-grade-val").textContent = e.target.value + "%";
  });

  document.getElementById("perf-completion")?.addEventListener("input", e => {
    document.getElementById("perf-completion-val").textContent = e.target.value + "%";
  });

  document.getElementById("perf-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("save-perf-btn");
    const editId = btn.dataset.editId;
    btn.disabled = true;
    try {
      const perfData = {
        average_grade: parseInt(document.getElementById("perf-grade").value),
        completion_rate: parseInt(document.getElementById("perf-completion").value),
        notes: document.getElementById("perf-notes").value
      };

      if (editId) {
        await supabase.from("performance_records").update(perfData).eq("id", editId);
        showToast("Record updated!");
      } else {
        await supabase.from("performance_records").insert({
          ...perfData,
          user_id: currentUser.id,
          recorded_at: new Date().toISOString()
        });
        showToast("Record added!");
      }

      closeModal("perf-modal");
      await loadPerformance();
    } catch (err) {
      showToast(err.message || "Error", "error");
    } finally {
      btn.disabled = false;
    }
  });

  loadPerformance();
}

// ─── NOTIFICATIONS ───────────────────────────
async function createNotification(title, message, type = "general") {
  if (!currentUser) return;
  await supabase.from("notifications").insert({
    user_id: currentUser.id,
    title,
    message,
    type
  });
}

async function loadNotifications() {
  const container = document.getElementById("notifications-list");
  if (!container || !currentUser) return;

  const { data, error } = await supabase.from("notifications").select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    showToast("Error loading notifications", "error");
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No notifications.</p></div>`;
    return;
  }

  container.innerHTML = data.map(n => `
    <div class="notification-card ${n.is_read ? "read" : ""}" data-id="${n.id}">
      <div class="notification-title">${n.title || "Notification"}</div>
      <div class="notification-message">${n.message || ""}</div>
      <div class="notification-meta">${formatDateTime(n.created_at)}</div>
      <div class="task-actions">
        <button class="action-btn markread-btn" data-id="${n.id}">${n.is_read ? "Read" : "Mark as read"}</button>
        <button class="action-btn delete-btn" data-id="${n.id}">Delete</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".markread-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", btn.dataset.id);
      await loadNotifications();
    });
  });

  container.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this notification?")) return;
      await supabase.from("notifications").delete().eq("id", btn.dataset.id);
      await loadNotifications();
    });
  });
}

function initNotificationsPage() {
  loadNotifications();
}

// ─── DASHBOARD ───────────────────────────────
async function loadDashboard() {
  const greeting = document.getElementById("dashboard-greeting");
  if (greeting) {
    const name = getUserName();
    greeting.textContent = `${getGreeting()}, ${name}`;
  }

  if (!currentUser) return;

  // Tasks due this week
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const { data: tasks } = await supabase.from("tasks").select("*")
    .eq("user_id", currentUser.id)
    .eq("is_done", false)
    .lte("due_date", weekEnd.toISOString());

  const taskCount = document.getElementById("tasks-due-count");
  if (taskCount) taskCount.textContent = tasks?.length || 0;

  // Pending tasks preview
  const pendingContainer = document.getElementById("pending-tasks-preview");
  if (pendingContainer) {
    const { data: pending } = await supabase.from("tasks").select("*")
      .eq("user_id", currentUser.id).eq("is_done", false)
      .order("due_date", { ascending: true }).limit(3);

    if (pending && pending.length > 0) {
      pendingContainer.innerHTML = pending.map(t => renderTaskItem(t)).join("");
      attachTaskEvents(pendingContainer);
    } else {
      pendingContainer.innerHTML = '<div class="empty-state" style="padding:16px 0"><p>No pending tasks! 🎉</p></div>';
    }
  }

  // Upcoming exams
  const examsContainer = document.getElementById("upcoming-exams-preview");
  if (examsContainer) {
    const { data: exams } = await supabase.from("exams").select("*")
      .eq("user_id", currentUser.id)
      .gte("exam_date", new Date().toISOString().slice(0, 10))
      .order("exam_date", { ascending: true }).limit(2);

    if (exams && exams.length > 0) {
      examsContainer.innerHTML = exams.map(e => renderExamItem(e)).join("");
    } else {
      examsContainer.innerHTML = '<div class="empty-state" style="padding:16px 0"><p>No upcoming exams</p></div>';
    }
  }

  // Study plan today
  const planContainer = document.getElementById("today-plan-preview");
  if (planContainer) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: plans } = await supabase.from("study_plans").select("*")
      .eq("user_id", currentUser.id)
      .lte("start_date", today)
      .gte("end_date", today).limit(1);

    if (plans && plans.length > 0) {
      planContainer.innerHTML = `<div class="tag">${plans[0].plan_details?.slice(0, 60) || "Study session"}</div>`;
    } else {
      planContainer.innerHTML = '<div class="empty-state" style="padding:8px 0"><p>No plan for today</p></div>';
    }
  }

  // Performance data
  const { data: perf } = await supabase.from("performance_records").select("*")
    .eq("user_id", currentUser.id).order("recorded_at", { ascending: false }).limit(1);

  if (perf && perf.length > 0) updatePerformanceDashboard(perf[0]);

  // Dashboard chart
  const { data: perfHistory } = await supabase.from("performance_records").select("*")
    .eq("user_id", currentUser.id).order("recorded_at", { ascending: true }).limit(7);

  if (perfHistory && perfHistory.length > 0) drawPerformanceChart(perfHistory);
}

function initDashboardPage() {
  loadDashboard();
}

// ─── AUTH PAGE ───────────────────────────────
function initAuthPage() {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const switchToSignUp = document.getElementById("switch-to-signup");
  const switchToLogin = document.getElementById("switch-to-login");

  switchToSignUp?.addEventListener("click", () => {
    document.getElementById("login-card")?.classList.add("hidden");
    document.getElementById("signup-card")?.classList.remove("hidden");
  });

  switchToLogin?.addEventListener("click", () => {
    document.getElementById("signup-card")?.classList.add("hidden");
    document.getElementById("login-card")?.classList.remove("hidden");
  });

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("login-btn");
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      await signIn(email, password);
      window.location.href = "app.html";
    } catch (err) {
      showToast(err.message || "Login failed", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  });

  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("signup-btn");
    btn.disabled = true;
    btn.textContent = "Creating account…";
    try {
      const fullName = document.getElementById("signup-name").value;
      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;
      await signUp(email, password, fullName);
      showToast("Account created! Please check your email to confirm.", "success");
      document.getElementById("signup-card")?.classList.add("hidden");
      document.getElementById("login-card")?.classList.remove("hidden");
      document.querySelector('[data-target="login-section"]')?.click();
    } catch (err) {
      showToast(err.message || "Signup failed", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Create Account";
    }
  });
}

// ─── SETTINGS ────────────────────────────────
function initSettingsPage() {
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await signOut();
  });
}

// ─── APP INIT ────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const isSupabaseReady = initSupabase();
  if (!isSupabaseReady) {
    showToast("Supabase library not loaded. Please include supabase-js.", "error");
    return;
  }

  await initAuthGuard();
  initModals();

  // Detect which page we’re on
  const isAuthPage = document.getElementById("login-form") || document.getElementById("signup-form");
  if (isAuthPage) {
    initAuthPage();
    return;
  }

  // Must be logged in for app.html
  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  // Fill user info
  const userNameEl = document.getElementById("user-name");
  const userEmailEl = document.getElementById("user-email");
  if (userNameEl) userNameEl.textContent = getUserName();
  if (userEmailEl) userEmailEl.textContent = currentUser.email || "";

  initNavigation();
  initDashboardPage();
});