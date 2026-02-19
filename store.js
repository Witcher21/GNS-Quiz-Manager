// store.js — GNS Quiz Manager Data Layer
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

let dataPath = null;
let store = { teams: [], questions: [], matches: [] };

// ---------- Init ----------
function init() {
  const userDataPath = app.getPath('userData');
  dataPath = path.join(userDataPath, 'gns-quiz-data.json');
  if (fs.existsSync(dataPath)) {
    try {
      const raw = fs.readFileSync(dataPath, 'utf-8');
      const parsed = JSON.parse(raw);
      store = {
        teams: parsed.teams || [],
        questions: parsed.questions || [],
        matches: parsed.matches || []
      };
    } catch (e) {
      console.error('Store parse error:', e);
      store = { teams: [], questions: [], matches: [] };
    }
  }
  save();
}

function save() {
  if (dataPath) fs.writeFileSync(dataPath, JSON.stringify(store, null, 2), 'utf-8');
}

// ---------- Teams ----------
const getAllTeams = () => store.teams;

function addTeam(t) {
  const team = { id: randomUUID(), schoolName: t.schoolName, member1: t.member1, member2: t.member2, score: 0 };
  store.teams.push(team); save(); return team;
}

function updateTeam(id, u) {
  const i = store.teams.findIndex(t => t.id === id);
  if (i < 0) return null;
  store.teams[i] = { ...store.teams[i], ...u }; save(); return store.teams[i];
}

function deleteTeam(id) {
  store.teams = store.teams.filter(t => t.id !== id); save(); return true;
}

// ---------- Questions ----------
const getAllQuestions = () => store.questions;

function addQuestion(q) {
  const question = {
    id: randomUUID(), question: q.question,
    optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
    correctAnswer: q.correctAnswer, isUsed: false
  };
  store.questions.push(question); save(); return question;
}

function updateQuestion(id, u) {
  const i = store.questions.findIndex(q => q.id === id);
  if (i < 0) return null;
  store.questions[i] = { ...store.questions[i], ...u }; save(); return store.questions[i];
}

function deleteQuestion(id) {
  store.questions = store.questions.filter(q => q.id !== id); save(); return true;
}

function importQuestions(arr) {
  const added = arr.map(q => ({
    id: randomUUID(),
    question: q.question || q.Question || '',
    optionA: q.optionA || q.option_a || q.OptionA || '',
    optionB: q.optionB || q.option_b || q.OptionB || '',
    optionC: q.optionC || q.option_c || q.OptionC || '',
    optionD: q.optionD || q.option_d || q.OptionD || '',
    correctAnswer: (q.correctAnswer || q.correct_answer || q.CorrectAnswer || 'A').toUpperCase(),
    isUsed: false
  })).filter(q => q.question);
  store.questions.push(...added); save(); return added;
}

function resetQuestions() {
  store.questions = store.questions.map(q => ({ ...q, isUsed: false })); save();
}

// ---------- Matches ----------
function getStats() {
  const available = store.questions.filter(q => !q.isUsed).length;
  const perTeam = store.teams.length > 0 ? Math.floor(available / store.teams.length) : 0;
  return {
    teamCount: store.teams.length,
    questionCount: store.questions.length,
    usedQuestions: store.questions.filter(q => q.isUsed).length,
    availableQuestions: available,
    suggestedPerTeam: perTeam,
    matchCount: store.matches.length,
    completedMatches: store.matches.filter(m => m.status === 'completed').length,
    pendingMatches: store.matches.filter(m => m.status === 'pending').length,
    activeMatches: store.matches.filter(m => m.status === 'active').length,
  };
}

