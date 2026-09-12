import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signOut,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2yOp5b52HLCo0LTKZWeGCw6ZFdVJOlWU",
  authDomain: "test-class-31357.firebaseapp.com",
  projectId: "test-class-31357",
  storageBucket: "test-class-31357.firebasestorage.app",
  messagingSenderId: "727597155281",
  appId: "1:727597155281:web:1b6e321c44d0927f5396f0",
  measurementId: "G-70HWR0KJ8L"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const TEACHER_UIDS = new Set(["TEACHER_UID_1", "TEACHER_UID_2"]);

const wall = document.getElementById("wall");
const input = document.getElementById("input");
const userArea = document.getElementById("userArea");
const loginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("signOutBtn");
let isListening = false;
let memoUnsubscribe = null;
let legacyChecked = false;
let authReadyResolve = null;
let currentRole = "student";
let currentUserUid = "";
const authReady = new Promise((resolve) => {
  authReadyResolve = resolve;
});

function setStatus(message) {
  if (userArea) userArea.textContent = message;
}

function getUserRoleFromAuth(user) {
  if (!user) return "guest";
  if (TEACHER_UIDS.has(user.uid)) return "teacher";
  return "student";
}

function updateAuthUi(isSignedIn) {
  if (loginBtn) loginBtn.style.display = isSignedIn ? "none" : "inline-flex";
  if (logoutBtn) logoutBtn.style.display = isSignedIn ? "inline-flex" : "none";
}

async function handleGoogleLogin() {
  try {
    setStatus("Google 로그인 중...");
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error.code === "auth/popup-blocked" || error.code === "auth/popup-closed-by-user") {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr) {
        console.error("Google 리다이렉트 로그인 실패:", redirectErr);
        setStatus(`로그인 실패 (${redirectErr.code || redirectErr.message})`);
      }
      return;
    }

    console.error("Google 로그인 실패:", error);
    setStatus(`로그인 실패 (${error.code || error.message})`);
  }
}

async function handleSignOut() {
  try {
    await signOut(auth);
    setStatus("로그아웃 되었습니다.");
  } catch (error) {
    console.error("로그아웃 실패:", error);
    setStatus(`로그아웃 실패 (${error.code || error.message})`);
  }
}

function toMillis(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return Number(value) || 0;
}

function makeMemo(memoDoc) {
  const data = memoDoc.data();
  const div = document.createElement("div");
  div.className = "memo";

  const del = document.createElement("button");
  del.textContent = "삭제";
  del.type = "button";
  del.addEventListener("click", async () => {
    try {
      await deleteDoc(doc(db, "memos", memoDoc.id));
      setStatus("삭제 완료");
    } catch (error) {
      console.error("메모 삭제 실패:", error);
      setStatus(`삭제 실패 (${error.code || error.message})`);
    }
  });
  div.appendChild(del);

  const span = document.createElement("span");
  span.textContent = data.text ?? "";
  div.appendChild(span);

  return div;
}

function render(snapshot) {
  if (!wall) return;

  renderFromDocs(snapshot.docs);
}

function renderFromDocs(docs) {
  if (!wall) return;

  const list = [...docs]
    .slice()
    .sort((a, b) => {
      const t1 = toMillis(a.data().createdAt);
      const t2 = toMillis(b.data().createdAt);
      return t1 - t2;
    });

  wall.innerHTML = "";
  list.forEach((memoDoc) => {
    wall.appendChild(makeMemo(memoDoc));
  });
}

async function loadLegacyMemoIfEmpty(snapshot) {
  if (legacyChecked) return;
  legacyChecked = true;

  try {
    const legacySnap = await getDocs(collection(db, "memo"));
    if (legacySnap.empty) return;

    const merged = [...snapshot.docs, ...legacySnap.docs];
    if (merged.length === 0) return;
    setStatus("Firebase 연결 완료 (기존 memo 컬렉션도 표시)");
    renderFromDocs(merged);
  } catch (error) {
    console.error("기존 memo 컬렉션 조회 실패:", error);
  }
}

async function startListening() {
  if (isListening) return;
  try {
    memoUnsubscribe = onSnapshot(
      collection(db, "memos"),
      (snapshot) => {
        console.debug("memos 구독 문서 수:", snapshot.size);
        if (snapshot.empty) {
          setStatus("메모가 없습니다.");
          loadLegacyMemoIfEmpty(snapshot);
        } else {
          setStatus("Firebase 연결 완료");
        }
        render(snapshot);
      },
      (error) => {
        console.error("Firestore 구독 실패:", error);
        setStatus(`메모 불러오기 실패 (${error.code || error.message})`);
      }
    );
    isListening = true;
  } catch (error) {
    console.error("Firestore 초기화 실패:", error);
    setStatus("Firestore 연결 실패: 설정 또는 보안 규칙을 확인해 주세요.");
  }
}

function stopListening() {
  if (memoUnsubscribe) {
    memoUnsubscribe();
    memoUnsubscribe = null;
  }
  isListening = false;
}

function clearWall() {
  if (wall) {
    wall.innerHTML = "";
  }
  setStatus("메모가 비어 있습니다.");
}

async function addMemo(text) {
  await authReady;
  if (!auth.currentUser) {
    throw new Error("로그인이 필요합니다. Google 로그인 후 다시 시도해 주세요.");
  }

  if (text.length < 5 || text.length > 50) {
    throw new Error("메모는 5자 이상 50자 이하로 입력해 주세요.");
  }

  await addDoc(collection(db, "memos"), {
    text,
    createdAt: serverTimestamp(),
    ownerUid: auth.currentUser.uid,
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const role = getUserRoleFromAuth(user);
    currentRole = role;
    currentUserUid = user.uid;
    authReadyResolve();
    updateAuthUi(true);
    setStatus(`로그인 상태: ${user.displayName ?? user.email ?? "Google 사용자"} (${role})`);
    startListening();
  } else {
    authReadyResolve();
    updateAuthUi(false);
    stopListening();
    clearWall();
    setStatus("Google 로그인 필요");
    if (input) input.value = "";
  }
});

loginBtn?.addEventListener("click", handleGoogleLogin);
logoutBtn?.addEventListener("click", handleSignOut);

getRedirectResult(auth).catch((error) => {
  console.error("Google 리디렉트 결과 처리 실패:", error);
});

updateAuthUi(false);

startListening();

input?.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter" || e.shiftKey) return;

  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  const backup = input.value;
  input.value = "";

  try {
    await addMemo(text);
    setStatus("저장 완료");
  } catch (error) {
    input.value = backup;
    console.error("메모 저장 실패:", error);
    if (error.code === "permission-denied") {
      setStatus("저장 실패: Firestore 쓰기 권한 없음(규칙/배포 확인)");
      return;
    }
    if (error.message === "로그인이 필요합니다. Google 로그인 후 다시 시도해 주세요.") {
      setStatus(error.message);
      return;
    }
    setStatus(`저장 실패 (${error.code || error.message})`);
  }

  input.focus();
});

if (input) input.focus();
