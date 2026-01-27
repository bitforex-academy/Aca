// ==========================
// 🔹 IMPORT FIREBASE
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  sendPasswordResetEmail, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, 
  updateDoc, onSnapshot, query, orderBy, serverTimestamp 
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
// 🔹 SUBSCRIPTIONS
// ==========================
export async function loadSubscriptions(userId,containerId){
  const container = document.getElementById(containerId);
  if(!container) return;

  const snap = await getDocs(collection(db,"subscriptions"));
  container.innerHTML="";
  snap.forEach(docSnap=>{
    const sub = docSnap.data();
    const card = document.createElement("div");
    card.className="card";
    card.innerHTML=`
      <h3>${sub.name}</h3>
      <p>${sub.description||""}</p>
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

// ==========================
// 🔹 USER ↔ ADMIN CHAT
// ==========================
function getChatId(uid1, uid2){ return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`; }

let activeChatId = null;
let ADMIN_UID = null;

// Auto detect admin UID
async function detectAdmin() {
  const snap = await getDocs(collection(db,"users"));
  snap.forEach(d=>{
    const u=d.data();
    if(u.role==="admin") ADMIN_UID=d.id;
  });
}

auth.onAuthStateChanged(user=>{
  if(!user) return;

  detectAdmin().then(()=>{
    activeChatId = getChatId(user.uid, ADMIN_UID);

    // enable message input if exists
    if(window.messageInput) messageInput.disabled = false;

    const msgRef = collection(db,"chats",activeChatId,"messages");
    const q = query(msgRef,orderBy("createdAt"));

    onSnapshot(q,snap=>{
      if(!window.messagesBox) return;
      messagesBox.innerHTML="";
      snap.forEach(doc=>{
        const m=doc.data();
        const div=document.createElement("div");
        div.className=m.sender===user.uid?"msg me":"msg them";
        div.innerText=m.text||"";
        messagesBox.appendChild(div);
        messagesBox.scrollTop=messagesBox.scrollHeight;
      });
    });
  });
});

// User sends message
if(window.sendBtn){
  sendBtn.onclick=async ()=>{
    if(!messageInput.value.trim() || !activeChatId) return;
    await addDoc(collection(db,"chats",activeChatId,"messages"),{
      sender:auth.currentUser.uid,
      text:messageInput.value.trim(),
      createdAt:serverTimestamp()
    });
    messageInput.value="";
  }
}

// Admin sends message
window.adminSendMessage=async(userId,text)=>{
  if(!text.trim()) return;
  const chatId=getChatId(auth.currentUser.uid,userId);
  await addDoc(collection(db,"chats",chatId,"messages"),{
    sender:auth.currentUser.uid,
    text,
    createdAt:serverTimestamp()
  });
};

// ==========================
// 🔹 PLAN MANAGEMENT (ADMIN)
// ==========================
export async function loadPlans(containerId){
  const container = document.getElementById(containerId);
  if(!container) return;

  const snap = await getDocs(collection(db,"plans"));
  container.innerHTML="";
  snap.forEach(d=>{
    const p=d.data();
    container.innerHTML+=`
      <div class="plan-card">
        <b>${p.name}</b><br>
        ₦${p.price} - ${p.duration} days
        <div class="actions">
          <button onclick="editPlan('${d.id}','${p.name}','${p.price}','${p.duration}')">Edit</button>
          <button onclick="removePlan('${d.id}')">Delete</button>
        </div>
      </div>
    `;
  });
}

window.savePlan=async()=>{
  const name=planName.value.trim();
  const price=planPrice.value.trim();
  const duration=planDuration.value.trim();
  if(!name||!price||!duration) return alert("All fields required");

  if(editId){
    await updateDoc(doc(db,"plans",editId),{name,price,duration});
  }else{
    await addDoc(collection(db,"plans"),{name,price,duration});
  }
  planModal.style.display="none";
  loadPlans("plansBox");
};

// ==========================
// 🔹 COURSES
// ==========================
export async function loadCourses(containerId){
  const container=document.getElementById(containerId);
  if(!container) return;
  const snap=await getDocs(collection(db,"courses"));
  container.innerHTML="";
  snap.forEach(doc=>{
    const c=doc.data();
    container.innerHTML+=`
      <div class="card">
        <h3>${c.title}</h3>
        <p>${c.description||""}</p>
      </div>
    `;
  });
}

// ==========================
// 🔹 INITIALIZATION
// ==========================
onAuthStateChanged(auth,user=>{
  if(user){
    updateDoc(doc(db,"users",user.uid),{online:true});
  }
});
