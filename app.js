// app.js (Firebase v10.12.2 compatible, GitHub Pages safe)

import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ---------------- UTIL ---------------- */

function showMessage(id, text, type = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = "message " + type;
  el.classList.remove("hidden");
}

/* ---------------- LOGIN ---------------- */

window.loginUser = async function (e) {
  e?.preventDefault();

  const email = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;

  if (!email || !password) {
    showMessage("login-message", "Email and password are required");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage("login-message", "Login successful", "success");

    setTimeout(() => {
      window.location.href = "admin-dashboard.html";
    }, 800);

  } catch (err) {
    showMessage("login-message", err.message);
  }
};

/* ---------------- REGISTER ---------------- */

window.registerUser = async function (e) {
  e?.preventDefault();

  const username = document.getElementById("regUsername")?.value.trim();
  const email = document.getElementById("regEmail")?.value.trim();
  const password = document.getElementById("regPassword")?.value;
  const confirm = document.getElementById("regConfirmPassword")?.value;

  if (!username || !email || !password || !confirm) {
    showMessage("register-message", "All fields are required");
    return;
  }

  if (password !== confirm) {
    showMessage("register-message", "Passwords do not match");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    showMessage("register-message", "Account created successfully", "success");

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1000);

  } catch (err) {
    showMessage("register-message", err.message);
  }
};

/* ---------------- FORGOT PASSWORD ---------------- */

window.forgotPassword = async function () {
  const email = document.getElementById("loginEmail")?.value.trim();

  if (!email) {
    showMessage("login-message", "Enter your email first");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("login-message", "Password reset email sent", "success");
  } catch (err) {
    showMessage("login-message", err.message);
  }
};
