// main.js — GNS Quiz Manager Main Process
const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');
const db   = require('./store');

// Set AppUserModelID so Windows groups the taskbar icon correctly
app.setAppUserModelId('com.gns.quizmanager');

const appIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.ico'));


let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 650,
    backgroundColor: '#0a0e1a',
    icon: appIcon,
    title: 'GNS Quiz Manager',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  db.init();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─── CSV helper ───────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const res = []; let cur = ''; let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { res.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  res.push(cur.trim()); return res;
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('stats:get', () => db.getStats());

// Teams
ipcMain.handle('teams:getAll',  ()              => db.getAllTeams());
ipcMain.handle('teams:add',     (_, t)          => db.addTeam(t));
ipcMain.handle('teams:update',  (_, { id, updates }) => db.updateTeam(id, updates));
ipcMain.handle('teams:delete',  (_, id)         => db.deleteTeam(id));

// Questions
ipcMain.handle('questions:getAll',  ()              => db.getAllQuestions());
ipcMain.handle('questions:add',     (_, q)          => db.addQuestion(q));
ipcMain.handle('questions:update',  (_, { id, updates }) => db.updateQuestion(id, updates));
ipcMain.handle('questions:delete',  (_, id)         => db.deleteQuestion(id));
ipcMain.handle('questions:reset',   ()              => db.resetQuestions());

ipcMain.handle('questions:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'JSON / CSV', extensions: ['json', 'csv'] }],
    properties: ['openFile']
  });
  if (result.canceled) return { canceled: true };
  const fp = result.filePaths[0];
  const ext = path.extname(fp).toLowerCase();
  const raw = fs.readFileSync(fp, 'utf-8');
  let questions = [];
  if (ext === '.json') {
    const parsed = JSON.parse(raw);
    questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
  } else {
    const lines = raw.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, ''));
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      const q = {}; headers.forEach((h, idx) => { q[h] = vals[idx] || ''; });
      questions.push(q);
    }
  }
  const added = db.importQuestions(questions);
  return { added: added.length };
});

ipcMain.handle('questions:export', async () => {
  const qs = db.getAllQuestions();
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'gns-questions.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled) return { canceled: true };
  fs.writeFileSync(result.filePath, JSON.stringify(qs, null, 2));
  return { success: true };
});

// Matches
ipcMain.handle('matches:generate',      (_, opts) => db.generateMatches(opts?.questionsPerTeam));
ipcMain.handle('matches:getAll',        ()        => db.getAllMatches());
ipcMain.handle('matches:start',         (_, id)   => db.startMatch(id));
ipcMain.handle('matches:getActiveState',()        => db.getActiveMatchState());
ipcMain.handle('matches:getBattleState',(_, id)   => db.getBattleState(id));

// Battle
ipcMain.handle('battle:submitAnswer', (_, { matchId, selectedAnswer }) =>
  db.submitAnswer(matchId, selectedAnswer, false));
ipcMain.handle('battle:timeout', (_, matchId) =>
  db.submitAnswer(matchId, null, true));

// Leaderboard
ipcMain.handle('leaderboard:get', () => db.getLeaderboard());
ipcMain.handle('leaderboard:allComplete', () => db.allMatchesComplete());

// Match history
ipcMain.handle('matches:getHistory', (_, matchId) => db.getMatchHistory(matchId));

// Reset & Seed
ipcMain.handle('store:reset', () => db.resetAll());
ipcMain.handle('store:seed',  () => db.seedDemoData());