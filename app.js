/* ===========================
   IMPORTS
=========================== */
import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ===========================
   REGISTER USER (AUTO ADMIN)
=========================== */
window.registerUser = async function () {
  const username = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;

  if (!username || !email || !password) {
    alert("All fields are required");
    return;
  }

  try {
    // create auth user
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // 🔍 check if admin already exists
    const adminMetaRef = doc(db, "meta", "admin");
    const adminMetaSnap = await getDoc(adminMetaRef);

    let role = "user";

    // first registered user becomes admin
    if (!adminMetaSnap.exists()) {
      role = "admin";

      await setDoc(adminMetaRef, {
        created: true,
        createdAt: serverTimestamp()
      });
    }

    // create user record
    await setDoc(doc(db, "users", user.uid), {
      username: username,
      email: email,
      role: role,          // admin or user
      active: false,
      createdAt: serverTimestamp()
    });

    // show popup if exists
    if (document.getElementById("regPopup")) {
      document.getElementById("popupUsername").innerText = username;
      document.getElementById("popupEmail").innerText = email;
      document.getElementById("regPopup").style.display = "flex";
    } else {
      alert("Registration successful. Please login.");
      window.location.href = "login.html";
    }

  } catch (err) {
    alert(err.message);
  }
};

/* ===========================
   LOGIN USER / ADMIN
=========================== */
window.loginUser = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    alert("Email and password required");
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("User record not found. Please register again.");
      await signOut(auth);
      return;
    }

    const data = userSnap.data();

    if (data.role === "admin") {
      window.location.href = "admin-dashboard.html";
    } else {
      window.location.href = "user-chat.html";
    }

  } catch (err) {
    alert(err.message);
  }
};

/* ===========================
   LOGOUT
=========================== */
window.logoutUser = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};

/* ===========================
   AUTH GUARD (ADMIN PAGES)
=========================== */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return;

  const role = snap.data().role;

  if (
    window.location.pathname.includes("admin") &&
    role !== "admin"
  ) {
    alert("Unauthorized access");
    window.location.href = "login.html";
  }
});

/* ===========================
   REG POPUP REDIRECT
=========================== */
window.goLogin = function () {
  window.location.href = "login.html";
};
