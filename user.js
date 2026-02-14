// ==========================
// 🔹 IMPORT FIREBASE
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, updatePassword, updateEmail, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, serverTimestamp, query, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref as stRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ==========================
// 🔹 CONFIGURATION
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
const storage = getStorage(app);

// ==========================
// 🔹 USER STATE & INFO
// ==========================
let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "login.html";
  currentUser = user;

  // Update online status
  await updateDoc(doc(db,"users",user.uid),{online:true});

  // Load default user pages if elements exist
  if(document.getElementById("coursesBox")) loadCourses("coursesBox");
  if(document.getElementById("subscriptionsBox")) loadSubscriptions("subscriptionsBox");
  if(document.getElementById("chatBox")) initChat();
  if(document.getElementById("paymentBox")) loadPaymentDetails();
  if(document.getElementById("settingsBox")) loadUserSettings();
});

// ==========================
// 🔹 USER COURSES
// ==========================
export async function loadCourses(containerId){
  const container = document.getElementById(containerId);
  if(!container) return;

  const snap = await getDocs(collection(db,"courses"));
  container.innerHTML="";
  snap.forEach(doc=>{
    const c=doc.data();
    const div = document.createElement("div");
    div.className="course-card";
    div.innerHTML=`
      <h3>${c.title}</h3>
      <p>${c.description || ""}</p>
    `;
    container.appendChild(div);
  });
}

// ==========================
// 🔹 USER SUBSCRIPTIONS
// ==========================
export async function loadSubscriptions(containerId){
  const container = document.getElementById(containerId);
  if(!container) return;

  const snap = await getDocs(collection(db,"subscriptions"));
  container.innerHTML="";
  snap.forEach(doc=>{
    const sub = doc.data();
    const div = document.createElement("div");
    div.className="subscription-card";
    div.innerHTML=`
      <h3>${sub.name}</h3>
      <p>${sub.description || ""}</p>
      <button onclick="selectSubscription('${doc.id}')">Select Plan</button>
    `;
    container.appendChild(div);
  });
}

// Select subscription (placeholder for later)
window.selectSubscription = async function(planId){
  if(!currentUser) return alert("Login first");
  alert("Plan selected! Payment page will be available next.");
};

// ==========================
// 🔹 USER PAYMENTS
// ==========================
export async function loadPaymentDetails(){
  const container = document.getElementById("paymentBox");
  if(!container) return;

  const docSnap = await getDoc(doc(db,"paymentDetails","main"));
  if(!docSnap.exists()) {
    container.innerHTML="<p>No payment details available.</p>";
    return;
  }

  const data = docSnap.data();
  container.innerHTML=`
    <h3>Payment Details</h3>
    <p><strong>Bank Name:</strong> ${data.bankName}</p>
    <p><strong>Account Number:</strong> ${data.accountNumber}</p>
    <p><strong>Account Name:</strong> ${data.accountName}</p>
    <p><strong>Crypto Wallet:</strong> ${data.cryptoWallet}</p>
    <button id="submitPaymentBtn">Submit Payment Proof</button>
  `;

  document.getElementById("submitPaymentBtn").onclick = async ()=>{
    const proofInput = document.createElement("input");
    proofInput.type="file";
    proofInput.accept="image/*";
    proofInput.onchange = async ()=>{
      const file = proofInput.files[0];
      if(!file) return;
      const ref = stRef(storage,`paymentProof/${currentUser.uid}_${Date.now()}`);
      await uploadBytes(ref,file);
      const url = await getDownloadURL(ref);
      await addDoc(collection(db,"payments"),{
        userId: currentUser.uid,
        proof: url,
        status: "pending",
        createdAt: serverTimestamp()
      });
      alert("Payment submitted. Pending admin approval.");
    };
    proofInput.click();
  }
}

// ==========================
// 🔹 USER CHAT
// ==========================
let chatId = null;
function getChatId(uid1, uid2){ return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`; }

async function initChat(){
  // detect admin
  const snap = await getDocs(collection(db,"users"));
  let ADMIN_UID = null;
  snap.forEach(d=>{
    if(d.data().role==="admin") ADMIN_UID = d.id;
  });
  if(!ADMIN_UID) return console.error("No admin found!");

  chatId = getChatId(currentUser.uid, ADMIN_UID);

  const messagesBox = document.getElementById("chatBox");
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");

  // Listen messages
  const msgRef = collection(db,"chats",chatId,"messages");
  const q = query(msgRef, orderBy("createdAt"));
  onSnapshot(q, snap=>{
    if(!messagesBox) return;
    messagesBox.innerHTML="";
    snap.forEach(doc=>{
      const m = doc.data();
      const div = document.createElement("div");
      div.className = m.senderId === currentUser.uid ? "msg user" : "msg admin";
      div.innerText = m.text || "";
      messagesBox.appendChild(div);
      messagesBox.scrollTop = messagesBox.scrollHeight;
    });
  });

  // Send messages
  if(sendBtn){
    sendBtn.onclick = async ()=>{
      const text = messageInput.value.trim();
      if(!text) return;
      await addDoc(msgRef,{
        senderId: currentUser.uid,
        text,
        createdAt: serverTimestamp()
      });
      messageInput.value="";
    }
  }
}

// ==========================
// 🔹 USER SETTINGS
// ==========================
export async function loadUserSettings(){
  const container = document.getElementById("settingsBox");
  if(!container) return;

  const docSnap = await getDoc(doc(db,"users",currentUser.uid));
  if(!docSnap.exists()) return;

  const data = docSnap.data();
  container.innerHTML=`
    <h3>Profile</h3>
    <label>Username</label>
    <input type="text" id="usernameInput" value="${data.username}">
    <label>Email</label>
    <input type="email" id="emailInput" value="${data.email}">
    <button id="saveSettingsBtn">Save Changes</button>
  `;

  document.getElementById("saveSettingsBtn").onclick = async ()=>{
    if(!confirm("Are you sure you want to save details?")) return;

    const username = document.getElementById("usernameInput").value.trim();
    const email = document.getElementById("emailInput").value.trim();

    await updateDoc(doc(db,"users",currentUser.uid),{username,email});

    try{
      if(email !== currentUser.email){
        await updateEmail(currentUser,email);
      }
      alert("Profile updated!");
    } catch(err){
      alert("Error updating: "+err.message);
    }
  }
}

// ==========================
// 🔹 LOGOUT
// ==========================
window.logoutUser = async ()=>{
  await updateDoc(doc(db,"users",currentUser.uid),{online:false});
  await signOut(auth);
  window.location.href="login.html";
};
