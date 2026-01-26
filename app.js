// ============================
// app.js - Full Admin + User Auth + Chat
// Compatible with Firebase v10.12.2
// ============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ============================
// Firebase Config
// ============================
const firebaseConfig = {
  apiKey: "AIzaSyBhClpR0zHg4XYyTsDupLkmDIp_EkIzHEE",
  authDomain: "bitforex-academy-3a8f4.firebaseapp.com",
  projectId: "bitforex-academy-3a8f4",
  storageBucket: "bitforex-academy-3a8f4.appspot.com",
  messagingSenderId: "659879098852",
  appId: "1:659879098852:web:16545b1980e2ed284a6ff1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ============================
// Helper Functions
// ============================
function $id(id) { return document.getElementById(id); }
function getInputValue(el) { return el?.value?.trim() || ""; }
function showMessage(container, text, type = "error") {
  if (!container) return;
  container.textContent = text;
  container.classList.remove("hidden", "error", "success");
  container.classList.add(type);
  container.style.color = type === "error" ? "#ffb4b4" : "#bafdbe";
}
function clearMessage(container) {
  if (!container) return;
  container.textContent = "";
  container.classList.add("hidden");
}
function setLoading(btn, loading, text = "Loading...") {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = text;
    btn.classList.add("loading");
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.origText || btn.textContent;
    btn.classList.remove("loading");
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

  if (!email) return showMessage(msg, "Email required");
  if (!password) return showMessage(msg, "Password required");
  if (password !== confirm) return showMessage(msg, "Passwords do not match");

  try {
    setLoading(btn, true, "Creating account...");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Determine if admin
    const adminMeta = doc(db, "meta", "admin");
    const metaSnap = await getDoc(adminMeta);
    let role = "user";
    if (!metaSnap.exists()) {
      role = "admin";
      await setDoc(adminMeta, { created: true, admins: [user.uid] });
    }

    // Create user document
    await setDoc(doc(db, "users", user.uid), {
      username: username || email.split("@")[0],
      email,
      role,
      online: true,
      createdAt: serverTimestamp()
    });

    showMessage(msg, "Account created. Redirecting to login...", "success");
    setTimeout(() => location.href = "login.html", 1000);
  } catch (err) {
    console.error(err);
    showMessage(msg, err.code === "auth/email-already-in-use" ? "Email already in use" : err.message, "error");
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
    if (!snap.exists()) return showMessage(msg, "User data not found", "error");

    // Update online status
    await updateDoc(doc(db, "users", cred.user.uid), { online: true });

    const role = snap.data().role;
    if (role === "admin") location.href = "admin-dashboard.html";
    else location.href = "user-chat.html";
  } catch (err) {
    console.error(err);
    showMessage(msg, "Login failed: " + err.message, "error");
  } finally {
    setLoading(btn, false);
  }
};

// ============================
// Logout
// ============================
window.logoutUser = async function () {
  const user = auth.currentUser;
  if (user) await updateDoc(doc(db, "users", user.uid), { online: false });
  await signOut(auth);
  location.href = "login.html";
};

// ============================
// Forgot Password
// ============================
window.forgotPassword = async function () {
  let email = getInputValue($id("loginEmail")) || prompt("Enter your email:");
  if (!email) return;
  try { await sendPasswordResetEmail(auth, email); alert("Password reset email sent"); }
  catch (err) { console.error(err); alert("Failed to send reset email"); }
};

// ============================
// Admin Auth Guard
// ============================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return;
  const role = snap.data().role;
  if (location.pathname.includes("admin") && role !== "admin") location.href = "user-chat.html";
});

// ============================
// Toggle Password Visibility
// ============================
window.togglePassword = function(inputId, btnId){
  const input = $id(inputId);
  if (!input) return;
  if(input.type === "password") input.type = "text";
  else input.type = "password";
};

// ============================
// ADMIN CHAT EXAMPLE (simplified)
// ============================
let activeUserId = null;
let unsubscribeMessages = null;
const messagesBox = $id("adminMessages");
const msgInput = $id("adminMessageInput");
const sendBtn = $id("adminSendBtn");

window.openChat = function(uid, username){
  activeUserId = uid;
  $id("adminChatTitle").textContent = username;
  messagesBox.innerHTML = "";

  if(typeof unsubscribeMessages === "function") unsubscribeMessages();

  const q = query(collection(db, "messages"), orderBy("createdAt"));
  unsubscribeMessages = onSnapshot(q, snap => {
    messagesBox.innerHTML = "";
    snap.forEach(d=>{
      const m = d.data();
      const me = auth.currentUser?.uid;
      if((m.senderId===me && m.receiverId===uid)||(m.senderId===uid && m.receiverId===me)){
        const div = document.createElement("div");
        div.textContent = m.text || "";
        if(m.senderId === me) div.className = "msg admin";
        else div.className = "msg user";
        messagesBox.appendChild(div);
      }
    });
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });
};

sendBtn?.addEventListener("click", async ()=>{
  const text = getInputValue(msgInput);
  if(!text || !activeUserId || !auth.currentUser) return;
  await addDoc(collection(db,"messages"),{
    senderId: auth.currentUser.uid,
    receiverId: activeUserId,
    text,
    createdAt: serverTimestamp()
  });
  msgInput.value = "";
});
