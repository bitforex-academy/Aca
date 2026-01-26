/* =========================================================
   FIREBASE IMPORTS (v10.12.2)
========================================================= */
import { auth, db, storage } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  set,
  push,
  update,
  onValue,
  onChildAdded,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  ref as sRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* =========================================================
   AUTH — REGISTER
========================================================= */
window.registerUser = async (email, password, username) => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await set(ref(db, `users/${cred.user.uid}`), {
      uid: cred.user.uid,
      email,
      username,
      role: "user",
      online: true,
      subscription: null,
      createdAt: serverTimestamp()
    });

    location.href = "user-chat.html";
  } catch (e) {
    alert(e.message);
  }
};

/* =========================================================
   AUTH — LOGIN
========================================================= */
window.loginUser = async (email, password) => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    await update(ref(db, `users/${cred.user.uid}`), {
      online: true
    });

    onValue(ref(db, `users/${cred.user.uid}/role`), snap => {
      if (snap.val() === "admin") {
        location.href = "admin-dashboard.html";
      } else {
        location.href = "user-chat.html";
      }
    }, { onlyOnce: true });

  } catch (e) {
    alert(e.message);
  }
};

/* =========================================================
   AUTH — LOGOUT
========================================================= */
window.logoutUser = async () => {
  const user = auth.currentUser;
  if (user) {
    await update(ref(db, `users/${user.uid}`), { online: false });
  }
  await signOut(auth);
  location.href = "login.html";
};

/* =========================================================
   AUTH — FORGOT PASSWORD
========================================================= */
window.resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent");
  } catch (e) {
    alert(e.message);
  }
};

/* =========================================================
   AUTH STATE + PRESENCE
========================================================= */
onAuthStateChanged(auth, user => {
  if (!user) return;
  update(ref(db, `users/${user.uid}`), { online: true });
  window.addEventListener("beforeunload", () => {
    update(ref(db, `users/${user.uid}`), { online: false });
  });
});

/* =========================================================
   USER CHAT
========================================================= */
const chatBox = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendBtn");
const messageInput = document.getElementById("messageInput");
const imageInput = document.getElementById("imageInput");

if (chatBox && sendBtn) {
  onAuthStateChanged(auth, user => {
    if (!user) return;

    const chatRef = ref(db, `chats/${user.uid}/messages`);

    onChildAdded(chatRef, snap => renderMsg(snap.val()));

    sendBtn.onclick = async () => {
      if (!messageInput.value.trim()) return;
      await push(chatRef, {
        sender: "user",
        text: messageInput.value,
        image: null,
        time: serverTimestamp()
      });
      messageInput.value = "";
    };

    imageInput.onchange = async () => {
      const file = imageInput.files[0];
      if (!file) return;
      const imgRef = sRef(storage, `chat/${user.uid}/${Date.now()}`);
      await uploadBytes(imgRef, file);
      const url = await getDownloadURL(imgRef);
      await push(chatRef, {
        sender: "user",
        text: "",
        image: url,
        time: serverTimestamp()
      });
    };
  });
}

function renderMsg(m) {
  const div = document.createElement("div");
  div.className = "msg" + (m.sender === "user" ? " user" : "");
  if (m.text) div.textContent = m.text;
  if (m.image) {
    const img = document.createElement("img");
    img.src = m.image;
    div.appendChild(img);
  }
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* =========================================================
   ADMIN CHAT
========================================================= */
const adminChatBox = document.getElementById("adminChatBox");
const adminSendBtn = document.getElementById("adminSendBtn");
const adminInput = document.getElementById("adminMessageInput");
const uid = new URLSearchParams(location.search).get("uid");

if (adminChatBox && adminSendBtn && uid) {
  const chatRef = ref(db, `chats/${uid}/messages`);

  onChildAdded(chatRef, snap => {
    const d = document.createElement("div");
    d.className = "msg admin";
    d.textContent = snap.val().text;
    adminChatBox.appendChild(d);
  });

  adminSendBtn.onclick = async () => {
    if (!adminInput.value.trim()) return;
    await push(chatRef, {
      sender: "admin",
      text: adminInput.value,
      time: serverTimestamp()
    });
    adminInput.value = "";
  };
}

/* =========================================================
   ADMIN USERS
========================================================= */
const usersList = document.getElementById("usersList");
if (usersList) {
  onValue(ref(db, "users"), snap => {
    usersList.innerHTML = "";
    snap.forEach(s => {
      const u = s.val();
      usersList.innerHTML += `
        <div class="user-card">
          <b>${u.username}</b><br>
          ${u.email}<br>
          <span class="${u.online ? 'status' : 'inactive'}">
            ${u.online ? 'Online' : 'Offline'}
          </span><br><br>
          <button onclick="location.href='admin-chat.html?uid=${u.uid}'">
            View User
          </button>
        </div>
      `;
    });
  });
}

/* =========================================================
   SUBSCRIPTIONS (USER)
========================================================= */
const plans = document.getElementById("plans");
const status = document.getElementById("status");

if (plans && status) {
  onValue(ref(db, "subscriptionPlans"), snap => {
    plans.innerHTML = "";
    snap.forEach(p => {
      const pl = p.val();
      plans.innerHTML += `
        <div class="card">
          <h3>${pl.name}</h3>
          <p>${pl.price}</p>
          <p>${pl.duration}</p>
          <button onclick="location.href='user-payment.html?plan=${p.key}'">
            View
          </button>
        </div>
      `;
    });
  });
}
