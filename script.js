// ============================================================
// Firebase Configuration
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ⚠️ استبدل هذا بإعدادات مشروعك من Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// ============================================================
// كلمة مرور الأدمن
// ============================================================
const ADMIN_PASSWORD = "AH219##";

// ============================================================
// عناصر DOM
// ============================================================
const secretTrigger = document.getElementById("secretTrigger");
const loginModal = document.getElementById("loginModal");
const adminPanel = document.getElementById("adminPanel");
const adminPassword = document.getElementById("adminPassword");
const loginBtn = document.getElementById("loginBtn");
const cancelLogin = document.getElementById("cancelLogin");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const closeAdmin = document.getElementById("closeAdmin");
const projectsGrid = document.getElementById("projectsGrid");

// ============================================================
// 🕵️ الزر المخفي (نقرة مزدوجة أو 5 نقرات)
// ============================================================
let clickCount = 0;
let clickTimer = null;

// نقرة مزدوجة سريعة
secretTrigger.addEventListener("dblclick", (e) => {
  e.stopPropagation();
  openLoginModal();
});

// أو 5 نقرات متتالية
secretTrigger.addEventListener("click", (e) => {
  e.stopPropagation();
  clickCount++;
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => { clickCount = 0; }, 2000);
  if (clickCount >= 5) {
    clickCount = 0;
    openLoginModal();
  }
});

// ============================================================
// ⌨️ الوصول السري: اكتب "219" بالكيبورد
// اضغط * للبدء من جديد في حال الخطأ
// ============================================================
let typedBuffer = "";
let typedTimer = null;

document.addEventListener("keydown", (e) => {
  // تجاهل الاختصارات (Ctrl, Alt, Shift, Meta)
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  // إذا كان المستخدم يكتب في حقل إدخال، لا نتدخل
  const tag = document.activeElement.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") return;

  // ⭐ إذا ضغط * → صفّر البافر وابدأ من جديد
  if (e.key === "*" || e.key === "ذ" || e.key === "×") {
    typedBuffer = "";
    clearTimeout(typedTimer);
    return;
  }

  // أضف الأرقام فقط
  if (e.key.length === 1 && /[0-9]/.test(e.key)) {
    typedBuffer += e.key;

    // احتفظ بآخر 10 أرقام فقط
    if (typedBuffer.length > 10) {
      typedBuffer = typedBuffer.slice(-10);
    }

    // تحقق من وجود "219"
    if (typedBuffer.includes("219")) {
      typedBuffer = "";
      openLoginModal();
      return;
    }

    // صفّر البافر بعد 5 ثوانٍ من السكون
    clearTimeout(typedTimer);
    typedTimer = setTimeout(() => { typedBuffer = ""; }, 5000);
  }
});

// ============================================================
// فتح نافذة تسجيل الدخول
// ============================================================
function openLoginModal() {
  loginModal.classList.remove("hidden");
  adminPassword.value = "";
  loginError.classList.add("hidden");
  setTimeout(() => adminPassword.focus(), 100);
}

// ============================================================
// تسجيل دخول الأدمن
// ============================================================
loginBtn.addEventListener("click", handleLogin);
adminPassword.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleLogin();
});

function handleLogin() {
  if (adminPassword.value === ADMIN_PASSWORD) {
    sessionStorage.setItem("adminLogged", "1");
    loginModal.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    loadAdminProjects();
  } else {
    loginError.classList.remove("hidden");
  }
}

cancelLogin.addEventListener("click", () => loginModal.classList.add("hidden"));
closeAdmin.addEventListener("click", () => adminPanel.classList.add("hidden"));
logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("adminLogged");
  adminPanel.classList.add("hidden");
});

// ============================================================
// عرض الشعار
// ============================================================
async function loadLogo() {
  try {
    const q = await getDocs(collection(db, "settings"));
    q.forEach(d => {
      if (d.id === "logo" && d.data().url) {
        const img = document.getElementById("siteLogo");
        img.src = d.data().url;
        img.style.display = "block";
        document.querySelector(".logo-text").style.display = "none";
      }
    });
  } catch (err) { console.warn("لا يوجد شعار بعد", err); }
}

// رفع الشعار
document.getElementById("saveLogo").addEventListener("click", async () => {
  const file = document.getElementById("logoUpload").files[0];
  if (!file) return alert("اختر صورة الشعار أولاً");

  const storageRef = ref(storage, `settings/logo_${Date.now()}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  // حذف الشعار القديم
  const old = await getDocs(collection(db, "settings"));
  for (const d of old.docs) { if (d.id === "logo") await deleteDoc(d.ref); }

  await setDoc(doc(db, "settings", "logo"), { url });
  alert("تم حفظ الشعار ✅");
  location.reload();
});

// ============================================================
// عرض المشاريع
// ============================================================
async function loadProjects() {
  projectsGrid.innerHTML = "";
  const snap = await getDocs(collection(db, "projects"));

  if (snap.empty) {
    projectsGrid.innerHTML = `
      <p style="grid-column:1/-1; text-align:center; color:#fff; opacity:.7; padding:40px;">
        لا توجد مشاريع معروضة حالياً
      </p>`;
    return;
  }

  snap.forEach(d => {
    const p = d.data();
    const card = document.createElement("div");
    card.className = "project-card";
    card.innerHTML = `
      <img src="${p.image}" alt="${p.title}" loading="lazy">
      <div class="project-info">
        <h3>${p.title}</h3>
        <p>${p.description || ""}</p>
      </div>
    `;
    card.addEventListener("click", () => openLightbox(p.image));
    projectsGrid.appendChild(card);
  });
}

// Lightbox
function openLightbox(src) {
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.innerHTML = `<span class="close">&times;</span><img src="${src}">`;
  lb.addEventListener("click", () => lb.remove());
  document.body.appendChild(lb);
}

// ============================================================
// لوحة الأدمن - إدارة المشاريع
// ============================================================
document.getElementById("addProject").addEventListener("click", async () => {
  const title = document.getElementById("projTitle").value.trim();
  const description = document.getElementById("projDesc").value.trim();
  const files = document.getElementById("projImage").files;

  if (!title || files.length === 0) return alert("أدخل الاسم والصورة على الأقل");

  for (const file of files) {
    const storageRef = ref(storage, `projects/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await addDoc(collection(db, "projects"), {
      title, description, image: url, createdAt: Date.now()
    });
  }

  alert("تم إضافة المشروع ✅");
  document.getElementById("projTitle").value = "";
  document.getElementById("projDesc").value = "";
  document.getElementById("projImage").value = "";
  loadProjects();
  loadAdminProjects();
});

async function loadAdminProjects() {
  const list = document.getElementById("adminProjectsList");
  list.innerHTML = "";
  const snap = await getDocs(collection(db, "projects"));

  if (snap.empty) {
    list.innerHTML = `<p style="text-align:center; color:#666;">لا توجد مشاريع بعد</p>`;
    return;
  }

  snap.forEach(d => {
    const p = d.data();
    const item = document.createElement("div");
    item.className = "admin-project-item";
    item.innerHTML = `<span>${p.title}</span><button data-id="${d.id}">حذف</button>`;
    item.querySelector("button").addEventListener("click", async () => {
      if (confirm("تأكيد الحذف؟")) {
        await deleteDoc(doc(db, "projects", d.id));
        loadProjects();
        loadAdminProjects();
      }
    });
    list.appendChild(item);
  });
}

// ============================================================
// بدء التشغيل
// ============================================================
loadLogo();
loadProjects();