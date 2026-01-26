// ============================
// app.js (Firebase v10.12.2)
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
  updateDoc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ===========================
   HELPERS
=========================== */
const $ = id => document.getElementById(id);
const page = location.pathname;

function val(id) {
  const el = $(id);
  return el ? el.value.trim() : "";
}

function msg(el, text, type = "error") {
  if (!el) return;
  el.textContent = text;
  el.className = type;
  el.classList.remove("hidden");
}

/* ===========================
   AUTH — REGISTER
=========================== */
window.registerUser = async () => {
  const email = val("regEmail");
  const pass = val("regPassword");
  const confirm = val("regConfirmPassword");
  const username = val("regUsername");
  const box = $("register-message");

  if (!email || !pass) return msg(box, "All fields required");
  if (pass !== confirm) return msg(box, "Passwords do not match");

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);

    // first user becomes admin
    const metaRef = doc(db, "meta", "admin");
    const metaSnap = await getDoc(metaRef);

    let role = "user";
    if (!metaSnap.exists()) {
      role = "admin";
      await setDoc(metaRef, { created: true });
    }

    await setDoc(doc(db, "users", cred.user.uid), {
      username,
      email,
      role,
      online: false,
      createdAt: serverTimestamp()
    });

    msg(box, "Account created. Redirecting...", "success");
    setTimeout(() => location.href = "login.html", 800);
  } catch (e) {
    msg(box, e.message);
  }
};

/* ===========================
   AUTH — LOGIN
=========================== */
window.loginUser = async () => {
  const email = val("loginEmail");
  const pass = val("loginPassword");
  const box = $("login-message");

  if (!email || !pass) return msg(box, "Enter email & password");

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);

    await updateDoc(doc(db, "users", cred.user.uid), {
      online: true
    });

    const snap = await getDoc(doc(db, "users", cred.user.uid));
    const role = snap.data()?.role;

    location.href = role === "admin"
      ? "admin-chat.html"
      : "user-chat.html";

  } catch (e) {
    msg(box, "Login failed");
  }
};

/* ===========================
   LOGOUT
=========================== */
window.logoutUser = async () => {
  if (auth.currentUser) {
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      online: false
    });
  }
  await signOut(auth);
  location.href = "login.html";
};

/* ===========================
   FORGOT PASSWORD
=========================== */
window.forgotPassword = async () => {
  const email = val("loginEmail") || prompt("Enter email");
  if (!email) return;
  await sendPasswordResetEmail(auth, email);
  alert("Reset email sent");
};

/* ===========================
   AUTH GUARD + ONLINE STATUS
=========================== */
onAuthStateChanged(auth, async user => {
  if (!user) return;

  await updateDoc(doc(db, "users", user.uid), {
    online: true
  });

  window.addEventListener("beforeunload", async () => {
    await updateDoc(doc(db, "users", user.uid), {
      online: false
    });
  });
});

/* ===========================
   ADMIN CHAT LOGIC
=========================== */
let activeUserId = null;
let unsubscribeChat = null;

async function loadUsers() {
  const list = $("usersList");
  if (!list) return;

  onSnapshot(collection(db, "users"), snap => {
    list.innerHTML = "";

    snap.forEach(docSnap => {
      const u = docSnap.data();
      if (u.role === "admin") return;

      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${u.username}</strong>
        <span style="float:right;color:${u.online ? "#22c55e" : "#ef4444"}">
          ${u.online ? "●" : "○"}
        </span>
        <div style="font-size:12px;color:#94a3b8">
          ${u.unreadAdmin || 0} unread
        </div>
      `;

      li.onclick = () => openChat(docSnap.id, u.username);
      list.appendChild(li);
    });
  });
}

window.openChat = async (uid, name) => {
  activeUserId = uid;
  $("adminChatTitle").textContent = name;

  $("adminMessageInput").disabled = false;
  $("adminSendBtn").disabled = false;
  $("adminFileBtn").disabled = false;

  // clear unread
  await updateDoc(doc(db, "users", uid), {
    unreadAdmin: 0
  });

  if (unsubscribeChat) unsubscribeChat();

  const q = query(
    collection(db, "messages"),
    where("chatId", "==", uid),
    orderBy("createdAt", "asc"),
    limit(50)
  );

  unsubscribeChat = onSnapshot(q, snap => {
    const box = $("adminMessages");
    box.innerHTML = "";

    snap.forEach(d => {
      const m = d.data();
      const div = document.createElement("div");
      div.className = "msg " + (m.sender === "admin" ? "admin" : "user");
      div.textContent = m.text || "";
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    });
  });
};

$("adminSendBtn")?.addEventListener("click", async () => {
  const text = val("adminMessageInput");
  if (!text || !activeUserId) return;

  await addDoc(collection(db, "messages"), {
    chatId: activeUserId,
    sender: "admin",
    text,
    createdAt: serverTimestamp()
  });

  $("adminMessageInput").value = "";
});

/* ===========================
   INIT
=========================== */
if (page.includes("admin-chat")) {
  loadUsers();
}
