// ============================
// app.js - Full Admin + Auth + Chat
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
// Helper Functions
// ============================
function $id(id){ return document.getElementById(id); }
function getInputValue(el){ return (el && el.value) ? el.value.trim() : ""; }
function setLoading(btn, loading, text="Loading..."){
  if(!btn) return;
  if(loading){
    if(!btn.dataset.origText) btn.dataset.origText = btn.textContent || "";
    btn.disabled = true;
    btn.textContent = btn.dataset.loadingText || text;
  } else {
    if(btn.dataset.origText !== undefined) btn.textContent = btn.dataset.origText;
    btn.disabled = false;
  }
}

// ============================
// Registration
// ============================
window.registerUser = async function(){
  const msg = $id("register-message");
  const username = getInputValue($id("regUsername"));
  const email = getInputValue($id("regEmail"));
  const password = getInputValue($id("regPassword"));
  const confirm = getInputValue($id("regConfirmPassword"));
  const btn = $id("register-btn");

  if(!email) return msg.textContent = "Enter email";
  if(!password) return msg.textContent = "Enter password";
  if(password !== confirm) return msg.textContent = "Passwords do not match";

  try{
    setLoading(btn,true);
    const cred = await createUserWithEmailAndPassword(auth,email,password);
    const user = cred.user;

    // Set default role & subscription
    await setDoc(doc(db,"users",user.uid),{
      username: username || email.split("@")[0],
      email,
      role:"user",
      subscription:null,
      createdAt:serverTimestamp(),
      online:false,
      unreadForAdmin:0
    });

    msg.textContent = "Account created. Redirecting to login...";
    setTimeout(()=> location.href="login.html",700);
  } catch(err){
    console.error(err);
    msg.textContent = err.message || "Registration failed";
  } finally { setLoading(btn,false); }
}

// ============================
// Login
// ============================
window.loginUser = async function(){
  const msg = $id("login-message");
  const email = getInputValue($id("loginEmail"));
  const password = getInputValue($id("loginPassword"));
  const btn = $id("login-btn");

  if(!email) return msg.textContent = "Enter email";
  if(!password) return msg.textContent = "Enter password";

  try{
    setLoading(btn,true);
    const cred = await signInWithEmailAndPassword(auth,email,password);
    const snap = await getDoc(doc(db,"users",cred.user.uid));
    const userData = snap.exists()? snap.data() : null;

    // Update online status
    await updateDoc(doc(db,"users",cred.user.uid),{online:true});

    if(userData?.role === "admin") location.href="admin-dashboard.html";
    else location.href="user-chat.html";
  } catch(err){
    console.error(err);
    msg.textContent = "Login failed: "+(err.message||"");
  } finally { setLoading(btn,false); }
}

// ============================
// Logout
// ============================
window.logoutUser = async function(){
  if(auth.currentUser){
    await updateDoc(doc(db,"users",auth.currentUser.uid),{online:false});
    await signOut(auth);
  }
  location.href="login.html";
}

// ============================
// Auth Guard
// ============================
onAuthStateChanged(auth,async(user)=>{
  if(!user) return;
  const snap = await getDoc(doc(db,"users",user.uid));
  if(!snap.exists()) return;
  const data = snap.data();

  // Redirect non-admin from admin pages
  if(location.pathname.includes("admin") && data.role!=="admin") location.href="login.html";
});

// ============================
// ADMIN CHAT USERS
// ============================
let activeUserId = null;
let unsubscribeMessages = null;
const messagesBox = $id("adminMessages");
const msgInput = $id("adminMessageInput");
const sendBtn = $id("adminSendBtn");
const fileInput = $id("adminFileInput");
const usersList = $id("usersList");

export function loadAdminChatUsersRealtime(){
  onSnapshot(collection(db,"users"),snap=>{
    usersList.innerHTML = "";
    snap.forEach(d=>{
      const u = d.data();
      if(u.role==="admin") return;

      const li = document.createElement("li");
      li.style.cursor="pointer";

      const unread = u.unreadForAdmin || 0;
      li.textContent = u.username || u.email;
      if(unread>0) li.textContent += ` (${unread})`;

      li.onclick = ()=> openChat(d.id,u.username||u.email);
      usersList.appendChild(li);
    });
  });
}
loadAdminChatUsersRealtime();

export async function openChat(userId,username){
  activeUserId=userId;
  $id("adminChatTitle").textContent=username;
  if(messagesBox) messagesBox.innerHTML="";
  msgInput.disabled=false;
  sendBtn.disabled=false;

  // Clear unread for admin
  await updateDoc(doc(db,"users",userId),{unreadForAdmin:0});

  if(typeof unsubscribeMessages==="function") unsubscribeMessages();

  const q=query(collection(db,"messages"),orderBy("createdAt"));
  unsubscribeMessages = onSnapshot(q,snap=>{
    if(!messagesBox) return;
    messagesBox.innerHTML="";
    snap.forEach(d=>{
      const m=d.data();
      if((m.senderId===auth.currentUser.uid && m.receiverId===userId) ||
         (m.senderId===userId && m.receiverId===auth.currentUser.uid)){
          const div=document.createElement("div");
          div.textContent=m.text||"";
          div.className=m.senderId===auth.currentUser.uid?"msg admin":"msg user";

          if(m.imageUrl){
            const img=document.createElement("img");
            img.src=m.imageUrl;
            img.style.maxWidth="200px";
            div.appendChild(img);
          }
          messagesBox.appendChild(div);
          messagesBox.scrollTop=messagesBox.scrollHeight;
      }
    });
  });
}

sendBtn?.addEventListener("click",async()=>{
  const text=getInputValue(msgInput);
  if(!text || !activeUserId || !auth.currentUser) return;

  await addDoc(collection(db,"messages"),{
    senderId:auth.currentUser.uid,
    receiverId:activeUserId,
    text,
    imageUrl:null,
    createdAt:serverTimestamp()
  });

  msgInput.value="";
});

fileInput?.addEventListener("change",async()=>{
  const file=fileInput.files?.[0];
  if(!file || !activeUserId || !auth.currentUser) return;

  const storageRef=ref(storage,`chat/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef,file);
  const url=await getDownloadURL(storageRef);

  await addDoc(collection(db,"messages"),{
    senderId:auth.currentUser.uid,
    receiverId:activeUserId,
    text:null,
    imageUrl:url,
    createdAt:serverTimestamp()
  });

  fileInput.value="";
});
