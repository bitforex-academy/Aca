// ==========================
// 🔹 IMPORT FIREBASE
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, updateDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref as stRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ==========================
// 🔹 CONFIGURATION
// ==========================
const firebaseConfig = {
  apiKey: "AIzaSyBhClpR0zHg4XYyTsDupLkmDIp_EkIzHEE",
  authDomain: "bitforex-academy-3a8f4.firebaseapp.com",
  projectId: "bitforex-academy-3a8f4",
  storageBucket: "bitforex-academy-3a8f4.appspot.com", // fixed!
  messagingSenderId: "659879098852",
  appId: "1:659879098852:web:16545b1980e2ed284a6ff1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================
// 🔹 USER AUTH FUNCTIONS
// ==========================

// Register
window.registerUser = async function(e){
  e.preventDefault();
  const username = document.getElementById("regUsername")?.value.trim();
  const email = document.getElementById("regEmail")?.value.trim();
  const password = document.getElementById("regPassword")?.value.trim();
  const confirm = document.getElementById("regConfirmPassword")?.value.trim();
  const msg = document.getElementById("register-message");

  if(!username || !email || !password || !confirm){
    msg.className="error"; msg.innerText="All fields are required"; return;
  }
  if(password!==confirm){ msg.className="error"; msg.innerText="Passwords do not match"; return; }

  try{
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db,"users",userCred.user.uid),{
      username,
      email,
      role:"user",
      active:false,
      subscription:null,
      createdAt:serverTimestamp()
    });
    msg.className="success"; msg.innerText="Account created!";
  } catch(err){
    msg.className="error"; msg.innerText=err.message;
  }
}

// Login
window.loginUser = async function(e){
  e.preventDefault();
  const email = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value.trim();
  const msg = document.getElementById("login-message");

  try{
    await signInWithEmailAndPassword(auth,email,password);
    msg.className="success"; msg.innerText="Login successful!";
    // redirect
    const user = auth.currentUser;
    const docSnap = await getDoc(doc(db,"users",user.uid));
    if(docSnap.exists()){
      if(docSnap.data().role==="admin") window.location.href="admin-dashboard.html";
      else window.location.href="user-chat.html";
    }
  } catch(err){
    msg.className="error"; msg.innerText=err.message;
  }
}

// Logout
window.logoutUser = async function(){
  await signOut(auth);
  window.location.href="login.html";
}

// Forgot Password
window.forgotPassword = async function(email){
  if(!email) return alert("Enter your email");
  try{
    await sendPasswordResetEmail(auth,email);
    alert("Reset email sent!");
  } catch(err){
    alert(err.message);
  }
}

// ==========================
// 🔹 ADMIN USERS MANAGEMENT
// ==========================
export async function loadAdminUsers(filter="all"){
  const container = document.getElementById("adminUsersTable");
  if(!container) return;

  const usersSnap = await getDocs(collection(db,"users"));
  if(usersSnap.empty){ container.innerHTML="<p>No users found</p>"; return; }

  container.innerHTML="";
  usersSnap.forEach(docSnap=>{
    const u = docSnap.data();
    if(filter!=="all" && ((u.active?"Active":"Inactive")!==filter)) return;

    const sub = u.subscription ? u.subscription.planName + " ("+u.subscription.status+")" : "None";
    const card = document.createElement("div");
    card.className="user-card";
    card.innerHTML=`
      <h3>${u.username}</h3>
      <div class="muted">${u.email}</div>
      <p>Plan: ${sub}</p>
      <span class="user-badge ${u.active?"badge-active":"badge-inactive"}">${u.active?"Active":"Inactive"}</span>
      <br>
      <button class="view-btn" onclick="viewUser('${docSnap.id}')">View User</button>
    `;
    container.appendChild(card);
  });
}

window.viewUser = async function(uid){
  const docSnap = await getDoc(doc(db,"users",uid));
  if(!docSnap.exists()) return alert("User not found");
  const u = docSnap.data();

  const popup = document.createElement("div");
  popup.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;justify-content:center;align-items:center;";
  popup.innerHTML=`
    <div style="background:#020617;padding:20px;border-radius:12px;width:90%;max-width:400px;position:relative;">
      <h3>${u.username}</h3>
      <p>Email: ${u.email}</p>
      <p>Subscription: ${u.subscription?u.subscription.planName:"None"}</p>
      <button style="background:#22c55e;color:#000;padding:10px;width:100%;border:none;border-radius:6px;margin-top:10px;" onclick="startAdminChat('${uid}')">Message User</button>
    </div>
  `;
  popup.addEventListener("click",e=>{ if(e.target===popup) popup.remove(); });
  document.body.appendChild(popup);
}

// ==========================
// 🔹 ADMIN & USER CHAT
// ==========================
export async function startAdminChat(uid){
  localStorage.setItem("chatWith",uid);
  window.location.href="admin-chat.html";
}

// Load messages
export function loadMessages(chatBoxId){
  const box = document.getElementById(chatBoxId);
  if(!box) return;
  const chatWith = localStorage.getItem("chatWith");
  if(!chatWith) { box.innerHTML="<p>Select user to chat</p>"; return; }

  const msgRef = collection(db,"chats",chatWith,"messages");
  const q = query(msgRef,orderBy("time","asc"));

  onSnapshot(q, snap=>{
    box.innerHTML="";
    snap.forEach(m=>{
      const div = document.createElement("div");
      div.className="msg "+(m.data().from==="admin"?"admin":"user");
      if(m.data().type==="text") div.innerText=m.data().text;
      else if(m.data().type==="image"){
        const img = document.createElement("img"); img.src=m.data().url;
        div.appendChild(img);
      }
      box.appendChild(div);
      box.scrollTop=box.scrollHeight;
    });
  });
}

