// ============================
// app.js - Full Admin + User + Courses + Subscriptions + Chat
// ============================

import { auth, db, storage } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ============================
// HELPERS
// ============================
function $id(...ids) { for (const id of ids) { const el = document.getElementById(id); if (el) return el; } return null; }
function getInputValue(el) { return (el && el.value) ? el.value.trim() : ""; }
function showMessage(container, text, type = "error") {
  if (!container) return;
  container.textContent = text;
  container.classList.remove("hidden", "error", "success", "info");
  container.classList.add(type);
  if(type==="error") container.style.color="#ffb4b4";
  else if(type==="success") container.style.color="#bafdbe";
  else container.style.color="";
}
function clearMessage(container){ if(!container) return; container.textContent=""; container.classList.add("hidden"); container.style.color=""; }
function setLoading(button, loading, text="Loading...") {
  if(!button) return;
  if(loading){
    if(!button.dataset.origText) button.dataset.origText = button.textContent || "";
    button.disabled = true;
    button.textContent = button.dataset.loadingText || text;
  }else{
    if(button.dataset.origText!==undefined) button.textContent = button.dataset.origText;
    button.disabled=false;
  }
}

// ============================
// REGISTRATION
// ============================
window.registerUser = async function(){
  const msg = $id("register-message"); clearMessage(msg);
  const username = getInputValue($id("regUsername"));
  const email = getInputValue($id("regEmail"));
  const password = getInputValue($id("regPassword"));
  const confirm = getInputValue($id("regConfirmPassword"));
  const btn = $id("register-btn");

  if(!email) return showMessage(msg,"Please enter email");
  if(!password) return showMessage(msg,"Please enter password");
  if(password!==confirm) return showMessage(msg,"Passwords do not match");

  try{
    setLoading(btn,true,"Creating account...");
    const cred = await createUserWithEmailAndPassword(auth,email,password);
    const user = cred.user;

    // Determine role: first user becomes admin
    const adminMeta = doc(db,"meta","admin");
    const metaSnap = await getDoc(adminMeta);
    let role = "user";
    if(!metaSnap.exists()){
      role="admin";
      await setDoc(adminMeta,{created:true});
    }

    await setDoc(doc(db,"users",user.uid),{
      username: username||email.split("@")[0],
      email,
      role,
      createdAt: serverTimestamp(),
      online: false
    });

    showMessage(msg,"Account created successfully","success");
    setTimeout(()=> location.href="login.html",700);
  }catch(err){
    console.error(err);
    showMessage(msg,err.message||"Registration failed","error");
  }finally{
    setLoading(btn,false);
  }
};

// ============================
// LOGIN
// ============================
window.loginUser = async function(){
  const msg = $id("login-message"); clearMessage(msg);
  const email = getInputValue($id("loginEmail"));
  const password = getInputValue($id("loginPassword"));
  const btn = $id("login-btn");

  if(!email) return showMessage(msg,"Enter email");
  if(!password) return showMessage(msg,"Enter password");

  try{
    setLoading(btn,true,"Logging in...");
    const cred = await signInWithEmailAndPassword(auth,email,password);
    const snap = await getDoc(doc(db,"users",cred.user.uid));
    const userData = snap.exists()? snap.data(): null;

    if(!userData) return showMessage(msg,"User record not found","error");

    // Update online status
    await updateDoc(doc(db,"users",cred.user.uid), {online:true});

    if(userData.role==="admin") location.href="admin-dashboard.html";
    else location.href="user-chat.html";
  }catch(err){
    console.error(err);
    showMessage(msg,"Login failed: "+(err.message||""),"error");
  }finally{ setLoading(btn,false); }
};

// ============================
// LOGOUT
// ============================
window.logoutUser = async function(){
  const user = auth.currentUser;
  if(user) await updateDoc(doc(db,"users",user.uid), {online:false});
  await signOut(auth);
  location.href="login.html";
};

// ============================
// FORGOT PASSWORD
// ============================
window.forgotPassword = async function(){
  let email = getInputValue($id("loginEmail"));
  if(!email) email = prompt("Enter email for reset:");
  if(!email) return;
  try{
    await sendPasswordResetEmail(auth,email.trim());
    alert("Password reset email sent");
  }catch(err){ console.error(err); alert("Failed to send reset email"); }
};

