/* ===========================
   app.js (AUTH + ADMIN CHAT)
   Firebase v10.12.2
=========================== */

import { auth, db, storage } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* ===========================
   HELPERS
=========================== */
const $ = (id) => document.getElementById(id);
const val = (el) => (el?.value || "").trim();

function showMessage(id, msg, type = "error") {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `message ${type}`;
  el.classList.remove("hidden");
}

function clearMessage(id) {
  const el = $(id);
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function setLoading(btn, state, text = "Loading...") {
  if (!btn) return;
  if (state) {
    btn.dataset.old = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.old || btn.textContent;
    btn.disabled = false;
  }
}

/* ===========================
   REGISTER
=========================== */
async function registerUser() {
  clearMessage("register-message");

  const username = val($("regUsername"));
  const email = val($("regEmail"));
  const password = $("regPassword")?.value || "";
  const confirm = $("regConfirmPassword")?.value || "";

  if (!email || !password) {
    showMessage("register-message", "Email and password are required.");
    return;
  }
  if (password !== confirm) {
    showMessage("register-message", "Passwords do not match.");
    return;
  }

  const btn = $("register-btn");

  try {
    setLoading(btn, true, "Creating account...");
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // first user becomes admin
    let role = "user";
    const adminMeta = doc(db, "meta", "admin");
    const snap = await getDoc(adminMeta);
    if (!snap.exists()) {
      role = "admin";
      await setDoc(adminMeta, { created: true });
    }

    await setDoc(doc(db, "users", cred.user.uid), {
      username: username || email.split("@")[0],
      email,
      role,
      createdAt: serverTimestamp()
    });

    showMessage("register-message", "Account created. Redirecting...", "success");
    setTimeout(() => location.href = "login.html", 800);

  } catch (err) {
    console.error(err);
    showMessage("register-message", err.message || "Registration failed.");
  } finally {
    setLoading(btn, false);
  }
}

/* ===========================
   LOGIN
=========================== */
async function loginUser(e) {
  e?.preventDefault();
  clearMessage("login-message");

  const email = val($("loginEmail"));
  const password = $("loginPassword")?.value || "";
  const btn = $("login-btn");

  if (!email || !password) {
    showMessage("login-message", "Email and password required.");
    return;
  }

  try {
    setLoading(btn, true, "Logging in...");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));

    if (snap.exists() && snap.data().role === "admin") {
      location.href = "admin.html";
    } else {
      location.href = "user-chat.html";
    }

  } catch (err) {
    console.error(err);
    showMessage("login-message", err.message || "Login failed.");
  } finally {
    setLoading(btn, false);
  }
}

/* ===========================
   FORGOT PASSWORD
=========================== */
async function forgotPassword(e) {
  e?.preventDefault();
  const email = val($("loginEmail")) || prompt("Enter your email");

  if (!email) return;

  try {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent.");
  } catch (err) {
    console.error(err);
    alert("Failed to send reset email.");
  }
}

/* ===========================
   LOGOUT
=========================== */
async function logoutUser() {
  await signOut(auth);
  location.href = "login.html";
}

/* ===========================
   AUTH GUARD
=========================== */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return;

  if (location.pathname.includes("admin") && snap.data().role !== "admin") {
    alert("Unauthorized");
    location.href = "login.html";
  }
});

/* ===========================
   ADMIN CHAT
=========================== */
let activeUserId = null;
let unsubscribeMessages = null;

const usersList = $("usersList");
const chatTitle = $("adminChatTitle");
const messagesBox = $("adminMessages");
const msgInput = $("adminMessageInput");
const fileInput = $("adminFileInput");
const fileBtn = $("adminFileBtn");
const sendBtn = $("adminSendBtn");

async function loadUsers() {
  if (!usersList) return;
  const snap = await getDocs(collection(db, "users"));
  usersList.innerHTML = "";

  snap.forEach(d => {
    const u = d.data();
    if (u.role === "admin") return;
    const li = document.createElement("li");
    li.textContent = u.username || u.email;
    li.onclick = () => openChat(d.id, li.textContent);
    usersList.appendChild(li);
  });
}

function openChat(uid, name) {
  activeUserId = uid;
  chatTitle.textContent = name;
  messagesBox.innerHTML = "";

  unsubscribeMessages?.();

  const q = query(collection(db, "messages"), orderBy("createdAt"));
  unsubscribeMessages = onSnapshot(q, snap => {
    messagesBox.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      if (
        (m.senderId === auth.currentUser.uid && m.receiverId === uid) ||
        (m.senderId === uid && m.receiverId === auth.currentUser.uid)
      ) renderMessage(m);
    });
  });
}

sendBtn?.addEventListener("click", async () => {
  const text = msgInput.value.trim();
  if (!text || !activeUserId) return;

  await addDoc(collection(db, "messages"), {
    senderId: auth.currentUser.uid,
    receiverId: activeUserId,
    senderRole: "admin",
    text,
    createdAt: serverTimestamp()
  });

  msgInput.value = "";
});

fileBtn?.addEventListener("click", () => fileInput.click());

fileInput?.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file || !activeUserId) return;

  const storageRef = ref(storage, `chat/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  await addDoc(collection(db, "messages"), {
    senderId: auth.currentUser.uid,
    receiverId: activeUserId,
    senderRole: "admin",
    imageUrl: url,
    createdAt: serverTimestamp()
  });

  fileInput.value = "";
});

function renderMessage(m) {
  const div = document.createElement("div");
  div.className = "msg " + (m.senderRole === "admin" ? "admin" : "user");

  if (m.text) div.textContent = m.text;
  if (m.imageUrl) {
    const img = document.createElement("img");
    img.src = m.imageUrl;
    img.style.maxWidth = "240px";
    div.appendChild(img);
  }

  messagesBox.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

/* ===========================
   BUTTON WIRING (FIX)
=========================== */
$("login-btn")?.addEventListener("click", loginUser);
$("register-btn")?.addEventListener("click", registerUser);
$("forgotLink")?.addEventListener("click", forgotPassword);

loadUsers();

/* expose for safety */
window.loginUser = loginUser;
window.registerUser = registerUser;
window.logoutUser = logoutUser;
window.forgotPassword = forgotPassword;
