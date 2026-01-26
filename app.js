// app.js
import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc, setDoc, getDoc, getDocs,
  collection, addDoc, updateDoc,
  query, where, orderBy,
  serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ===========================
   AUTH
=========================== */

// REGISTER
window.registerUser = async () => {
  const email = regEmail.value.trim();
  const pass = regPassword.value;
  const confirm = regConfirmPassword.value;
  const username = regUsername.value.trim();

  if (!email || !pass) return alert("Fill all fields");
  if (pass !== confirm) return alert("Passwords mismatch");

  const cred = await createUserWithEmailAndPassword(auth, email, pass);

  await setDoc(doc(db, "users", cred.user.uid), {
    email,
    username,
    role: "user",
    online: true,
    createdAt: serverTimestamp()
  });

  location.href = "login.html";
};

// LOGIN
window.loginUser = async () => {
  const email = loginEmail.value.trim();
  const pass = loginPassword.value;

  const cred = await signInWithEmailAndPassword(auth, email, pass);
  const snap = await getDoc(doc(db, "users", cred.user.uid));

  if (!snap.exists()) return alert("Profile missing");

  const role = snap.data().role;
  location.href = role === "admin"
    ? "admin-dashboard.html"
    : "user-chat.html";
};

// LOGOUT
window.logoutUser = async () => {
  await updateDoc(doc(db, "users", auth.currentUser.uid), { online: false });
  await signOut(auth);
  location.href = "login.html";
};

// ONLINE STATUS
onAuthStateChanged(auth, user => {
  if (user) {
    updateDoc(doc(db, "users", user.uid), { online: true });
  }
});

/* ===========================
   ADMIN USERS LIST
=========================== */
async function loadUsers() {
  const box = document.getElementById("usersList");
  if (!box) return;

  const snap = await getDocs(
    query(collection(db, "users"), where("role", "==", "user"))
  );

  box.innerHTML = "";
  snap.forEach(d => {
    const u = d.data();
    const li = document.createElement("li");
    li.textContent = `${u.username} ${u.online ? "🟢" : "⚫"}`;
    li.onclick = () => openChat(d.id);
    box.appendChild(li);
  });
}
loadUsers();

/* ===========================
   CHAT (ADMIN + USER)
=========================== */

let activeChatId = null;

// CREATE OR OPEN CHAT
async function openChat(userId) {
  const adminId = auth.currentUser.uid;
  const q = query(
    collection(db, "chats"),
    where("members", "array-contains", adminId)
  );

  const snap = await getDocs(q);
  let chatDoc = snap.docs.find(d => d.data().members.includes(userId));

  if (!chatDoc) {
    chatDoc = await addDoc(collection(db, "chats"), {
      members: [adminId, userId],
      updatedAt: serverTimestamp()
    });
    activeChatId = chatDoc.id;
  } else activeChatId = chatDoc.id;

  loadMessages();
}

// LOAD MESSAGES
function loadMessages() {
  const box = document.getElementById("adminMessages") ||
              document.getElementById("userMessages");
  if (!box) return;

  const q = query(
    collection(db, "messages"),
    where("chatId", "==", activeChatId),
    orderBy("createdAt")
  );

  onSnapshot(q, snap => {
    box.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      const div = document.createElement("div");
      div.className = m.senderId === auth.currentUser.uid ? "msg admin" : "msg user";
      div.textContent = m.text || "";
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}

// SEND MESSAGE
async function sendMessage(inputId) {
  const input = document.getElementById(inputId);
  if (!input.value || !activeChatId) return;

  await addDoc(collection(db, "messages"), {
    chatId: activeChatId,
    senderId: auth.currentUser.uid,
    text: input.value,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, "chats", activeChatId), {
    lastMessage: input.value,
    updatedAt: serverTimestamp()
  });

  input.value = "";
}

window.sendAdminMessage = () => sendMessage("adminMessageInput");
window.sendUserMessage = () => sendMessage("userMessageInput");

/* ===========================
   COURSES (ADMIN ONLY)
=========================== */
window.addCourse = async (title, price) => {
  await addDoc(collection(db, "courses"), {
    title, price,
    createdAt: serverTimestamp()
  });
};

/* ===========================
   SUBSCRIPTIONS (ADMIN ONLY)
=========================== */
window.addSubscription = async (name, amount) => {
  await addDoc(collection(db, "subscriptions"), {
    name, amount,
    createdAt: serverTimestamp()
  });
};
