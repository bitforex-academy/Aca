// ==========================
// 🔹 FIREBASE IMPORTS
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================
// 🔹 FIREBASE CONFIG
// ==========================
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

// ==========================
// 🔹 HELPERS
// ==========================
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// ==========================
// 🔹 AUTH – REGISTER
// ==========================
window.registerUser = async (e) => {
  e.preventDefault();

  const username = regUsername.value.trim();
  const email = regEmail.value.trim();
  const password = regPassword.value.trim();
  const confirm = regConfirmPassword.value.trim();

  if (!username || !email || !password || !confirm) {
    alert("All fields required");
    return;
  }
  if (password !== confirm) {
    alert("Passwords do not match");
    return;
  }

  const cred = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "users", cred.user.uid), {
    username,
    email,
    role: "user",
    active: true,
    subscription: null,
    online: true,
    createdAt: serverTimestamp()
  });

  window.location.href = "user-chat.html";
};

// ==========================
// 🔹 AUTH – LOGIN
// ==========================
window.loginUser = async (e) => {
  e.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();

  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, "users", cred.user.uid));

  if (!snap.exists()) {
    alert("User record missing");
    return;
  }

  const role = snap.data().role;

  if (role === "admin") {
    window.location.href = "admin-dashboard.html";
  } else {
    window.location.href = "user-chat.html";
  }
};

// ==========================
// 🔹 LOGOUT
// ==========================
window.logoutUser = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};

// ==========================
// 🔹 FORGOT PASSWORD
// ==========================
window.forgotPassword = async (email) => {
  if (!email) return alert("Enter email");
  await sendPasswordResetEmail(auth, email);
  alert("Reset email sent");
};

// ==========================
// 🔹 AUTH STATE
// ==========================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  await updateDoc(doc(db, "users", user.uid), {
    online: true
  });
});

// ==========================
// 🔹 ADMIN – LOAD USERS
// ==========================
window.loadAdminUsers = async () => {
  const box = document.getElementById("adminUsers");
  if (!box) return;

  const snap = await getDocs(collection(db, "users"));
  box.innerHTML = "";

  snap.forEach((d) => {
    const u = d.data();
    if (u.role !== "user") return;

    box.innerHTML += `
      <div class="user-card">
        <b>${u.username}</b>
        <p>${u.email}</p>
        <button onclick="openAdminChat('${d.id}')">Message</button>
      </div>
    `;
  });
};

// ==========================
// 🔹 ADMIN – OPEN CHAT
// ==========================
window.openAdminChat = (userId) => {
  localStorage.setItem("chatUser", userId);
  window.location.href = "admin-chat.html";
};

// ==========================
// 🔹 LOAD CHAT (ADMIN & USER)
// ==========================
window.loadChat = async (boxId) => {
  const box = document.getElementById(boxId);
  if (!box) return;

  const currentUser = auth.currentUser;
  if (!currentUser) return;

  let otherUserId = localStorage.getItem("chatUser");

  // user chatting with admin
  if (!otherUserId) {
    const adminSnap = await getDocs(
      query(collection(db, "users"))
    );
    adminSnap.forEach(d => {
      if (d.data().role === "admin") {
        otherUserId = d.id;
      }
    });
  }

  const chatId = getChatId(currentUser.uid, otherUserId);
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt")
  );

  onSnapshot(q, (snap) => {
    box.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      box.innerHTML += `
        <div class="${m.senderId === currentUser.uid ? "me" : "them"}">
          ${m.text}
        </div>
      `;
    });
    box.scrollTop = box.scrollHeight;
  });
};

// ==========================
// 🔹 SEND MESSAGE
// ==========================
window.sendMessage = async (inputId) => {
  const input = document.getElementById(inputId);
  if (!input.value.trim()) return;

  const user = auth.currentUser;
  let otherUserId = localStorage.getItem("chatUser");

  if (!otherUserId) {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(d => {
      if (d.data().role === "admin") otherUserId = d.id;
    });
  }

  const chatId = getChatId(user.uid, otherUserId);

  await addDoc(collection(db, "chats", chatId, "messages"), {
    senderId: user.uid,
    text: input.value.trim(),
    createdAt: serverTimestamp()
  });

  input.value = "";
};

// ==========================
// 🔹 SUBSCRIPTIONS – ADMIN SAVE
// ==========================
window.savePlan = async () => {
  if (!planName.value || !planPrice.value || !planDuration.value) {
    alert("All fields required");
    return;
  }

  await addDoc(collection(db, "subscriptions"), {
    name: planName.value.trim(),
    price: Number(planPrice.value),
    duration: Number(planDuration.value),
    active: true,
    createdAt: serverTimestamp()
  });

  alert("Plan saved");
  planName.value = "";
  planPrice.value = "";
  planDuration.value = "";
};

// ==========================
// 🔹 SUBSCRIPTIONS – USER SELECT
// ==========================
window.selectSubscription = async (planId) => {
  const user = auth.currentUser;
  if (!user) return;

  const planSnap = await getDoc(doc(db, "subscriptions", planId));
  if (!planSnap.exists()) return;

  const plan = planSnap.data();
  const start = Date.now();
  const end = start + plan.duration * 86400000;

  await updateDoc(doc(db, "users", user.uid), {
    subscription: {
      planId,
      planName: plan.name,
      status: "pending",
      start,
      end
    }
  });

  alert("Subscription pending payment");
};
