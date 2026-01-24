/* ===========================
   app.js (AUTH + ADMIN CHAT)
   Updated: merged robust Firebase auth UI handling,
   safe DOM access, error handling, forgot-password,
   and improved admin chat listener cleanup.
   This file expects ./firebase.js to exist and export auth, db, storage.
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
   Helpers: safe DOM access & UI
=========================== */
function $id(...ids) {
  for (const id of ids) {
    if (!id) continue;
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function getInputValue(el) {
  return (el && el.value) ? el.value.trim() : "";
}

function createOrGetMessageContainer(ctx = "global") {
  const id = `${ctx}-message`;
  let el = document.getElementById(id);
  if (el) return el;

  const card = document.querySelector(".card") || document.body;
  el = document.createElement("div");
  el.id = id;
  el.style.marginTop = "12px";
  el.style.fontSize = "14px";
  el.className = "hidden";
  card.appendChild(el);
  return el;
}

function showMessage(container, text, type = "error") {
  if (!container) return;
  container.textContent = text;
  container.classList.remove("hidden", "success", "error", "info");
  container.classList.add(type);
  if (type === "error") container.style.color = "#ffb4b4";
  else if (type === "success") container.style.color = "#bafdbe";
  else container.style.color = "";
}

function clearMessage(container) {
  if (!container) return;
  container.textContent = "";
  container.classList.add("hidden");
  container.style.color = "";
}

function setLoading(button, loading, text = "Loading...") {
  if (!button) return;
  if (loading) {
    if (!button.dataset.origText) button.dataset.origText = button.textContent || "";
    button.disabled = true;
    button.textContent = button.dataset.loadingText || text;
    button.classList.add("loading");
  } else {
    if (button.dataset.origText !== undefined) button.textContent = button.dataset.origText;
    button.disabled = false;
    button.classList.remove("loading");
  }
}

/* ===========================
   AUTH (enhanced & safe)
   Exposes: window.registerUser, window.loginUser, window.logoutUser, window.forgotPassword
=========================== */

window.registerUser = async function () {
  const msg = createOrGetMessageContainer("register");
  clearMessage(msg);

  const usernameEl = $id("regUsername", "registerUsername", "username");
  const emailEl = $id("regEmail", "registerEmail", "email");
  const passwordEl = $id("regPassword", "registerPassword", "password");
  const confirmEl = $id("regConfirmPassword", "registerConfirmPassword", "confirmPassword");

  if (!emailEl || !passwordEl) {
    showMessage(msg, "Registration fields not found on page.", "error");
    console.error("Missing registration inputs (email/password).");
    return;
  }

  const username = getInputValue(usernameEl);
  const email = getInputValue(emailEl);
  const password = passwordEl.value || "";
  const confirm = confirmEl ? (confirmEl.value || "") : "";

  if (!email) {
    showMessage(msg, "Please enter an email.", "error");
    return;
  }
  if (!password) {
    showMessage(msg, "Please enter a password.", "error");
    return;
  }
  if (confirmEl && password !== confirm) {
    showMessage(msg, "Passwords do not match.", "error");
    return;
  }

  const registerBtn = $id("register-btn") || document.querySelector('button[onclick="registerUser()"]');

  try {
    setLoading(registerBtn, true, "Creating account...");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    const adminMeta = doc(db, "meta", "admin");
    const metaSnap = await getDoc(adminMeta);

    let role = "user";
    if (!metaSnap.exists()) {
      role = "admin";
      await setDoc(adminMeta, { created: true });
    }

    await setDoc(doc(db, "users", user.uid), {
      username: username || email.split("@")[0],
      email,
      role,
      createdAt: serverTimestamp()
    });

    showMessage(msg, "Account created. Redirecting to login...", "success");
    setTimeout(() => {
      location.href = "login.html";
    }, 700);
  } catch (err) {
    console.error("Register error:", err);
    const message = (err && err.message) ? err.message : "Registration failed.";
    showMessage(msg, message, "error");
  } finally {
    setLoading(registerBtn, false);
  }
};

window.loginUser = async function (ev) {
  if (ev && ev.preventDefault) ev.preventDefault();

  const msg = createOrGetMessageContainer("login");
  clearMessage(msg);

  const emailEl = $id("loginEmail", "email", "loginEmailInput");
  const passEl = $id("loginPassword", "password", "loginPasswordInput");
  const loginBtn = document.querySelector('button[onclick="loginUser()"]') ||
                   document.getElementById('login-btn') ||
                   document.querySelector('.card button') ||
                   document.querySelector('button');

  if (!emailEl || !passEl) {
    showMessage(msg, "Login fields not found on page.", "error");
    console.error("Missing login inputs.");
    return;
  }

  const email = getInputValue(emailEl);
  const password = passEl.value || "";

  if (!email) {
    showMessage(msg, "Please enter your email.", "error");
    return;
  }
  if (!password) {
    showMessage(msg, "Please enter your password.", "error");
    return;
  }

  try {
    setLoading(loginBtn, true, "Logging in...");
    const cred = await signInWithEmailAndPassword(auth, email, password);

    const snap = await getDoc(doc(db, "users", cred.user.uid));
    const userData = snap.exists() ? snap.data() : null;

    if (userData && userData.role === "admin") {
      location.href = "admin.html";
    } else {
      location.href = "user-chat.html";
    }
  } catch (err) {
    console.error("Login error:", err);
    const message = (err && err.message) ? err.message : "Login failed. Check credentials.";
    showMessage(msg, message, "error");
  } finally {
    setLoading(loginBtn, false);
  }
};

window.logoutUser = async function () {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Sign out error:", err);
  } finally {
    location.href = "login.html";
  }
};

window.forgotPassword = async function (ev) {
  if (ev && ev.preventDefault) ev.preventDefault();

  const emailEl = $id("loginEmail", "regEmail", "email");
  let email = emailEl ? getInputValue(emailEl) : "";

  if (!email) {
    email = prompt("Enter your email to receive a password reset link:");
    if (!email) return;
  }

  try {
    await sendPasswordResetEmail(auth, email.trim());
    alert("Password reset email sent (if that account exists).");
  } catch (err) {
    console.error("Password reset error:", err);
    alert("Failed to send reset email. Check console for details.");
  }
};

/* ===========================
   AUTH GUARD
=========================== */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;

    if (
      location.pathname.includes("admin") &&
      snap.data().role !== "admin"
    ) {
      alert("Unauthorized");
      location.href = "login.html";
    }
  } catch (err) {
    console.error("Auth guard error:", err);
  }
});