// ============================
// AUTH GUARD
// ============================
onAuthStateChanged(auth, async user=>{
  if(!user) return;
  try{
    const snap = await getDoc(doc(db,"users",user.uid));
    if(!snap.exists()) return;

    // Redirect non-admin from admin pages
    if(location.pathname.includes("admin") && snap.data().role!=="admin"){
      alert("Unauthorized"); location.href="login.html";
    }
  }catch(err){ console.error(err); }
});

// ============================
// ADMIN USERS
// ============================
window.loadUsers = async function(){
  const usersList = $id("usersList"); if(!usersList) return;
  try{
    const snap = await getDocs(collection(db,"users"));
    usersList.innerHTML="";
    snap.forEach(d=>{
      const u = d.data();
      if(u.role==="admin") return;
      const li = document.createElement("li");
      li.textContent = u.username||u.email;
      li.style.cursor="pointer";
      li.onclick = ()=> openChat(d.id,u.username||u.email);
      usersList.appendChild(li);
    });
  }catch(err){ console.error(err); }
};
loadUsers();

// ============================
// ADMIN CHAT
// ============================
let activeUserId=null, unsubscribeMessages=null;
const messagesBox = $id("adminMessages");
const msgInput = $id("adminMessageInput");
const sendBtn = $id("adminSendBtn");
const fileInput = $id("adminFileInput");
const fileBtn = $id("adminFileBtn");

window.openChat = function(uid,username){
  activeUserId = uid;
  $id("adminChatTitle").textContent=username;
  if(messagesBox) messagesBox.innerHTML="";
  if(typeof unsubscribeMessages==="function") unsubscribeMessages();

  const q = query(collection(db,"messages"),orderBy("createdAt"));
  unsubscribeMessages = onSnapshot(q,snap=>{
    if(!messagesBox) return;
    messagesBox.innerHTML="";
    snap.forEach(d=>{
      const m=d.data();
      const me = auth.currentUser?.uid;
      if(!me) return;
      if((m.senderId===me && m.receiverId===uid)||(m.senderId===uid && m.receiverId===me)){
        const div = document.createElement("div");
        div.textContent=m.text||"";
        div.className = m.senderId===me?"msg admin":"msg user";
        if(m.imageUrl){
          const img = document.createElement("img");
          img.src=m.imageUrl;
          div.appendChild(img);
        }
        messagesBox.appendChild(div);
        messagesBox.scrollTop=messagesBox.scrollHeight;
      }
    });
  });

  if(msgInput) msgInput.disabled=false;
  if(sendBtn) sendBtn.disabled=false;
  if(fileBtn) fileBtn.disabled=false;
};

// Send text message (admin)
sendBtn?.addEventListener("click", async()=>{
  const text = getInputValue(msgInput);
  if(!text || !activeUserId || !auth.currentUser) return;
  await addDoc(collection(db,"messages"),{
    senderId:auth.currentUser.uid,
    receiverId:activeUserId,
    text,
    imageUrl:null,
    createdAt:serverTimestamp()
  });
  if(msgInput) msgInput.value="";
});

