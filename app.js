  if (!username || !email || !password) throw new Error("All fields are required");

  // create auth user
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // check if admin exists
  const adminMetaRef = doc(db, "meta", "admin");
  const adminMetaSnap = await getDoc(adminMetaRef);

  let role = "user";

  if (!adminMetaSnap.exists()) {
    role = "admin";
    await setDoc(adminMetaRef, {
      created: true,
      createdAt: serverTimestamp()
    });
  }

  await setDoc(doc(db, "users", user.uid), {
    username,
    email,
    role,
    active: true,
    createdAt: serverTimestamp()
  });

  return { uid: user.uid, role };
}

/* ===========================
   LOGIN
=========================== */
export async function loginUser(email, password) {
  if (!email || !password) throw new Error("Email and password required");

  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) throw new Error("User record not found");

  const role = userSnap.data().role;

  return { uid, role };
}

/* ===========================
   LOGOUT
=========================== */
export async function logoutUser() {
  await signOut(auth);
}

/* ===========================
   FORGOT PASSWORD
=========================== */
export async function forgotPassword(email) {
  if (!email) throw new Error("Email required");
  await sendPasswordResetEmail(auth, email);
}

/* ===========================
   AUTH GUARD
=========================== */
export function adminGuard(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;

    const role = snap.data().role;
    if (role !== "admin") {
      alert("Unauthorized access");
      window.location.href = "login.html";
    } else {
      if (callback) callback(user, snap.data());
    }
  });
}

/* ===========================
   CHAT (ADMIN)
=========================== */
export function adminLoadUsers(callback) {
  const usersRef = collection(db, "users");
  getDocs(usersRef).then(snap => {
    const users = [];
    snap.forEach(doc => {
      if (doc.data().role !== "admin") users.push({ id: doc.id, ...doc.data() });
    });
    callback(users);
  });
}

export function adminSetChatUser(userId, onMessages) {
  const chatRef = collection(db, "messages");
  const q = query(chatRef, orderBy("createdAt", "asc"));

  getDocs(q).then(snap => {
    snap.forEach(doc => {
      const msg = doc.data();
      if ((msg.senderId === userId) || (msg.receiverId === userId)) {
        onMessages(msg);
      }
    });
  });
}

export async function adminSendTextMessage(userId, text) {
  await addDoc(collection(db, "messages"), {
    senderId: auth.currentUser.uid,
    receiverId: userId,
    senderRole: "admin",
    text,
    createdAt: serverTimestamp()
  });
}

export async function adminSendImageMessage(userId, file) {
  const fileRef = ref(storage, `chats/${Date.now()}_${file.name}`);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);

  await addDoc(collection(db, "messages"), {
    senderId: auth.currentUser.uid,
    receiverId: userId,
    senderRole: "admin",
    imageUrl: url,
    createdAt: serverTimestamp()
  });
}

/* ===========================
   NOTIFICATIONS
=========================== */
export async function loadNotifications(callback) {
  const notifRef = collection(db, "notifications");
  const q = query(notifRef, orderBy("createdAt", "desc"));

  const snap = await getDocs(q);
  const notifications = [];
  snap.forEach(doc => {
    notifications.push({ id: doc.id, ...doc.data() });
  });
  callback(notifications);
}

/* ===========================
   COURSES (PLACEHOLDER)
=========================== */
export async function loadCourses(callback) {
  const snap = await getDocs(collection(db, "courses"));
  const courses = [];
  snap.forEach(doc => courses.push({ id: doc.id, ...doc.data() }));
  callback(courses);
}

export async function addCourse(data) {
  await addDoc(collection(db, "courses"), {
    ...data,
    createdAt: serverTimestamp()
  });
}

// ===========================
// DOM wrappers (expose to window so inline onclick works)
// ===========================
if (typeof window !== "undefined") {
  // wrapper that calls the exported loginUser(email,password)
  window.loginUser = async () => {
    const email = document.getElementById("loginEmail")?.value?.trim();
    const password = document.getElementById("loginPassword")?.value;
    if (!email || !password) return alert("Email and password required");
    try {
      const res = await loginUser(email, password); // module function
      // redirect based on role (adjust targets as needed)
      if (res.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "index.html";
      }
    } catch (err) {
      alert(err?.message || String(err));
      console.error(err);
    }
  };

  // wrapper for forgot password
  window.forgotPassword = async () => {
    const email = document.getElementById("loginEmail")?.value?.trim();
    if (!email) return alert("Enter your email to reset password");
    try {
      await forgotPassword(email); // module function
      alert("Password reset email sent");
    } catch (err) {
      alert(err?.message || String(err));
      console.error(err);
    }
  };
}
