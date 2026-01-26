// ============================
// app.js – Bitforex Academy
// Firebase v10.12.2
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
  addDoc,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================
   HELPERS
========================= */
const $ = id => document.getElementById(id);

function msg(el, text, type = "error") {
  if (!el) return;
  el.textContent = text;
  el.className = type;
  el.style.display = "block";
}

/* =========================
   REGISTER
========================= */
window.registerUser = async () => {
  const email = $("regEmail")?.value.trim();
  const pass = $("regPassword")?.value.trim();
  const confirm = $("regConfirmPassword")?.value.trim();
  const username = $("regUsername")?.value.trim();
  const box = $("register-message");

  if (!email || !pass) return msg(box, "Missing fields");
  if (pass !== confirm) return msg(box, "Passwords do not match");

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);

    await setDoc(doc(db, "users", cred.user.uid), {
      username: username || email.split("@")[0],
      email,
      role: "user",
      courses: [],
      subscription: null,
      online: true,
      createdAt: serverTimestamp()
    });

    msg(box, "Account created. Redirecting…", "success");
    setTimeout(() => location.href = "login.html", 800);

  } catch (e) {
    msg(box, e.message);
  }
};

/* =========================
   LOGIN
========================= */
window.loginUser = async () => {
  const email = $("loginEmail")?.value.trim();
  const pass = $("loginPassword")?.value.trim();
  const box = $("login-message");

  if (!email || !pass) return msg(box, "Missing fields");

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const snap = await getDoc(doc(db, "users", cred.user.uid));

    if (!snap.exists()) throw "User record missing";

    const role = snap.data().role;

    await updateDoc(doc(db, "users", cred.user.uid), { online: true });

    if (role === "admin") location.href = "admin-dashboard.html";
    else location.href = "user-dashboard.html";

  } catch (e) {
    msg(box, "Login failed");
  }
};

/* =========================
   LOGOUT
========================= */
window.logoutUser = async () => {
  if (auth.currentUser) {
    await updateDoc(doc(db, "users", auth.currentUser.uid), { online: false });
    await signOut(auth);
  }
  location.href = "login.html";
};

/* =========================
   PASSWORD RESET
========================= */
window.forgotPassword = async () => {
  const email = $("loginEmail")?.value.trim() || prompt("Enter email");
  if (!email) return;
  await sendPasswordResetEmail(auth, email);
  alert("Reset email sent");
};

/* =========================
   AUTH GUARD
========================= */
onAuthStateChanged(auth, async user => {
  if (!user) return;
  await updateDoc(doc(db, "users", user.uid), { online: true });
});

/* =========================
   ADMIN – COURSES
========================= */
window.addCourse = async () => {
  const title = $("courseTitle")?.value.trim();
  const desc = $("courseDesc")?.value.trim();
  const price = $("coursePrice")?.value.trim();

  if (!title) return alert("Missing title");

  await addDoc(collection(db, "courses"), {
    title,
    description: desc,
    price,
    createdAt: serverTimestamp()
  });

  alert("Course added");
};

/* =========================
   ADMIN – ASSIGN COURSE
========================= */
window.assignCourseToUser = async (userId, courseId) => {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return alert("User not found");

  const courses = snap.data().courses || [];
  if (!courses.includes(courseId)) {
    courses.push(courseId);
    await updateDoc(ref, { courses });
  }

  alert("Course assigned");
};

/* =========================
   ADMIN – SUBSCRIPTION
========================= */
window.assignSubscription = async (userId, plan) => {
  const ref = doc(db, "users", userId);
  const expires = new Date();

  if (plan === "monthly") expires.setMonth(expires.getMonth() + 1);
  if (plan === "yearly") expires.setFullYear(expires.getFullYear() + 1);

  await updateDoc(ref, {
    subscription: {
      plan,
      status: "active",
      expiresAt: expires
    }
  });

  alert("Subscription activated");
};

/* =========================
   ADMIN – LOAD USERS
========================= */
window.loadUsers = async () => {
  const list = $("usersList");
  if (!list) return;

  list.innerHTML = "";
  const snap = await getDocs(collection(db, "users"));

  snap.forEach(d => {
    const u = d.data();
    const li = document.createElement("li");
    li.textContent = `${u.username} ${u.online ? "🟢" : "⚪"}`;
    list.appendChild(li);
  });
};
