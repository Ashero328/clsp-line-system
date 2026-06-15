// ============================================================
// firebase_service.js — Firebase Firestore Layer
// Depends on: Firebase Compat SDK (loaded via CDN)
//             customer_script.js (getAllProjects, getExpenses, etc.)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyC0Aegsz2H-q1taM35phnj1Hvidk7oBJTY",
  authDomain: "clsp-system.firebaseapp.com",
  projectId: "clsp-system",
  storageBucket: "clsp-system.firebasestorage.app",
  messagingSenderId: "206604222333",
  appId: "1:206604222333:web:7710e8f0d1548869e69614"
};

let db = null;
try {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch (e) {
  console.warn('[Firebase] init failed:', e);
}

// Active Firestore real-time listeners keyed by projectId
const _fsUnsubs = {};

// In-flight settled toggles (key -> desired state). Snapshots re-apply these
// so a stale cache snapshot can never clobber a toggle the user just made.
const _fsPendingSettled = {};

// ── Helpers ──────────────────────────────────────────────────

function fsIsAvailable() { return !!db; }

function fsIsSubscribed(pid) { return !!_fsUnsubs[pid]; }

function fsIsSharedProject(pid) {
  const p = getAllProjects().find(x => x.id === pid);
  return !!(p && p.shareCode);
}

function _genShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function _safeDocId(key) {
  // Firestore doc IDs cannot contain '/' — encode the key
  return btoa(unescape(encodeURIComponent(key))).replace(/[+/=]/g, '_');
}

// ── Upload Project to Firestore ───────────────────────────────

async function fsUploadProject(pid) {
  if (!db) throw new Error('Firebase 未初始化');
  const project = getAllProjects().find(p => p.id === pid);
  if (!project) throw new Error('找不到專案');

  // Pick a unique 6-char share code
  let shareCode = null;
  for (let i = 0; i < 5 && !shareCode; i++) {
    const candidate = _genShareCode();
    const doc = await db.collection('shareCodes').doc(candidate).get();
    if (!doc.exists) shareCode = candidate;
  }
  if (!shareCode) throw new Error('無法產生分享碼，請重試');

  const projectData = { ...project, shareCode };

  const batch = db.batch();

  // Project doc
  batch.set(db.collection('projects').doc(pid), projectData);

  // Expenses sub-collection
  getExpenses(pid).forEach(e => {
    batch.set(
      db.collection('projects').doc(pid).collection('expenses').doc(e.id),
      e
    );
  });

  // Settled sub-collection
  [...getSettledTx(pid)].forEach(key => {
    batch.set(
      db.collection('projects').doc(pid).collection('settled').doc(_safeDocId(key)),
      { key, settled: true }
    );
  });

  // Share code index
  batch.set(db.collection('shareCodes').doc(shareCode), {
    projectId: pid,
    projectName: project.name,
    memberCount: (project.members || []).length,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();

  // Persist shareCode locally so fsIsSharedProject() works
  project.shareCode = shareCode;
  saveProject(project);

  return shareCode;
}

// ── Join By Share Code ────────────────────────────────────────

async function fsJoinByCode(code) {
  if (!db) throw new Error('Firebase 未初始化');

  const codeDoc = await db.collection('shareCodes').doc(code.toUpperCase()).get();
  if (!codeDoc.exists) throw new Error('找不到此分享碼，請確認輸入是否正確');

  const { projectId, projectName, memberCount } = codeDoc.data();

  // Already joined?
  const existing = getAllProjects().find(p => p.id === projectId);
  if (existing) return { alreadyJoined: true, project: existing };

  // Fetch project
  const projDoc = await db.collection('projects').doc(projectId).get();
  if (!projDoc.exists) throw new Error('專案已被刪除');
  const project = projDoc.data();

  // Fetch expenses
  const expSnap = await db.collection('projects').doc(projectId).collection('expenses').get();
  const expenses = expSnap.docs.map(d => d.data());

  // Fetch settled
  const settledSnap = await db.collection('projects').doc(projectId).collection('settled').get();
  const settledKeys = settledSnap.docs.filter(d => d.data().settled !== false)
                                      .map(d => d.data().key).filter(Boolean);

  return {
    alreadyJoined: false,
    project,
    expenses,
    settledKeys,
    projectName: projectName || project.name,
    memberCount: memberCount || (project.members || []).length
  };
}

// ── Sync Writes (called after every localStorage write for shared projects) ──

async function fsSyncExpense(e) {
  if (!db) return;
  try {
    await db.collection('projects').doc(e.projectId).collection('expenses').doc(e.id).set(e);
  } catch (err) { console.warn('[Firebase] sync expense failed:', err); }
}

async function fsDeleteExpenseCloud(pid, eid) {
  if (!db) return;
  try {
    await db.collection('projects').doc(pid).collection('expenses').doc(eid).delete();
  } catch (err) { console.warn('[Firebase] delete expense failed:', err); }
}

async function fsSyncProject(p) {
  if (!db) return;
  try {
    await db.collection('projects').doc(p.id).set({ ...p }, { merge: true });
  } catch (err) { console.warn('[Firebase] sync project failed:', err); }
}

async function fsSyncSettled(pid, key, isSettled) {
  if (!db) return true;
  _fsPendingSettled[key] = isSettled;
  try {
    const ref = db.collection('projects').doc(pid).collection('settled').doc(_safeDocId(key));
    // Write a tombstone ({settled:false}) instead of deleting the doc, so
    // "doc missing" unambiguously means "never synced" — that lets the
    // snapshot handler backfill pre-share toggles instead of wiping them.
    await ref.set({ key, settled: isSettled });
    return true;
  } catch (err) {
    // On failure local state is kept as-is; the snapshot backfill re-uploads
    // any locally-settled key whose cloud doc is missing.
    console.warn('[Firebase] sync settled failed:', err);
    return false;
  } finally {
    // Only clear if no newer toggle of the same key replaced our entry
    if (_fsPendingSettled[key] === isSettled) delete _fsPendingSettled[key];
  }
}

// ── Real-time Listener ────────────────────────────────────────

function fsSubscribeProject(pid, onExpenses, onSettled) {
  // Already live — keep the existing listeners. Re-subscribing here would
  // loop forever: the expenses callback re-renders the detail screen, which
  // calls fsSubscribeProject again, whose fresh initial snapshot re-fires it.
  if (_fsUnsubs[pid]) return;

  const u1 = db.collection('projects').doc(pid).collection('expenses')
    .onSnapshot(snap => {
      const expenses = snap.docs.map(d => d.data());
      localStorage.setItem('clsp_expenses_' + pid, JSON.stringify(expenses));
      onExpenses(expenses);
    }, err => console.warn('[Firebase] expenses listener error:', err));

  const u2 = db.collection('projects').doc(pid).collection('settled')
    .onSnapshot(snap => {
      const docKeys = new Set(snap.docs.map(d => d.data().key).filter(Boolean));
      const keySet  = new Set(snap.docs.filter(d => d.data().settled !== false)
                                        .map(d => d.data().key).filter(Boolean));
      // Backfill: a locally-settled key with no cloud doc at all was toggled
      // before the project was shared (or its write was lost) — upload it
      // instead of letting this overwrite wipe it.
      getSettledTx(pid).forEach(key => {
        if (!docKeys.has(key) && !(key in _fsPendingSettled)) {
          keySet.add(key);
          fsSyncSettled(pid, key, true);
        }
      });
      // Re-apply in-flight local toggles so this overwrite can't undo them
      Object.entries(_fsPendingSettled).forEach(([k, on]) => {
        if (on) keySet.add(k); else keySet.delete(k);
      });
      const keys = [...keySet];
      localStorage.setItem('clsp_settled_' + pid, JSON.stringify(keys));
      onSettled(keys);
    }, err => console.warn('[Firebase] settled listener error:', err));

  _fsUnsubs[pid] = [u1, u2];
}

function fsUnsubscribeProject(pid) {
  (_fsUnsubs[pid] || []).forEach(u => u());
  delete _fsUnsubs[pid];
}

function fsUnsubscribeAll() {
  Object.keys(_fsUnsubs).forEach(pid => fsUnsubscribeProject(pid));
}
