// ============================
// app.js - Full Admin + Auth + Chat + Courses + Subscriptions
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
  doc, setDoc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ============================
// Helpers
// ============================
function $id(id){ return document.getElementById(id); }
function getInputValue(el){ return el ? el.value.trim() : ""; }
function showMessage(container, text, type="error"){
  if(!container) return;
  container.textContent = text;
  container.className = "";
  container.classList.add(type);
}
function clearMessage(container){
  if(!container) return;
  container.textContent="";
  container.className="";
}
function setLoading(btn, loading, text="Loading..."){
  if(!btn) return;
  if(loading){
    if(!btn.dataset.origText) btn.dataset.origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = btn.dataset.loadingText || text;
  } else {
    if(btn.dataset.origText) btn.textContent = btn.dataset.origText;
    btn.disabled = false;
  }
}

// ============================
// Registration
// ============================
window.registerUser = async function(){
  const msg = $id("register-message"); clearMessage(msg);
  const username = getInputValue($id("regUsername"));
  const email = getInputValue($id("regEmail"));
  const password = getInputValue($id("regPassword"));
  const confirm = getInputValue($id("regConfirmPassword"));
  const btn = $id("register-btn");

  if(!email) return showMessage(msg,"Enter email");
  if(!password) return showMessage(msg,"Enter password");
  if(password !== confirm) return showMessage(msg,"Passwords do not match");

  try{
    setLoading(btn,true,"Creating account...");
    const cred = await createUserWithEmailAndPassword(auth,email,password);
    const user = cred.user;

    // first user becomes admin
    const meta = doc(db,"meta","admin");
    const metaSnap = await getDoc(meta);
    let role="user";
    if(!metaSnap.exists()){
      role="admin";
      await setDoc(meta,{created:true});
    }

    await setDoc(doc(db,"users",user.uid),{
      username:username||email.split("@")[0],
      email,
      role,
      courses: [],
      subscriptions: [],
      createdAt:serverTimestamp(),
      online:true
    });

    showMessage(msg,"Account created! Redirecting...", "success");
    setTimeout(()=> location.href="login.html",700);
  }catch(err){
    console.error(err);
    showMessage(msg, err.message || "Registration failed");
  } finally{ setLoading(btn,false); }
};

// ============================
// Login
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
    const userData = snap.exists() ? snap.data() : null;

    if(userData?.role==="admin") location.href="admin-dashboard.html";
    else location.href="user-chat.html";
  }catch(err){
    console.error(err);
    showMessage(msg,"Login failed: "+(err.message||""));
  }finally{ setLoading(btn,false); }
};

// ============================
// Logout
// ============================
window.logoutUser = async function(){
  try{ await signOut(auth); } catch(err){ console.error(err);}
  location.href="login.html";
};

// ============================
// Forgot Password
// ============================
window.forgotPassword = async function(){
  let email = getInputValue($id("loginEmail"));
  if(!email) email = prompt("Enter your email");
  if(!email) return;
  try{
    await sendPasswordResetEmail(auth,email.trim());
    alert("Password reset email sent (if account exists).");
  }catch(err){ console.error(err); alert("Failed to send reset email"); }
};

// ============================
// Auth Guard
// ============================
onAuthStateChanged(auth, async (user)=>{
  if(!user) return;
  try{
    const snap = await getDoc(doc(db,"users",user.uid));
    if(!snap.exists()) return;
    if(location.pathname.includes("admin") && snap.data().role!=="admin"){
      alert("Unauthorized");
      location.href="login.html";
    }
    // update online status
    await updateDoc(doc(db,"users",user.uid),{online:true});
    window.addEventListener("beforeunload", async ()=>{
      await updateDoc(doc(db,"users",user.uid),{online:false});
    });
  }catch(err){ console.error(err); }
});

// ============================
// ADMIN & USER CHAT
// ============================
let activeChatId=null;
let unsubscribe=null;

