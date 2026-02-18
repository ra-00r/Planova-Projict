'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Animate progress bars
  const bars = document.querySelectorAll('.progress__bar');
  bars.forEach((bar) => {
    const w = bar.dataset.width || '0%';
    bar.style.width = '0%';
    requestAnimationFrame(() => {
      setTimeout(() => (bar.style.width = w), 250);
    });
  });

  // Sidebar active state
  const navItems = document.querySelectorAll('.nav__item');
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      // لو الرابط #... نخليه يسوي سكرول لطيف
      const href = item.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      navItems.forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Buttons demo
  const newTask = document.querySelector('.new-task');
  if (newTask) {
    newTask.addEventListener('click', () => {
      alert('Add New Task (Demo)');
    });
  }
});
const SUPABASE_URL = "YOUR_PROJECT_URL";
const SUPABASE_KEY = "sb_publishable_v4TO8Lh2upbkp9byJRBgUA_PSarae05";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) return alert("Signup error: " + error.message);
  alert("Signed up! Now login.");
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return alert("Login error: " + error.message);
  alert("Logged in!");
  await loadTasks();
  return data;
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) return alert("Logout error: " + error.message);
  alert("Logged out!");
}

async function getCurrentUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data.user;
}

async function addTask(title, deadline = null) {
  const user = await getCurrentUser();
  if (!user) return alert("Please login first.");

  const { error } = await supabaseClient.from("tasks").insert({
    user_id: user.id,
    title,
    deadline,
    status: "pending",
    progress_percent: 0
  });

  if (error) return alert("Add task error: " + error.message);

  alert("Task added!");
  await loadTasks();
}

async function loadTasks() {
  const user = await getCurrentUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .order("deadline", { ascending: true });

  if (error) return alert("Load tasks error: " + error.message);

  renderTasks(data);
}

function renderTasks(tasks) {
  const container = document.getElementById("tasksContainer");
  if (!container) return;

  container.innerHTML = "";
  tasks.forEach(t => {
    const item = document.createElement("div");
    item.innerHTML = `
      <b>${t.title}</b><br>
      Due: ${t.deadline ?? "-"}<br>
      Progress: ${t.progress_percent}%<br><hr>
    `;
    container.appendChild(item);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadTasks();

  document.getElementById("btnSignup")?.addEventListener("click", async () => {
    const email = prompt("Email:");
    const password = prompt("Password:");
    if (email && password) await signUp(email, password);
  });

  document.getElementById("btnLogin")?.addEventListener("click", async () => {
    const email = prompt("Email:");
    const password = prompt("Password:");
    if (email && password) await signIn(email, password);
  });

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut();
  });

  document.getElementById("btnAddTask")?.addEventListener("click", async () => {
    const title = prompt("Task title:");
    const deadline = prompt("Deadline (YYYY-MM-DD) optional:");
    if (title) await addTask(title, deadline || null);
  });
});