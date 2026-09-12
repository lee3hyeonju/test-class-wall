import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
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

const wall = document.getElementById("wall");
const input = document.getElementById("input");
const userArea = document.getElementById("userArea");

function setStatus(message) {
  if (userArea) userArea.textContent = message;
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

  const docs = snapshot.docs
    .slice()
    .sort((a, b) => {
      const t1 = toMillis(a.data().createdAt);
      const t2 = toMillis(b.data().createdAt);
      return t1 - t2;
    });

  wall.innerHTML = "";
  docs.forEach((memoDoc) => {
    wall.appendChild(makeMemo(memoDoc));
  });
}

async function startListening() {
  try {
    onSnapshot(
      collection(db, "memos"),
      (snapshot) => {
        if (snapshot.empty) {
          setStatus("메모가 없습니다.");
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
  } catch (error) {
    console.error("Firestore 초기화 실패:", error);
    setStatus("Firestore 연결 실패: 설정 또는 보안 규칙을 확인해 주세요.");
  }
}

async function addMemo(text) {
  await addDoc(collection(db, "memos"), {
    text,
    createdAt: Date.now(),
  });
}

startListening();

onAuthStateChanged(auth, (user) => {
  if (user) {
    setStatus(`로그인 상태: ${user.isAnonymous ? "게스트" : "사용자"}`);
    return;
  }

  setStatus("로그인 처리 중...");
  signInAnonymously(auth).catch((error) => {
    console.error("익명 로그인 실패:", error);
    setStatus(`로그인 실패 (${error.code || error.message})`);
  });
});

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
    setStatus(`저장 실패 (${error.code || error.message})`);
  }

  input.focus();
});

if (input) input.focus();
