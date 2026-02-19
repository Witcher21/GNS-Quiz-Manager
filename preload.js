// preload.js — Secure IPC bridge between main and renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Stats
  getStats: () => ipcRenderer.invoke('stats:get'),

  // Teams
  getAllTeams:  ()            => ipcRenderer.invoke('teams:getAll'),
  addTeam:     (team)        => ipcRenderer.invoke('teams:add', team),
  updateTeam:  (id, updates) => ipcRenderer.invoke('teams:update', { id, updates }),
  deleteTeam:  (id)          => ipcRenderer.invoke('teams:delete', id),

  // Questions
  getAllQuestions: ()            => ipcRenderer.invoke('questions:getAll'),
  addQuestion:    (q)           => ipcRenderer.invoke('questions:add', q),
  updateQuestion: (id, updates) => ipcRenderer.invoke('questions:update', { id, updates }),
  deleteQuestion: (id)          => ipcRenderer.invoke('questions:delete', id),
  resetQuestions: ()            => ipcRenderer.invoke('questions:reset'),
  importQuestions:()            => ipcRenderer.invoke('questions:import'),
  exportQuestions:()            => ipcRenderer.invoke('questions:export'),

  // Matches / Tournament
  generateMatches:    (opts)    => ipcRenderer.invoke('matches:generate', opts),
  getAllMatches:       ()        => ipcRenderer.invoke('matches:getAll'),
  startMatch:         (id)      => ipcRenderer.invoke('matches:start', id),
  getActiveMatchState:()        => ipcRenderer.invoke('matches:getActiveState'),
  getBattleState:     (id)      => ipcRenderer.invoke('matches:getBattleState', id),

  // Battle
  submitAnswer: (matchId, answer) => ipcRenderer.invoke('battle:submitAnswer', { matchId, selectedAnswer: answer }),
  timeoutAnswer:(matchId)         => ipcRenderer.invoke('battle:timeout', matchId),

  // Leaderboard
  getLeaderboard:      () => ipcRenderer.invoke('leaderboard:get'),
  allMatchesComplete:  () => ipcRenderer.invoke('leaderboard:allComplete'),

  // Match history
  getMatchHistory: (matchId) => ipcRenderer.invoke('matches:getHistory', matchId),

  // Utilities
  resetAll:    () => ipcRenderer.invoke('store:reset'),
  seedDemoData:() => ipcRenderer.invoke('store:seed'),
});