// Send message
export async function sendMessage(chatBoxId,msgInputId,fileInputId){
  const box = document.getElementById(chatBoxId);
  const input = document.getElementById(msgInputId);
  const fileInput = document.getElementById(fileInputId);
  const chatWith = localStorage.getItem("chatWith");
  if(!chatWith || !input) return;

  let payload = {from:"user",type:"text",text:input.value,time:serverTimestamp()};
  if(fileInput && fileInput.files.length>0){
    const f = fileInput.files[0];
    const path = `chats/${chatWith}/${Date.now()}_${f.name}`;
    const storageRef = stRef(storage,path);
    await uploadBytes(storageRef,f);
    const url = await getDownloadURL(storageRef);
    payload = {from:"user",type:"image",url,time:serverTimestamp()};
    fileInput.value="";
  }

  await addDoc(collection(db,"chats",chatWith,"messages"),payload);
  input.value="";
}


/* ===========================
   CHAT HELPERS (GLOBAL)
=========================== */

import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function getChatId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

/* ===========================
   USER CHAT LOGIC
=========================== */

let activeChatId = null;

auth.onAuthStateChanged(user => {
  if (!user) return;

  const ADMIN_UID = "8XcfFJEoSFMIw9HOJLu0mW2nclp2"; // 🔴 PUT YOUR ADMIN UID
  activeChatId = getChatId(user.uid, ADMIN_UID);

  // enable typing
  if (window.messageInput) messageInput.disabled = false;

  const msgRef = collection(db, "chats", activeChatId, "messages");
  const q = query(msgRef, orderBy("createdAt"));

  onSnapshot(q, snap => {
    if (!window.messagesBox) return;

    messagesBox.innerHTML = "";
    snap.forEach(doc => {
      const m = doc.data();
      messagesBox.innerHTML += `
        <div class="${m.sender === user.uid ? "me" : "them"}">
          ${m.text}
        </div>
      `;
    });

    messagesBox.scrollTop = messagesBox.scrollHeight;
  });
});

/* ===========================
   USER SEND MESSAGE
=========================== */

if (window.sendBtn) {
  sendBtn.onclick = async () => {
    if (!messageInput.value.trim() || !activeChatId) return;

    await addDoc(
      collection(db, "chats", activeChatId, "messages"),
      {
        sender: auth.currentUser.uid,
        text: messageInput.value.trim(),
        createdAt: serverTimestamp()
      }
    );

    messageInput.value = "";
  };
}

/* ===========================
   ADMIN SEND MESSAGE
=========================== */

window.adminSendMessage = async (userId, text) => {
  if (!text.trim()) return;

  const chatId = getChatId(auth.currentUser.uid, userId);

  await addDoc(
    collection(db, "chats", chatId, "messages"),
    {
      sender: auth.currentUser.uid,
      text,
      createdAt: serverTimestamp()
    }
  );
};

// ==========================
// 🔹 SUBSCRIPTIONS
// ==========================
export async function loadSubscriptions(userId,containerId){
  const container = document.getElementById(containerId);
  if(!container) return;

  const q = collection(db,"subscriptions");
  const snap = await getDocs(q);
  container.innerHTML="";
  snap.forEach(docSnap=>{
    const sub = docSnap.data();
    const card = document.createElement("div");
    card.className="card";
    card.innerHTML=`
      <h3>${sub.name}</h3>
      <p>${sub.description || ""}</p>
      <button onclick="selectSubscription('${docSnap.id}')">Choose Plan</button>
    `;
    container.appendChild(card);
  });
}

window.selectSubscription = async function(planId){
  const user = auth.currentUser;
  if(!user) return alert("Login first");
  const docSnap = await getDoc(doc(db,"subscriptions",planId));
  if(!docSnap.exists()) return alert("Plan not found");

  await updateDoc(doc(db,"users",user.uid),{
    subscription:{
      planId:docSnap.id,
      planName:docSnap.data().name,
      status:"pending",
      start:Date.now(),
      expires:Date.now()+30*24*60*60*1000
    }
  });
  alert("Subscription selected, proceed to payment");
};

import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function savePlan() {
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
    duration: Number(duration), // days
    createdAt: serverTimestamp(),
    active: true
  });

  alert("Plan saved successfully");

  planName.value = "";
  planPrice.value = "";
  planDuration.value = "";
}

// ==========================
// 🔹 COURSES (optional)
// ==========================
export async function loadCourses(containerId){
  const container = document.getElementById(containerId);
  if(!container) return;
  const snap = await getDocs(collection(db,"courses"));
  container.innerHTML="";
  snap.forEach(docSnap=>{
    const course = docSnap.data();
    const card = document.createElement("div");
    card.className="card";
    card.innerHTML=`
      <h3>${course.title}</h3>
      <p>${course.description || ""}</p>
    `;
    container.appendChild(card);
  });
}

// ==========================
// 🔹 INITIALIZATION
// ==========================
onAuthStateChanged(auth,user=>{
  if(user){
    const uid=user.uid;
    // update online status
    updateDoc(doc(db,"users",uid),{onlin:true});
  }
});
