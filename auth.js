// ==========================
// 🔹 IMPORT FIREBASE
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  sendPasswordResetEmail, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// ==========================
// 🔹 REGISTER USER
// ==========================
export async function registerUser(e) {
  e.preventDefault();
  const username = document.getElementById("regUsername")?.value.trim();
  const email = document.getElementById("regEmail")?.value.trim();
  const password = document.getElementById("regPassword")?.value.trim();
  const confirm = document.getElementById("regConfirmPassword")?.value.trim();
  const msg = document.getElementById("register-message");

  if(!username || !email || !password || !confirm){
    msg.className="error"; msg.innerText="All fields are required"; return;
  }
  if(password !== confirm){
    msg.className="error"; msg.innerText="Passwords do not match"; return;
  }

  try{
    const userCred = await createUserWithEmailAndPassword(auth,email,password);
    await setDoc(doc(db,"users",userCred.user.uid),{
      username,
      email,
      role:"user",
      active:false,
      subscription:null,
      createdAt: serverTimestamp()
    });
    msg.className="success"; msg.innerText="Account created!";
    // Optionally, redirect to login
    setTimeout(()=>{ window.location.href="login.html"; },1500);
  } catch(err){
    msg.className="error"; msg.innerText=err.message;
  }
}

// ==========================
// 🔹 LOGIN USER
// ==========================
export async function loginUser(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value.trim();
  const msg = document.getElementById("login-message");

  if(!email || !password){
    msg.className="error"; msg.innerText="Enter email and password"; return;
  }

  try{
    await signInWithEmailAndPassword(auth,email,password);
    const user = auth.currentUser;
    const docSnap = await getDoc(doc(db,"users",user.uid));

    if(docSnap.exists()){
      const role = docSnap.data().role;
      msg.className="success"; msg.innerText="Login successful!";
      setTimeout(()=>{
        if(role==="admin") window.location.href="admin-dashboard.html";
        else window.location.href="user-chat.html";
      }, 1000);
    } else {
      msg.className="error"; msg.innerText="User not found!";
    }
  } catch(err){
    msg.className="error"; msg.innerText=err.message;
  }
}

// ==========================
// 🔹 FORGOT PASSWORD
// ==========================
export async function forgotPassword() {
  const email = document.getElementById("loginEmail")?.value.trim();
  if(!email) return alert("Enter your email to reset password");

  try{
    await sendPasswordResetEmail(auth,email);
    alert("Password reset email sent!");
  } catch(err){
    alert(err.message);
  }
}

// ==========================
// 🔹 TOGGLE PASSWORD VISIBILITY
// ==========================
export function togglePassword(id, toggleId){
  const input = document.getElementById(id);
  const btn = document.getElementById(toggleId);
  if(input.type === "password"){
    input.type = "text";
    btn.innerText = "🙈";
  } else {
    input.type = "password";
    btn.innerText = "👁️";
  }
}

// ==========================
// 🔹 LOGOUT
// ==========================
export async function logoutUser() {
  await signOut(auth);
  window.location.href = "login.html";
}