function generateMatches(questionsPerTeam) {
  if (store.teams.length < 2) return { error: `Need at least 2 teams. Have ${store.teams.length}.` };
  if (store.teams.length % 2 !== 0) return { error: `Need an even number of teams. Have ${store.teams.length}.` };

  const available = store.questions.filter(q => !q.isUsed).length;
  const totalPairs = store.teams.length / 2;
  const qpt = questionsPerTeam || Math.max(1, Math.floor(available / store.teams.length));
  const needed = qpt * 2 * totalPairs;

  if (available < needed) {
    return { error: `Need ${needed} available questions for ${qpt} questions/team. Only ${available} available. Add more or reduce questions/team.` };
  }

  // Fisher-Yates shuffle
  const ids = store.teams.map(t => t.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const matches = [];
  for (let i = 0; i < totalPairs; i++) {
    matches.push({
      id: randomUUID(), slotNumber: i + 1,
      team1Id: ids[i * 2], team2Id: ids[i * 2 + 1],
      status: 'pending', winnerId: null,
      team1Score: 0, team2Score: 0,
      rounds: [], currentTurn: 'team1', currentQuestionId: null,
      questionsPerTeam: qpt
    });
  }

  store.matches = matches;
  store.teams = store.teams.map(t => ({ ...t, score: 0 }));
  save();
  return { matches, questionsPerTeam: qpt };
}

const getAllMatches = () => store.matches;

function _nextQuestion() {
  const pool = store.questions.filter(q => !q.isUsed);
  if (!pool.length) return null;
  const q = pool[Math.floor(Math.random() * pool.length)];
  q.isUsed = true; return q;
}

function startMatch(matchId) {
  const match = store.matches.find(m => m.id === matchId);
  if (!match) return { error: 'Match not found' };
  if (match.status === 'active') return { error: 'Match already active' };
  if (match.status === 'completed') return { error: 'Match already completed' };
  const active = store.matches.find(m => m.status === 'active');
  if (active && active.id !== matchId) return { error: 'Another match is active. Complete it first.' };

  match.status = 'active';
  match.currentTurn = 'team1';
  const q = _nextQuestion();
  if (!q) return { error: 'No questions available in bank.' };
  match.currentQuestionId = q.id;
  save();
  return getBattleState(matchId);
}

function submitAnswer(matchId, selectedAnswer, isTimeout) {
  const match = store.matches.find(m => m.id === matchId);
  if (!match || match.status !== 'active') return { error: 'No active match' };

  const cq = store.questions.find(q => q.id === match.currentQuestionId);
  if (!cq) return { error: 'No current question' };

  const teamId = match.currentTurn === 'team1' ? match.team1Id : match.team2Id;
  const isCorrect = !isTimeout && selectedAnswer === cq.correctAnswer;
  const correctAnswer = cq.correctAnswer;

  match.rounds.push({ teamId, questionId: cq.id, selectedAnswer: isTimeout ? null : selectedAnswer, isCorrect, isTimeout });

  if (isCorrect) {
    if (match.currentTurn === 'team1') match.team1Score++; else match.team2Score++;
    const team = store.teams.find(t => t.id === teamId);
    if (team) team.score++;
  }

  // Switch turn
  match.currentTurn = match.currentTurn === 'team1' ? 'team2' : 'team1';

  const t1r = match.rounds.filter(r => r.teamId === match.team1Id).length;
  const t2r = match.rounds.filter(r => r.teamId === match.team2Id).length;
  const done = t1r >= match.questionsPerTeam && t2r >= match.questionsPerTeam;

  let isMatchComplete = false;
  let isTiebreaker = false;

  if (done) {
    // Tie-breaker: if scores are equal and we haven't already triggered one, add 1 more
    if (match.team1Score === match.team2Score && !match.tiebreakerActivated) {
      match.tiebreakerActivated = true;
      match.questionsPerTeam += 1; // sudden death — one more question each
      isTiebreaker = true;
      const nextQ = _nextQuestion();
      if (!nextQ) { _completeMatch(match); isMatchComplete = true; }
      else match.currentQuestionId = nextQ.id;
    } else {
      _completeMatch(match);
      isMatchComplete = true;
    }
  } else {
    const nextQ = _nextQuestion();
    if (!nextQ) { _completeMatch(match); isMatchComplete = true; }
    else match.currentQuestionId = nextQ.id;
  }

  save();
  return {
    isCorrect, correctAnswer, isTimeout, isMatchComplete, isTiebreaker,
    team1Score: match.team1Score, team2Score: match.team2Score, winnerId: match.winnerId,
    battleState: isMatchComplete ? null : getBattleState(matchId)
  };
}

function _completeMatch(match) {
  match.status = 'completed';
  match.currentQuestionId = null;
  if (match.team1Score > match.team2Score) match.winnerId = match.team1Id;
  else if (match.team2Score > match.team1Score) match.winnerId = match.team2Id;
  else match.winnerId = null;
}

function getBattleState(matchId) {
  const match = store.matches.find(m => m.id === matchId);
  if (!match) return null;
  const t1 = store.teams.find(t => t.id === match.team1Id);
  const t2 = store.teams.find(t => t.id === match.team2Id);
  const cq = match.currentQuestionId ? store.questions.find(q => q.id === match.currentQuestionId) : null;
  const safeQ = cq ? { id: cq.id, question: cq.question, optionA: cq.optionA, optionB: cq.optionB, optionC: cq.optionC, optionD: cq.optionD } : null;
  return {
    matchId: match.id, slotNumber: match.slotNumber,
    team1: { id: t1.id, schoolName: t1.schoolName, member1: t1.member1, member2: t1.member2 },
    team2: { id: t2.id, schoolName: t2.schoolName, member1: t2.member1, member2: t2.member2 },
    currentTurn: match.currentTurn, currentQuestion: safeQ,
    team1Score: match.team1Score, team2Score: match.team2Score,
    team1RoundsCompleted: match.rounds.filter(r => r.teamId === match.team1Id).length,
    team2RoundsCompleted: match.rounds.filter(r => r.teamId === match.team2Id).length,
    questionsPerTeam: match.questionsPerTeam, status: match.status, winnerId: match.winnerId,
    isTiebreaker: match.tiebreakerActivated || false
  };
}

function getMatchHistory(matchId) {
  const match = store.matches.find(m => m.id === matchId);
  if (!match) return null;
  const t1 = store.teams.find(t => t.id === match.team1Id);
  const t2 = store.teams.find(t => t.id === match.team2Id);
  const winner = match.winnerId ? store.teams.find(t => t.id === match.winnerId) : null;
  const rounds = match.rounds.map((r, i) => {
    const q = store.questions.find(q => q.id === r.questionId);
    const team = store.teams.find(t => t.id === r.teamId);
    return {
      index: i + 1, teamName: team?.schoolName || '?', teamId: r.teamId,
      question: q?.question || '(Deleted)', correctAnswer: q?.correctAnswer || '?',
      selectedAnswer: r.selectedAnswer, isCorrect: r.isCorrect, isTimeout: r.isTimeout
    };
  });
  return {
    matchId: match.id, slotNumber: match.slotNumber,
    team1: t1, team2: t2, winner,
    team1Score: match.team1Score, team2Score: match.team2Score,
    status: match.status, rounds, tiebreakerActivated: match.tiebreakerActivated || false
  };
}

function getActiveMatchState() {
  const m = store.matches.find(m => m.status === 'active');
  return m ? getBattleState(m.id) : null;
}

function getLeaderboard() {
  return [...store.teams].sort((a, b) => b.score - a.score).map((t, i) => ({ ...t, rank: i + 1 }));
}

function resetAll() { store = { teams: [], questions: [], matches: [] }; save(); }

function allMatchesComplete() {
  return store.matches.length > 0 && store.matches.every(m => m.status === 'completed');
}

// ─── Demo Seed Data ───────────────────────────────────────────────────────────
function seedDemoData() {
  const demoTeams = [
    { schoolName: 'GNS Colombo',       member1: 'Asel Perera',       member2: 'Kasun Silva' },
    { schoolName: 'Nalanda College',   member1: 'Tharaka Fernando',  member2: 'Dineth Jayawardena' },
    { schoolName: 'Ananda College',    member1: 'Ravindu Dissanayake', member2: 'Lahiru Bandara' },
    { schoolName: 'Thurstan College',  member1: 'Malith Wickramasinghe', member2: 'Sahan Rajapaksha' },
    { schoolName: 'Royal College',     member1: 'Pasindu Rathnayake', member2: 'Achini Samarasinghe' },
    { schoolName: 'Visakha Vidyalaya', member1: 'Nethmi Perera',     member2: 'Hasini Kumari' },
    { schoolName: 'Holy Cross College',member1: 'Dilnoza Ranwala',   member2: 'Mahesh Gamage' },
    { schoolName: 'Devi Balika',       member1: 'Imesha Kulatunga',  member2: 'Sanduni Jayasinghe' },
    { schoolName: 'DS Senanayake',     member1: 'Kavishka Weerasinghe', member2: 'Chanaka Mendis' },
    { schoolName: 'Mahanama College',  member1: 'Pasan Liyanage',    member2: 'Thilina Alwis' },
  ];
  const demoQuestions = [
    { q:'What does CPU stand for?',                  a:'Central Processing Unit',      b:'Computer Processing Unit',    c:'Central Program Unit',    d:'Computer Program Unit',    ans:'A' },
    { q:'What does HTML stand for?',                 a:'Hyper Text Markup Language',   b:'High Text Machine Language',  c:'Hyper Text Machine Language', d:'High Text Markup Language', ans:'A' },
    { q:'Which company developed Java?',             a:'Microsoft',     b:'Sun Microsystems', c:'Apple',  d:'Google',    ans:'B' },
    { q:'What does RAM stand for?',                  a:'Read Access Memory', b:'Random Access Memory', c:'Rapid Access Memory', d:'Read All Memory', ans:'B' },
    { q:'What does HTTP stand for?',                 a:'Hyper Text Transfer Protocol', b:'High Text Transfer Protocol', c:'Hyper Transfer Text Protocol', d:'High Transfer Text Protocol', ans:'A' },
    { q:'Which language is used for web styling?',   a:'Python', b:'Java', c:'CSS', d:'C++', ans:'C' },
    { q:'What is the binary representation of 10?',  a:'1010', b:'1001', c:'1100', d:'0110', ans:'A' },
    { q:'What does URL stand for?',                  a:'Uniform Resource Locator', b:'Universal Resource Locator', c:'Uniform Record Locator', d:'Universal Record Locator', ans:'A' },
    { q:'Which is NOT a programming language?',      a:'Python', b:'Java', c:'HTML', d:'C++', ans:'C' },
    { q:'What does OS stand for?',                   a:'Online System', b:'Operating System', c:'Output System', d:'Open System', ans:'B' },
    { q:'What does SQL stand for?',                  a:'Structured Query Language', b:'Simple Query Language', c:'Standard Query Language', d:'Sequential Query Language', ans:'A' },
    { q:'Who created the World Wide Web?',           a:'Bill Gates', b:'Steve Jobs', c:'Tim Berners-Lee', d:'Linus Torvalds', ans:'C' },
    { q:'What does USB stand for?',                  a:'Universal System Bus', b:'Universal Serial Bus', c:'United System Bus', d:'United Serial Bus', ans:'B' },
    { q:'What does GUI stand for?',                  a:'Graphical User Interface', b:'General User Interface', c:'Graphical Unit Interface', d:'General Unit Interface', ans:'A' },
    { q:'Which of these is an input device?',        a:'Monitor', b:'Printer', c:'Speaker', d:'Keyboard', ans:'D' },
    { q:'What does IP stand for in networking?',     a:'Internet Port', b:'Internal Protocol', c:'Internet Protocol', d:'Internal Port', ans:'C' },
    { q:'What does PDF stand for?',                  a:'Portable Document Format', b:'Printed Document Format', c:'Portable Data Format', d:'Printed Data Format', ans:'A' },
    { q:'Which is a search engine?',                 a:'Ubuntu', b:'Firefox', c:'Google', d:'Python', ans:'C' },
    { q:'What does ROM stand for?',                  a:'Read-Only Memory', b:'Random-Only Memory', c:'Read-On Memory', d:'Random-On Memory', ans:'A' },
    { q:'What does LAN stand for?',                  a:'Large Area Network', b:'Local Area Network', c:'Long Area Network', d:'Linked Area Network', ans:'B' },
    { q:'Which programming language uses indentation as syntax?', a:'Java', b:'C++', c:'Python', d:'JavaScript', ans:'C' },
    { q:'What is the default port for HTTP?',        a:'21', b:'443', c:'80', d:'8080', ans:'C' },
    { q:'What does DNS stand for?',                  a:'Domain Name System', b:'Digital Name System', c:'Data Name System', d:'Domain Network System', ans:'A' },
    { q:'What does AI stand for?',                   a:'Automated Intelligence', b:'Artificial Intelligence', c:'Advanced Intelligence', d:'Automated Interaction', ans:'B' },
    { q:'Which data structure works on LIFO principle?', a:'Queue', b:'Array', c:'Stack', d:'Tree', ans:'C' },
    { q:'What does BIOS stand for?',                 a:'Basic Input Output System', b:'Binary Input Output System', c:'Base Input Output System', d:'Basic Internal Output System', ans:'A' },
    { q:'Which symbol is used for comments in Python?', a:'//', b:'/*', c:'#', d:'--', ans:'C' },
    { q:'What is 1 Terabyte equal to?',              a:'1000 GB', b:'1024 GB', c:'1000 MB', d:'1024 MB', ans:'B' },
    { q:'Which company makes the Android OS?',       a:'Apple', b:'Microsoft', c:'Google', d:'Samsung', ans:'C' },
    { q:'What does IoT stand for?',                  a:'Internet of Things', b:'Interface of Things', c:'Internet of Technology', d:'Interface of Technology', ans:'A' },
  ];

  let teamsAdded = 0, qsAdded = 0;
  for (const t of demoTeams) {
    if (store.teams.length < 10) { store.teams.push({ id: randomUUID(), ...t, score: 0 }); teamsAdded++; }
  }
  for (const q of demoQuestions) {
    store.questions.push({ id: randomUUID(), question: q.q, optionA: q.a, optionB: q.b, optionC: q.c, optionD: q.d, correctAnswer: q.ans, isUsed: false });
    qsAdded++;
  }
  save();
  return { teamsAdded, questionsAdded: qsAdded };
}

module.exports = {
  init, save, getStats,
  getAllTeams, addTeam, updateTeam, deleteTeam,
  getAllQuestions, addQuestion, updateQuestion, deleteQuestion, importQuestions, resetQuestions,
  generateMatches, getAllMatches, startMatch, submitAnswer, getBattleState, getActiveMatchState,
  getMatchHistory, getLeaderboard, allMatchesComplete, resetAll, seedDemoData
};
