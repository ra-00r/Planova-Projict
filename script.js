"use strict";

/********************** 0) Supabase Config ************************/
const SUPABASE_URL = "https://qcfnilswrabwtkitbofj.supabase.co/";
const SUPABASE_ANON_KEY = "sb_publishable_v4TO8Lh2upbkp9byJRBgUA_PSarae05";

const sb = window.__planova_sb || (window.__planova_sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: true,
    },
  }
));

/********************** 1) Session persistence ************************/
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
    const { data, error } = await sb.auth.setSession({ access_token, refresh_token });

    if (error) {
      clearSessionTokens();
      return null;
    }

    if (data?.session) saveSessionTokens(data.session);
    return data?.session || null;
  } catch {
    clearSessionTokens();
    return null;
  }
}

/********************** 2) Helpers ************************/
const $ = (id) => document.getElementById(id);
const pageName = () => document.body?.dataset?.page || "";
const show = (el) => { if (el) el.style.display = ""; };
const hide = (el) => { if (el) el.style.display = "none"; };

function setNotice(id, msg, isError=false){
  const el = $(id);
  if(!el) return;
  el.style.display = msg ? "block" : "none";
  el.textContent = msg || "";
  el.style.borderColor = isError ? "rgba(255,90,90,.35)" : "rgba(255,255,255,.14)";
}

/********************** 3) Auth ************************/
async function updateAuthUI(){
  const { data } = await sb.auth.getSession();
  const session = data?.session || null;

  const btnLogin = $("btnLogin");
  const btnSignup = $("btnSignup");
  const btnLogout = $("btnLogout");

  if(session){
    hide(btnLogin); hide(btnSignup); show(btnLogout);
  }else{
    show(btnLogin); show(btnSignup); hide(btnLogout);
  }

  if($("userEmail")) {
    $("userEmail").textContent = session?.user?.email || "Not signed in";
  }

  return session;
}

function bindAuthUI(){
  $("btnLogin")?.addEventListener("click", () => $("authOverlay").style.display="flex");
  $("btnSignup")?.addEventListener("click", () => $("authOverlay").style.display="flex");

  $("btnLogout")?.addEventListener("click", async () => {
    await sb.auth.signOut();
    clearSessionTokens();
    await updateAuthUI();
    await loadAllForCurrentPage();
  });

  $("authForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = $("authEmail")?.value?.trim();
    const password = $("authPassword")?.value;

    if(!email || !password){
      setNotice("authNotice","Email & password required",true);
      return;
    }

    setNotice("authNotice","Working...");

    try{
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if(error) throw error;

      await updateAuthUI();
      $("authOverlay").style.display="none";
    }catch(err){
      setNotice("authNotice", err.message, true);
    }
  });

  sb.auth.onAuthStateChange(async (event, session) => {
    if(session) saveSessionTokens(session);
    if(event==="SIGNED_OUT") clearSessionTokens();

    await updateAuthUI();
    await loadAllForCurrentPage();
  });
}

/********************** 4) Load per page ************************/
async function loadAllForCurrentPage(){
  const session = await updateAuthUI();
  if(!session){
    return;
  }

  // لو تبين تضيفين تحميل بيانات هنا ضيفي
}

/********************** 5) Init ************************/
document.addEventListener("DOMContentLoaded", async () => {

  bindAuthUI();

  // 🔥 أهم سطر — يرجع الجلسة قبل أي شي
  await restoreSessionFromStorage();

  await loadAllForCurrentPage();
});