// Send file message (admin)
fileBtn?.addEventListener("click",()=>fileInput?.click());
fileInput?.addEventListener("change",async()=>{
  const file = fileInput.files?.[0];
  if(!file || !activeUserId || !auth.currentUser) return;
  const storageRef = ref(storage, `chat/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef,file);
  const url = await getDownloadURL(storageRef);
  await addDoc(collection(db,"messages"),{
    senderId:auth.currentUser.uid,
    receiverId:activeUserId,
    text:null,
    imageUrl:url,
    createdAt:serverTimestamp()
  });
  fileInput.value="";
});

// ============================
// USER CHAT
// ============================
const userMsgInput = $id("userMessageInput");
const userSendBtn = $id("userSendBtn");
const userFileInput = $id("userFileInput");
const userFileBtn = $id("userFileBtn");
const userMessagesBox = $id("userMessages");

function loadUserChat(){
  if(!userMessagesBox) return;
  const me = auth.currentUser?.uid;
  if(!me) return;
  const q = query(collection(db,"messages"),orderBy("createdAt"));
  onSnapshot(q,snap=>{
    if(!userMessagesBox) return;
    userMessagesBox.innerHTML="";
    snap.forEach(d=>{
      const m=d.data();
      if((m.senderId===me && m.receiverId==="admin")||(m.senderId==="admin" && m.receiverId===me)){
        const div = document.createElement("div");
        div.textContent=m.text||"";
        div.className=m.senderId===me?"msg user":"msg admin";
        if(m.imageUrl){
          const img = document.createElement("img");
          img.src=m.imageUrl;
          div.appendChild(img);
        }
        userMessagesBox.appendChild(div);
        userMessagesBox.scrollTop=userMessagesBox.scrollHeight;
      }
    });
  });
}

userSendBtn?.addEventListener("click",async()=>{
  const text = getInputValue(userMsgInput);
  if(!text || !auth.currentUser) return;
  await addDoc(collection(db,"messages"),{
    senderId:auth.currentUser.uid,
    receiverId:"admin",
    text,
    imageUrl:null,
    createdAt:serverTimestamp()
  });
  if(userMsgInput) userMsgInput.value="";
});

userFileBtn?.addEventListener("click",()=>userFileInput?.click());
userFileInput?.addEventListener("change",async()=>{
  const file = userFileInput.files?.[0];
  if(!file || !auth.currentUser) return;
  const storageRef = ref(storage, `chat/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef,file);
  const url = await getDownloadURL(storageRef);
  await addDoc(collection(db,"messages"),{
    senderId:auth.currentUser.uid,
    receiverId:"admin",
    text:null,
    imageUrl:url,
    createdAt:serverTimestamp()
  });
  userFileInput.value="";
});

// ============================
// ADMIN COURSES
// ============================
window.loadCourses = async function(){
  const coursesList = $id("coursesList"); if(!coursesList) return;
  const snap = await getDocs(collection(db,"courses"));
  coursesList.innerHTML="";
  snap.forEach(d=>{
    const c=d.data();
    const li = document.createElement("li");
    li.textContent=c.title;
    li.style.cursor="pointer";
    li.onclick = async()=>{
      const newTitle = prompt("Edit course",c.title);
      if(!newTitle) return;
      await updateDoc(doc(db,"courses",d.id),{title:newTitle});
      loadCourses();
    };
    const del = document.createElement("button");
    del.textContent="Delete";
    del.onclick=async(e)=>{
      e.stopPropagation();
      await deleteDoc(doc(db,"courses",d.id));
      loadCourses();
    };
    li.appendChild(del);
    coursesList.appendChild(li);
  });
};

window.addCourse = async function(){
  const title = prompt("Enter course title");
  if(!title) return;
  await addDoc(collection(db,"courses"),{title});
  loadCourses();
};

// ============================
// ADMIN SUBSCRIPTIONS
// ============================
window.loadSubscriptions = async function(){
  const subsList = $id("subscriptionsList"); if(!subsList) return;
  const snap = await getDocs(collection(db,"subscriptions"));
  subsList.innerHTML="";
  snap.forEach(d=>{
    const s=d.data();
    const li = document.createElement("li");
    li.textContent=s.name+" - "+s.price;
    li.style.cursor="pointer";
    li.onclick = async()=>{
      const newName = prompt("Edit name",s.name);
      if(!newName) return;
      const newPrice = prompt("Edit price",s.price);
      if(!newPrice) return;
      await updateDoc(doc(db,"subscriptions",d.id),{name:newName,price:newPrice});
      loadSubscriptions();
    };
    const del = document.createElement("button");
    del.textContent="Delete";
    del.onclick=async(e)=>{
      e.stopPropagation();
      await deleteDoc(doc(db,"subscriptions",d.id));
      loadSubscriptions();
    };
    li.appendChild(del);
    subsList.appendChild(li);
  });
};

window.addSubscription = async function(){
  const name = prompt("Subscription name");
  if(!name) return;
  const price = prompt("Price");
  if(!price) return;
  await addDoc(collection(db,"subscriptions"),{name,price});
  loadSubscriptions();
};