window.openChat = async function(uid,username){
  activeChatId=uid;
  $id("adminChatTitle").textContent=username;
  if(unsubscribe) unsubscribe();

  const q = query(collection(db,"messages"), orderBy("createdAt"));
  unsubscribe = onSnapshot(q, snap=>{
    const messagesBox = $id("adminMessages") || $id("userMessages");
    if(!messagesBox) return;
    messagesBox.innerHTML="";
    snap.forEach(d=>{
      const m=d.data();
      const me=auth.currentUser?.uid;
      if(!me) return;
      if((m.senderId===me && m.receiverId===uid)||(m.senderId===uid && m.receiverId===me)){
        const div=document.createElement("div");
        div.classList.add("msg");
        if(m.senderId===me) div.classList.add("admin");
        else div.classList.add("user");
        if(m.text) div.textContent=m.text;
        if(m.imageUrl){
          const img=document.createElement("img");
          img.src=m.imageUrl;
          div.appendChild(img);
        }
        messagesBox.appendChild(div);
        messagesBox.scrollTop=messagesBox.scrollHeight;
      }
    });
  });
};

// Send Message (Text)
const sendBtn = $id("adminSendBtn") || $id("userSendBtn");
const msgInput = $id("adminMessageInput") || $id("userMessageInput");
sendBtn?.addEventListener("click", async ()=>{
  const text = getInputValue(msgInput);
  if(!text || !activeChatId || !auth.currentUser) return;
  await addDoc(collection(db,"messages"),{
    senderId:auth.currentUser.uid,
    receiverId:activeChatId,
    text,
    imageUrl:null,
    createdAt:serverTimestamp(),
    read:false
  });
  msgInput.value="";
});

// Send Image
const fileInput = $id("adminFileInput") || $id("userFileInput");
fileInput?.addEventListener("change", async ()=>{
  const file = fileInput.files?.[0];
  if(!file || !activeChatId || !auth.currentUser) return;

  const storageRef = ref(storage, `chat/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef,file);
  const url = await getDownloadURL(storageRef);

  await addDoc(collection(db,"messages"),{
    senderId:auth.currentUser.uid,
    receiverId:activeChatId,
    text:null,
    imageUrl:url,
    createdAt:serverTimestamp(),
    read:false
  });
  fileInput.value="";
});

// ============================
// COURSES MANAGEMENT
// ============================
window.loadCourses = async function(){
  const list = $id("coursesList"); if(!list) return;
  const snap = await getDocs(collection(db,"courses"));
  list.innerHTML="";
  snap.forEach(d=>{
    const c=d.data();
    const li=document.createElement("li");
    li.textContent=c.name;
    li.onclick=()=>editCourse(d.id,c.name);
    list.appendChild(li);
  });
};

window.addCourse = async function(name){
  if(!name) return alert("Enter course name");
  await addDoc(collection(db,"courses"),{name});
  loadCourses();
};
window.editCourse = async function(id,name){
  const newName=prompt("Edit course name",name);
  if(!newName) return;
  await updateDoc(doc(db,"courses",id),{name:newName});
  loadCourses();
};
window.deleteCourse = async function(id){
  if(!confirm("Delete this course?")) return;
  await deleteDoc(doc(db,"courses",id));
  loadCourses();
};

// ============================
// SUBSCRIPTIONS MANAGEMENT
// ============================
window.loadSubscriptions = async function(){
  const list = $id("subscriptionsList"); if(!list) return;
  const snap = await getDocs(collection(db,"subscriptions"));
  list.innerHTML="";
  snap.forEach(d=>{
    const s=d.data();
    const li=document.createElement("li");
    li.textContent=s.name;
    li.onclick=()=>editSubscription(d.id,s.name);
    list.appendChild(li);
  });
};

window.addSubscription = async function(name){
  if(!name) return alert("Enter subscription name");
  await addDoc(collection(db,"subscriptions"),{name});
  loadSubscriptions();
};
window.editSubscription = async function(id,name){
  const newName=prompt("Edit subscription name",name);
  if(!newName) return;
  await updateDoc(doc(db,"subscriptions",id),{name:newName});
  loadSubscriptions();
};
window.deleteSubscription = async function(id){
  if(!confirm("Delete this subscription?")) return;
  await deleteDoc(doc(db,"subscriptions",id));
  loadSubscriptions();
};
