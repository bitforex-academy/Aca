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
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage,
  ref as stRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ==========================
// 🔹 CONSTANTS
// ==========================
const ADMIN_UID = "8XcfFJEoSFMIw9HOJLu0mW2nclp2";

// ==========================
// 🔹 AUTH – REGISTER
// ==========================
window.registerUser = async (e) => {
  e.preventDefault();

  const username = regUsername.value.trim();
  const email = regEmail.value.trim();
  const password = regPassword.value.trim();
  const confirm = regConfirmPassword.value.trim();
  const msg = document.getElementById("register-message");

  if (!username || !email || !password || !confirm) {
    msg.innerText = "All fields required";
    return;
  }

  if (password !== confirm) {
    msg.innerText = "Passwords do not match";
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
      username,
      email,
      role: "user",
      active: true,
      subscription: null,
      createdAt: serverTimestamp()
    });

    msg.innerText = "Account created successfully";
  } catch (err) {
    msg.innerText = err.message;
  }
};

// ==========================
// 🔹 AUTH – LOGIN (WORKS WITH YOUR HTML)
// ==========================
window.loginUser = async (e) => {
  e.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();
  const msg = document.getElementById("login-message");

  if (!email || !password) {
    msg.innerText = "Email & password required";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);

    const user = auth.currentUser;
    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) throw new Error("User record missing");

    if (snap.data().role === "admin") {
      location.href = "admin-dashboard.html";
    } else {
      location.href = "user-chat.html";
    }
  } catch (err) {
    msg.innerText = err.message;
  }
};

// ==========================
// 🔹 AUTH – LOGOUT
// ==========================
window.logoutUser = async () => {
  await signOut(auth);
  location.href = "login.html";
};

// ==========================
// 🔹 AUTH – FORGOT PASSWORD
// ==========================
window.forgotPassword = async () => {
  const email = loginEmail.value.trim();
  if (!email) return alert("Enter email first");

  await sendPasswordResetEmail(auth, email);
  alert("Password reset email sent");
};

// ==========================
// 🔹 CHAT HELPERS
// ==========================
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// ==========================
// 🔹 USER CHAT (AUTO LOAD)
// ==========================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const chatBox = document.getElementById("chatBox");
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");

  if (!chatBox || !sendBtn || !messageInput) return;

  const chatId = getChatId(user.uid, ADMIN_UID);
  const msgRef = collection(db, "chats", chatId, "messages");
  const q = query(msgRef, orderBy("createdAt"));

  onSnapshot(q, snap => {
    chatBox.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      const div = document.createElement("div");
      div.className = "msg " + (m.sender === user.uid ? "user" : "admin");

      if (m.type === "image") {
        const img = document.createElement("img");
        img.src = m.url;
        div.appendChild(img);
      } else {
        div.innerText = m.text;
      }

      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
    });
  });

  sendBtn.onclick = async () => {
    if (!messageInput.value && !imageInput.files.length) return;

    let payload = {
      sender: user.uid,
      createdAt: serverTimestamp()
    };

    if (imageInput.files.length) {
      const file = imageInput.files[0];
      const ref = stRef(storage, `chat/${chatId}/${Date.now()}`);
      await uploadBytes(ref, file);
      payload.type = "image";
      payload.url = await getDownloadURL(ref);
      imageInput.value = "";
    } else {
      payload.type = "text";
      payload.text = messageInput.value.trim();
    }

    await addDoc(msgRef, payload);
    messageInput.value = "";
  };
});

// ==========================
// 🔹 ADMIN CHAT SEND
// ==========================
window.adminSendMessage = async (userId, text) => {
  const chatId = getChatId(auth.currentUser.uid, userId);
  await addDoc(collection(db, "chats", chatId, "messages"), {
    sender: auth.currentUser.uid,
    text,
    type: "text",
    createdAt: serverTimestamp()
  });
};

// ==========================
// 🔹 SUBSCRIPTIONS – ADMIN SAVE
// ==========================
window.savePlan = async () => {
  const name = planName.value.trim();
  const price = planPrice.value.trim();
  const duration = planDuration.value.trim();

  if (!name || !price || !duration) {
    alert("All fields required");
    return;
  }

  await addDoc(collection(db, "subscriptions"), {
    name,
    price: Number(price),
    duration: Number(duration),
    active: true,
    createdAt: serverTimestamp()
  });

  alert("Plan saved");
  planName.value = planPrice.value = planDuration.value = "";
};

// ==========================
// 🔹 SUBSCRIPTIONS – USER LOAD
// ==========================
window.loadUserSubscriptions = async (containerId) => {
  const box = document.getElementById(containerId);
  const snap = await getDocs(collection(db, "subscriptions"));
  box.innerHTML = "";

  snap.forEach(d => {
    const p = d.data();
    box.innerHTML += `
      <div class="card">
        <h3>${p.name}</h3>
        <p>₦${p.price}</p>
        <p>${p.duration} days</p>
        <button onclick="location.href='user-payment.html?plan=${d.id}'">View</button>
      </div>
    `;
  });
};
