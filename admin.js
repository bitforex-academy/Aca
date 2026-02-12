// ==========================
// 🔹 IMPORT FIREBASE
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref as stRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ==========================
// 🔹 CONFIGURATION
// ==========================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MSG_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================
// 🔹 ADMIN DASHBOARD STATS
// ==========================
export async function loadAdminStats(statsElements) {
  // statsElements: { totalUsers, activeSubs, pendingPayments, totalRevenue }
  const usersSnap = await getDocs(collection(db, "users"));
  statsElements.totalUsers.innerText = usersSnap.size;

  let activeSubsCount = 0;
  let totalRevenue = 0;
  let pendingPaymentsCount = 0;

  usersSnap.forEach(u => {
    const data = u.data();
    if (data.subscription && data.subscription.status === "active") {
      activeSubsCount++;
      if (data.subscription.planPrice) totalRevenue += Number(data.subscription.planPrice);
    }
    if (data.subscription && data.subscription.status === "pending") {
      pendingPaymentsCount++;
    }
  });

  statsElements.activeSubs.innerText = activeSubsCount;
  statsElements.totalRevenue.innerText = `₦${totalRevenue}`;
  statsElements.pendingPayments.innerText = pendingPaymentsCount;
}

// ==========================
// 🔹 ADMIN CHAT
// ==========================
let activeChatId = null;
let ADMIN_UID = null;

export async function initAdminChat(messageInput, messagesBox, sendBtn) {
  // Detect admin UID
  const usersSnap = await getDocs(collection(db, "users"));
  usersSnap.forEach(u => {
    const data = u.data();
    if (data.role === "admin") ADMIN_UID = u.id;
  });
  if (!ADMIN_UID) return console.error("No admin found");

  // Listen to messages
  const chatRef = collection(db, "chats");
  const q = query(chatRef, orderBy("createdAt"));
  
  onSnapshot(q, snap => {
    if (!messagesBox) return;
    messagesBox.innerHTML = "";
    snap.forEach(docSnap => {
      const m = docSnap.data();
      const div = document.createElement("div");
      div.className = m.senderId === ADMIN_UID ? "msg admin" : "msg user";
      div.innerText = m.text || "";
      messagesBox.appendChild(div);
      messagesBox.scrollTop = messagesBox.scrollHeight;
    });
  });

  if (sendBtn) {
    sendBtn.onclick = async () => {
      if (!messageInput.value.trim()) return;
      await addDoc(collection(db, "chats", `${ADMIN_UID}_user`, "messages"), {
        senderId: ADMIN_UID,
        text: messageInput.value.trim(),
        createdAt: serverTimestamp()
      });
      messageInput.value = "";
    };
  }
}

// ==========================
// 🔹 SUBSCRIPTION MANAGEMENT
// ==========================
export async function loadSubscriptions(container) {
  const snap = await getDocs(collection(db, "subscriptions"));
  container.innerHTML = "";
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h4>${data.name}</h4>
      <p>${data.description || ""}</p>
      <button onclick="editSubscription('${docSnap.id}')">Edit</button>
      <button onclick="deleteSubscription('${docSnap.id}')">Delete</button>
    `;
    container.appendChild(card);
  });
}

export async function addSubscription(name, description, price) {
  await addDoc(collection(db, "subscriptions"), { name, description, price });
}

export async function editSubscription(id, name, description, price) {
  await updateDoc(doc(db, "subscriptions", id), { name, description, price });
}

export async function deleteSubscription(id) {
  await deleteDoc(doc(db, "subscriptions", id));
}

// ==========================
// 🔹 USER MANAGEMENT
// ==========================
export async function loadUsers(container) {
  const snap = await getDocs(collection(db, "users"));
  container.innerHTML = "";
  snap.forEach(docSnap => {
    const u = docSnap.data();
    const div = document.createElement("div");
    div.className = "user-card";
    div.innerHTML = `
      <h4>${u.username}</h4>
      <p>Email: ${u.email}</p>
      <p>Subscription: ${u.subscription ? u.subscription.status : "None"}</p>
    `;
    container.appendChild(div);
  });
}

// ==========================
// 🔹 PAYMENT MANAGEMENT
// ==========================
export async function loadPayments(container) {
  const snap = await getDocs(collection(db, "users"));
  container.innerHTML = "";
  snap.forEach(uSnap => {
    const u = uSnap.data();
    if (u.subscription && u.subscription.status === "pending") {
      const div = document.createElement("div");
      div.className = "payment-card";
      div.innerHTML = `
        <h4>${u.username}</h4>
        <p>Plan: ${u.subscription.planName}</p>
        <p>Status: ${u.subscription.status}</p>
        <button onclick="approvePayment('${uSnap.id}')">Approve</button>
        <button onclick="rejectPayment('${uSnap.id}')">Reject</button>
      `;
      container.appendChild(div);
    }
  });
}

export async function approvePayment(userId) {
  await updateDoc(doc(db, "users", userId), { "subscription.status": "active" });
}

export async function rejectPayment(userId) {
  await updateDoc(doc(db, "users", userId), { "subscription.status": "rejected" });
}

// ==========================
// 🔹 ADMIN AUTH LISTENER
// ==========================
onAuthStateChanged(auth, user => {
  if (user) {
    updateDoc(doc(db, "users", user.uid), { online: true });
  }
});