/* ===========================
   ADMIN CHAT LOGIC (improved)
=========================== */

let activeUserId = null;

/* DOM (safe guards) */
const usersList = document.getElementById("usersList");
const chatTitle = document.getElementById("adminChatTitle");
const messagesBox = document.getElementById("adminMessages");
const msgInput = document.getElementById("adminMessageInput");
const fileInput = document.getElementById("adminFileInput");
const fileBtn = document.getElementById("adminFileBtn");
const sendBtn = document.getElementById("adminSendBtn");

let unsubscribeMessages = null;

/* LOAD USERS */
async function loadUsers() {
  if (!usersList) return;

  try {
    const snap = await getDocs(collection(db, "users"));
    usersList.innerHTML = "";

    snap.forEach(d => {
      const u = d.data();
      if (u.role === "admin") return;

      const li = document.createElement("li");
      li.textContent = u.username || u.email || "Unknown";
      li.style.cursor = "pointer";
      li.onclick = () => openChat(d.id, u.username || u.email || "User");
      usersList.appendChild(li);
    });
  } catch (err) {
    console.error("loadUsers error:", err);
  }
}

/* OPEN CHAT */
function openChat(uid, username) {
  activeUserId = uid;
  if (chatTitle) chatTitle.textContent = username;
  if (msgInput) msgInput.disabled = false;
  if (fileBtn) fileBtn.disabled = false;
  if (sendBtn) sendBtn.disabled = false;

  if (messagesBox) messagesBox.innerHTML = "";

  if (typeof unsubscribeMessages === "function") {
    try { unsubscribeMessages(); } catch (e) { /* ignore */ }
    unsubscribeMessages = null;
  }

  const q = query(
    collection(db, "messages"),
    orderBy("createdAt")
  );

  unsubscribeMessages = onSnapshot(q, snap => {
    if (!messagesBox) return;
    messagesBox.innerHTML = "";

    snap.forEach(d => {
      const m = d.data();
      if (!auth.currentUser) return;
      const me = auth.currentUser.uid;
      if (
        (m.senderId === me && m.receiverId === uid) ||
        (m.senderId === uid && m.receiverId === me)
      ) {
        renderMessage(m);
      }
    });
  }, err => {
    console.error("messages onSnapshot error:", err);
  });
}

/* SEND TEXT */
sendBtn?.addEventListener("click", async () => {
  const text = msgInput?.value?.trim();
  if (!text || !activeUserId || !auth.currentUser) return;

  try {
    await addDoc(collection(db, "messages"), {
      senderId: auth.currentUser.uid,
      receiverId: activeUserId,
      senderRole: "admin",
      text,
      imageUrl: null,
      createdAt: serverTimestamp()
    });

    if (msgInput) msgInput.value = "";
  } catch (err) {
    console.error("send message error:", err);
    alert("Failed to send message. Check console.");
  }
});

/* SEND IMAGE */
fileBtn?.addEventListener("click", () => fileInput?.click());

fileInput?.addEventListener("change", async () => {
  const file = fileInput?.files?.[0];
  if (!file || !activeUserId || !auth.currentUser) return;

  try {
    const path = `chat/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    await addDoc(collection(db, "messages"), {
      senderId: auth.currentUser.uid,
      receiverId: activeUserId,
      senderRole: "admin",
      text: null,
      imageUrl: url,
      createdAt: serverTimestamp()
    });

    if (fileInput) fileInput.value = "";
  } catch (err) {
    console.error("send image error:", err);
    alert("Failed to send image. Check console.");
  }
});

/* RENDER MESSAGE */
function renderMessage(m) {
  const div = document.createElement("div");
  div.className = "msg " + (m.senderRole === "admin" ? "admin" : "user");

  if (m.text) {
    const p = document.createElement("p");
    p.textContent = m.text;
    div.appendChild(p);
  }
  if (m.imageUrl) {
    const img = document.createElement("img");
    img.src = m.imageUrl;
    img.style.maxWidth = "240px";
    img.style.display = "block";
    img.style.marginTop = "6px";
    div.appendChild(img);
  }

  if (messagesBox) {
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }
}

/* INIT */
loadUsers();
