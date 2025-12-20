/* ===========================
   IMPORTS
=========================== */
import {
  auth,
  db
} from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ===========================
   REGISTER USER
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
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // create Firestore user record
    await setDoc(doc(db, "users", user.uid), {
      username: username,
      email: email,
      role: "user",              // default
      subscribed: false,
      createdAt: serverTimestamp()
    });

    // show popup
    document.getElementById("popupUsername").innerText = username;
    document.getElementById("popupEmail").innerText = email;
    document.getElementById("regPopup").style.display = "flex";

  } catch (err) {
    alert(err.message);
  }
};

/* ===========================
   LOGIN USER / ADMIN
=========================== */
window.loginUser = async function () {
  console.log("LOGIN STARTED");

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  console.log("EMAIL:", email);

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log("AUTH OK:", cred.user.uid);

    const ref = doc(db, "users", cred.user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("User record NOT found in Firestore");
      console.log("NO FIRESTORE DOC");
      return;
    }

    const data = snap.data();
    console.log("USER DATA:", data);

    if (data.role === "Admin" || data.role === "admin") {
      alert("ADMIN LOGIN");
      location.href = "admin-dashboard.html";
    } else {
      alert("USER LOGIN");
      location.href = "user-chat.html";
    }

  } catch (err) {
    console.error(err);
    alert("LOGIN ERROR: " + err.message);
  }
};

/* ===========================
   LOGOUT (ADMIN & USER)
=========================== */
window.logoutUser = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};

/* ===========================
   AUTH GUARD (OPTIONAL)
   Protect admin pages
=========================== */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return;

  const role = snap.data().role;

  // prevent user from entering admin pages
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