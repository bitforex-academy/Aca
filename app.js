// ============================
// app.js - Full Admin + Auth
// Works with your Firebase
// ============================

import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ============================
// Helper Functions
// ============================
function $id(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function getInputValue(el) {
  return (el && el.value) ? el.value.trim() : "";
}

function showMessage(container, text, type = "error") {
  if (!container) return;
  container.textContent = text;
  container.classList.remove("hidden", "error", "success", "info");
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

// ============================
// Registration
// ============================
window.registerUser = async function () {
  const msg = $id("register-message");
  clearMessage(msg);

  const username = getInputValue($id("regUsername"));
  const email = getInputValue($id("regEmail"));
  const password = getInputValue($id("regPassword"));
  const confirm = getInputValue($id("regConfirmPassword"));
  const btn = $id("register-btn");

  if (!email) return showMessage(msg, "Please enter email.");
  if (!password) return showMessage(msg, "Please enter password.");
  if (password !== confirm) return showMessage(msg, "Passwords do not match.");

  try {
    setLoading(btn, true, "Creating account...");
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
    setTimeout(() => location.href = "login.html", 700);
  } catch (err) {
    console.error(err);
    showMessage(msg, err.message || "Registration failed.", "error");
  } finally {
    setLoading(btn, false);
  }
};

// ============================
// Login
// ============================
window.loginUser = async function () {
  const msg = $id("login-message");
  clearMessage(msg);

  const email = getInputValue($id("loginEmail"));
  const password = getInputValue($id("loginPassword"));
  const btn = $id("login-btn");

  if (!email) return showMessage(msg, "Enter email");
  if (!password) return showMessage(msg, "Enter password");

  try {
    setLoading(btn, true, "Logging in...");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    const userData = snap.exists() ? snap.data() : null;

    if (userData?.role === "admin") location.href = "admin-dashboard.html";
    else location.href = "user-chat.html";
  } catch (err) {
    console.error(err);
    showMessage(msg, "Login failed: " + (err.message || ""), "error");
  } finally {
    setLoading(btn, false);
  }
};

// ============================
// Logout
// ============================
window.logoutUser = async function () {
  try { await signOut(auth); } catch (err) { console.error(err); }
  location.href = "login.html";
};

// ============================
// Forgot Password
// ============================
window.forgotPassword = async function () {
  let email = getInputValue($id("loginEmail"));
  if (!email) email = prompt("Enter your email for reset:");
  if (!email) return;

  try {
    await sendPasswordResetEmail(auth, email.trim());
    alert("Password reset email sent (if account exists).");
  } catch (err) {
    console.error(err);
    alert("Failed to send reset email.");
  }
};

// ============================
// Auth Guard for admin pages
// ============================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;

    // Redirect non-admin from admin pages
    if (location.pathname.includes("admin") && snap.data().role !== "admin") {
      alert("Unauthorized");
      location.href = "login.html";
    }
  } catch (err) {
    console.error(err);
  }
});

// ============================
// ADMIN PAGES LOGIC
// ============================

// 1. Admin Users Page
async function loadUsers() {
  const usersList = $id("usersList");
  if (!usersList) return;

  try {
    const snap = await getDocs(collection(db, "users"));
    usersList.innerHTML = "";
    snap.forEach(d => {
      const u = d.data();
      if (u.role === "admin") return;
      const li = document.createElement("li");
      li.textContent = u.username || u.email;
      li.style.cursor = "pointer";
      li.onclick = () => openChat(d.id, u.username || u.email);
      usersList.appendChild(li);
    });
  } catch (err) { console.error(err); }
}
loadUsers();

// 2. Admin Payments Page
async function loadPayments() {
  const paymentsList = $id("paymentsList");
  if (!paymentsList) return;

  try {
    const snap = await getDocs(collection(db, "payments"));
    paymentsList.innerHTML = "";
    snap.forEach(d => {
      const p = d.data();
      const div = document.createElement("div");
      div.className = "payment-card";
      div.innerHTML = `
        <b>User:</b> ${p.username}<br>
        <b>Amount:</b> ${p.amount}<br>
        <b>Status:</b> ${p.status || "pending"}
        <div class="actions">
          <button class="approve">Approve</button>
          <button class="reject">Reject</button>
        </div>`;
      const [approveBtn, rejectBtn] = div.querySelectorAll("button");
      approveBtn.onclick = async () => {
        await updateDoc(doc(db, "payments", d.id), { status: "approved" });
        loadPayments();
      };
      rejectBtn.onclick = async () => {
        await updateDoc(doc(db, "payments", d.id), { status: "rejected" });
        loadPayments();
      };
      paymentsList.appendChild(div);
    });
  } catch (err) { console.error(err); }
}
loadPayments();

// 3. Admin Settings Page
window.updateAdminEmail = async function () {
  const newEmail = getInputValue($id("newEmail"));
  if (!newEmail) return alert("Enter new email");
  try {
    if (auth.currentUser) await updateEmail(auth.currentUser, newEmail);
    alert("Email updated");
  } catch (err) { console.error(err); alert("Failed to update email"); }
};

window.updateAdminPassword = async function () {
  const newPassword = getInputValue($id("newPassword"));
  if (!newPassword) return alert("Enter new password");
  try {
    if (auth.currentUser) await updatePassword(auth.currentUser, newPassword);
    alert("Password updated");
  } catch (err) { console.error(err); alert("Failed to update password"); }
};

// 4. Admin Chat
let activeUserId = null;
let unsubscribeMessages = null;
const messagesBox = $id("adminMessages");
const msgInput = $id("adminMessageInput");
const sendBtn = $id("adminSendBtn");
const fileInput = $id("adminFileInput");

window.openChat = function(uid, username) {
  activeUserId = uid;
  $id("adminChatTitle").textContent = username;
  if (messagesBox) messagesBox.innerHTML = "";

  if (typeof unsubscribeMessages === "function") unsubscribeMessages();

  const q = query(collection(db, "messages"), orderBy("createdAt"));
  unsubscribeMessages = onSnapshot(q, snap => {
    if (!messagesBox) return;
    messagesBox.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      const me = auth.currentUser?.uid;
      if (!me) return;
      if ((m.senderId === me && m.receiverId === uid) || (m.senderId === uid && m.receiverId === me)) {
        const div = document.createElement("div");
        div.textContent = m.text || "";
        if (m.imageUrl) {
          const img = document.createElement("img");
          img.src = m.imageUrl;
          img.style.maxWidth = "200px";
          div.appendChild(img);
        }
        messagesBox.appendChild(div);
        messagesBox.scrollTop = messagesBox.scrollHeight;
      }
    });
  });
};

sendBtn?.addEventListener("click", async () => {
  const text = getInputValue(msgInput);
  if (!text || !activeUserId || !auth.currentUser) return;

  await addDoc(collection(db, "messages"), {
    senderId: auth.currentUser.uid,
    receiverId: activeUserId,
    text,
    imageUrl: null,
    createdAt: serverTimestamp()
  });

  if (msgInput) msgInput.value = "";
});

fileInput?.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file || !activeUserId || !auth.currentUser) return;

  const storageRef = ref(storage, `chat/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  await addDoc(collection(db, "messages"), {
    senderId: auth.currentUser.uid,
    receiverId: activeUserId,
    text: null,
    imageUrl: url,
    createdAt: serverTimestamp()
  });

  fileInput.value = "";
});
