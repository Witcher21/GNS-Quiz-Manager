// ═══════════════════════════════════════════════════════════════════════════════
// GNS Quiz Manager — renderer.js
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Audio Engine ─────────────────────────────────────────────────────────────
let _actx = null;
const AC = () => { if (!_actx) _actx = new AudioContext(); return _actx; };

function _tone(freq, type, dur, vol) {
  const ctx = AC(), o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.start(); o.stop(ctx.currentTime + dur);
}

const sfx = {
  success() { [523, 659, 784].forEach((f, i) => setTimeout(() => _tone(f, 'sine', .5, .28), i * 80)); },
  fail()    { [300, 220].forEach((f, i) => setTimeout(() => _tone(f, 'sawtooth', .3, .22), i * 100)); },
  tick()    { _tone(700, 'square', .05, .08); },
  fanfare() { [523,659,784,1047].forEach((f,i) => setTimeout(() => _tone(f,'sine',.8,.3), i*90)); },
};

// ─── State ────────────────────────────────────────────────────────────────────
let currentView = '';
let timerInterval = null;
let timerSeconds = 0;
let battleState  = null;
let selectedOpt  = null;
let timerTotal   = 30;

// ─── Utilities ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const app = () => $('app');

function showToast(msg, type = 'info') {
  const t = $('toast'), ti = $('toast-inner');
  const colors = { success:'bg-emerald-500 text-white', error:'bg-red-500 text-white', info:'bg-amber-400 text-black', warn:'bg-yellow-500 text-black' };
  ti.className = `px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl ${colors[type] || colors.info}`;
  ti.textContent = msg;
  t.classList.remove('opacity-0','pointer-events-none');
  t.style.transform = 'translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.add('opacity-0','pointer-events-none');
  }, 3000);
}

function openModal(html) {
  $('modal-box').innerHTML = html;
  $('modal').classList.remove('hidden');
  $('modal').classList.add('flex');
}

function closeModal() {
  $('modal').classList.add('hidden');
  $('modal').classList.remove('flex');
}
window._closeModal = closeModal;

function navigate(view) {
  currentView = view;
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  const btn = $(`nav-${view}`);
  if (btn) btn.classList.add('active');
  stopTimer();
  renderView(view);
}

async function renderView(view) {
  app().innerHTML = '<div class="flex items-center justify-center h-64"><div class="text-gray-500 text-sm animate-pulse">Loading…</div></div>';
  switch (view) {
    case 'dashboard':   await renderDashboard();    break;
    case 'teams':       await renderTeams();         break;
    case 'questions':   await renderQuestions();     break;
    case 'tournament':  await renderTournament();    break;
    case 'battle':      await renderBattle();        break;
    case 'leaderboard': await renderLeaderboard();   break;
    default:            await renderDashboard();
  }
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const s = await window.api.getStats();
  app().innerHTML = `
  <div class="slide-up">
    <div class="mb-8">
      <h1 class="text-3xl font-black text-white mb-1">IT Day Quiz Manager</h1>
      <p class="text-gray-500 text-sm">GNS School IT Day — Competition Control Panel</p>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      ${statCard('👥','Teams Registered',`${s.teamCount}`,'of 10 teams','amber')}
      ${statCard('📝','Questions',`${s.availableQuestions}`,'available in bank','blue')}
      ${statCard('⚔️','Matches',`${s.completedMatches}/${s.matchCount}`,'completed','emerald')}
      ${statCard('🔥','Used Questions',`${s.usedQuestions}`,'questions played','purple')}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      ${quickCard('👥','Register Teams','Add school teams and members for the competition.','teams','Go to Teams')}
      ${quickCard('📝','Question Bank','Add, edit, import or export quiz questions.','questions','Manage Questions')}
      ${quickCard('⚔️','Generate Tournament','Shuffle teams and create 1v1 match brackets.','tournament','Open Tournament')}
      ${quickCard('🎯','Battle Arena','Run live matches with timer and score tracking.','battle','Start Battle')}
      ${quickCard('🏅','Leaderboard','View live team rankings and final results.','leaderboard','View Scores')}
      <div class="card p-6 flex flex-col justify-between">
        <div>
          <div class="text-2xl mb-2">⚙️</div>
          <div class="font-bold text-white mb-1 text-sm">Suggested Setup</div>
          <div class="text-gray-400 text-xs leading-relaxed">
            ${s.teamCount < 10 ? `<span class="text-amber-400">⚠ Register ${10 - s.teamCount} more team(s)</span>` : '<span class="text-emerald-400">✓ All 10 teams registered</span>'}<br>
            ${s.questionCount < 10 ? `<span class="text-amber-400">⚠ Add more questions (have ${s.questionCount})</span>` : `<span class="text-emerald-400">✓ ${s.questionCount} questions ready</span>`}<br>
            ${s.matchCount === 0 ? '<span class="text-gray-400">Generate tournament to create matches</span>' : `<span class="text-emerald-400">✓ ${s.matchCount} matches generated</span>`}
          </div>
        </div>
        ${s.teamCount >= 2 && s.questionCount > 0 ? `<button onclick="navigate('tournament')" class="mt-4 btn-primary text-sm py-2 rounded-lg font-semibold w-full text-center">Generate Tournament →</button>` : ''}
      </div>
    </div>
    <!-- Admin Tools -->
    <div class="card p-5">
      <div class="font-semibold text-white text-sm mb-3">🛠 Admin Tools</div>
      <div class="flex flex-wrap gap-2">
        <button onclick="loadDemoData()" class="btn-ghost px-4 py-2 rounded-lg text-sm">🧪 Load Demo Data</button>
        <button onclick="resetAllData()" class="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">🗑 Reset All Data</button>
      </div>
      <div class="text-xs text-gray-600 mt-2">Demo Data: 10 Sri Lankan school teams + 30 IT questions instantly loaded for testing.</div>
    </div>
  </div>`;
}

function statCard(icon, label, value, sub, color) {
  const colors = { amber:'text-amber-400 bg-amber-400/10', blue:'text-blue-400 bg-blue-400/10', emerald:'text-emerald-400 bg-emerald-400/10', purple:'text-purple-400 bg-purple-400/10' };
  return `<div class="card p-5">
    <div class="flex items-center gap-3 mb-3">
      <div class="w-9 h-9 rounded-lg ${colors[color]} flex items-center justify-center text-base">${icon}</div>
      <span class="text-xs text-gray-500 font-medium">${label}</span>
    </div>
    <div class="text-3xl font-black text-white mb-0.5">${value}</div>
    <div class="text-xs text-gray-600">${sub}</div>
  </div>`;
}

function quickCard(icon, title, desc, view, cta) {
  return `<div class="card p-6 flex flex-col justify-between hover:border-amber-400/20 transition-colors">
    <div>
      <div class="text-2xl mb-2">${icon}</div>
      <div class="font-bold text-white mb-1 text-sm">${title}</div>
      <div class="text-gray-400 text-xs leading-relaxed">${desc}</div>
    </div>
    <button onclick="navigate('${view}')" class="mt-4 text-xs font-semibold text-amber-400 hover:text-amber-300 text-left transition-colors">${cta} →</button>
  </div>`;
}

async function loadDemoData() {
  const r = await window.api.seedDemoData();
  showToast(`✅ Loaded ${r.teamsAdded} teams + ${r.questionsAdded} questions!`, 'success');
  renderDashboard();
}

async function resetAllData() {
  if (!confirm('⚠️ This will permanently delete ALL teams, questions, and match data. Are you sure?')) return;
  if (!confirm('Last chance — this cannot be undone. Confirm reset?')) return;
  await window.api.resetAll();
  showToast('All data has been reset.', 'warn');
  renderDashboard();
}

// ─── TEAMS ────────────────────────────────────────────────────────────────────
async function renderTeams() {
  const teams = await window.api.getAllTeams();
  const count = teams.length;
  app().innerHTML = `
  <div class="slide-up">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-black text-white">Teams</h2>
        <p class="text-gray-500 text-xs mt-0.5">${count} team(s) registered</p>
      </div>
      <button onclick="openAddTeamModal()" class="btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2">
        <span>➕</span> Add Team
      </button>
    </div>

    ${count === 0 ? emptyState('👥','No teams yet','Click "Add Team" to register your first school team.') : `
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-white/5 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-5 py-3 font-medium w-8">#</th>
            <th class="text-left px-5 py-3 font-medium">School Name</th>
            <th class="text-left px-5 py-3 font-medium">Member 1</th>
            <th class="text-left px-5 py-3 font-medium">Member 2</th>
            <th class="text-left px-5 py-3 font-medium">Score</th>
            <th class="text-right px-5 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${teams.map((t, i) => `
          <tr class="border-b border-white/5 last:border-0">
            <td class="px-5 py-3.5 text-gray-600 font-mono text-xs">${i + 1}</td>
            <td class="px-5 py-3.5 font-semibold text-white">${esc(t.schoolName)}</td>
            <td class="px-5 py-3.5 text-gray-300">${esc(t.member1)}</td>
            <td class="px-5 py-3.5 text-gray-300">${esc(t.member2)}</td>
            <td class="px-5 py-3.5"><span class="text-amber-400 font-bold">${t.score}</span></td>
            <td class="px-5 py-3.5 text-right">
              <button onclick="openEditTeamModal('${t.id}')" class="text-xs text-blue-400 hover:text-blue-300 mr-3 transition-colors">Edit</button>
              <button onclick="deleteTeam('${t.id}')" class="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`}
  </div>`;
}

function openAddTeamModal() {
  openModal(`
    <div class="flex items-center justify-between mb-5">
      <h3 class="font-bold text-white text-lg">Add New Team</h3>
      <button onclick="_closeModal()" class="text-gray-500 hover:text-white text-xl leading-none">×</button>
    </div>
    <form id="team-form" onsubmit="submitAddTeam(event)" class="space-y-4">
      <div>
        <label class="label">School Name</label>
        <input id="tf-school" class="input" type="text" placeholder="e.g. GNS Colombo" required maxlength="60"/>
      </div>
      <div>
        <label class="label">Member 1 Name</label>
        <input id="tf-m1" class="input" type="text" placeholder="Full name" required maxlength="50"/>
      </div>
      <div>
        <label class="label">Member 2 Name</label>
        <input id="tf-m2" class="input" type="text" placeholder="Full name" required maxlength="50"/>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="button" onclick="_closeModal()" class="btn-ghost flex-1 py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
        <button type="submit" class="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold">Add Team</button>
      </div>
    </form>`);
  $('tf-school').focus();
}

async function submitAddTeam(e) {
  e.preventDefault();
  const school = $('tf-school').value.trim(), m1 = $('tf-m1').value.trim(), m2 = $('tf-m2').value.trim();
  await window.api.addTeam({ schoolName: school, member1: m1, member2: m2 });
  closeModal(); showToast('Team added!', 'success');
  renderTeams();
}

async function openEditTeamModal(id) {
  const teams = await window.api.getAllTeams();
  const t = teams.find(x => x.id === id); if (!t) return;
  openModal(`
    <div class="flex items-center justify-between mb-5">
      <h3 class="font-bold text-white text-lg">Edit Team</h3>
      <button onclick="_closeModal()" class="text-gray-500 hover:text-white text-xl leading-none">×</button>
    </div>
    <form onsubmit="submitEditTeam(event,'${id}')" class="space-y-4">
      <div>
        <label class="label">School Name</label>
        <input id="ef-school" class="input" type="text" value="${esc(t.schoolName)}" required maxlength="60"/>
      </div>
      <div>
        <label class="label">Member 1</label>
        <input id="ef-m1" class="input" type="text" value="${esc(t.member1)}" required maxlength="50"/>
      </div>
      <div>
        <label class="label">Member 2</label>
        <input id="ef-m2" class="input" type="text" value="${esc(t.member2)}" required maxlength="50"/>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="button" onclick="_closeModal()" class="btn-ghost flex-1 py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
        <button type="submit" class="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold">Save Changes</button>
      </div>
    </form>`);
}

async function submitEditTeam(e, id) {
  e.preventDefault();
  await window.api.updateTeam(id, { schoolName: $('ef-school').value.trim(), member1: $('ef-m1').value.trim(), member2: $('ef-m2').value.trim() });
  closeModal(); showToast('Team updated!', 'success'); renderTeams();
}

async function deleteTeam(id) {
  if (!confirm('Delete this team?')) return;
  await window.api.deleteTeam(id); showToast('Team deleted', 'warn'); renderTeams();
}

// ─── QUESTIONS ────────────────────────────────────────────────────────────────
async function renderQuestions() {
  const qs = await window.api.getAllQuestions();
  const used = qs.filter(q => q.isUsed).length;
  app().innerHTML = `
  <div class="slide-up">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-black text-white">Question Bank</h2>
        <p class="text-gray-500 text-xs mt-0.5">${qs.length} questions · ${used} used · ${qs.length - used} available</p>
      </div>
      <div class="flex gap-2">
        <button onclick="importQs()" class="btn-ghost px-4 py-2.5 rounded-xl text-sm font-semibold">📥 Import</button>
        <button onclick="exportQs()" class="btn-ghost px-4 py-2.5 rounded-xl text-sm font-semibold">📤 Export</button>
        <button onclick="resetQs()" class="btn-ghost px-4 py-2.5 rounded-xl text-sm font-semibold text-amber-400">🔄 Reset Used</button>
        <button onclick="openAddQModal()" class="btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold">➕ Add Question</button>
      </div>
    </div>

    ${qs.length === 0 ? emptyState('📝','No questions yet','Add questions manually or import from a JSON/CSV file.') : `
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-white/5 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-5 py-3 font-medium w-8">#</th>
            <th class="text-left px-5 py-3 font-medium">Question</th>
            <th class="text-left px-5 py-3 font-medium w-20">Answer</th>
            <th class="text-left px-5 py-3 font-medium w-20">Status</th>
            <th class="text-right px-5 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${qs.map((q, i) => `
          <tr class="border-b border-white/5 last:border-0">
            <td class="px-5 py-3 text-gray-600 font-mono text-xs">${i + 1}</td>
            <td class="px-5 py-3 text-gray-200 max-w-xs">
              <div class="truncate" title="${esc(q.question)}">${esc(q.question)}</div>
              <div class="text-xs text-gray-600 mt-0.5">A:${esc(q.optionA)} · B:${esc(q.optionB)} · C:${esc(q.optionC)} · D:${esc(q.optionD)}</div>
            </td>
            <td class="px-5 py-3"><span class="text-emerald-400 font-bold font-mono">${q.correctAnswer}</span></td>
            <td class="px-5 py-3">
              ${q.isUsed
                ? '<span class="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">Used</span>'
                : '<span class="text-xs bg-emerald-400/10 text-emerald-400 px-2 py-0.5 rounded-full">Fresh</span>'}
            </td>
            <td class="px-5 py-3 text-right">
              <button onclick="openEditQModal('${q.id}')" class="text-xs text-blue-400 hover:text-blue-300 mr-3 transition-colors">Edit</button>
              <button onclick="deleteQ('${q.id}')" class="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`}
  </div>`;
}

function qFormHtml(title, q = {}) {
  const opts = ['A','B','C','D'];
  return `
    <div class="flex items-center justify-between mb-5">
      <h3 class="font-bold text-white text-lg">${title}</h3>
      <button onclick="_closeModal()" class="text-gray-500 hover:text-white text-xl leading-none">×</button>
    </div>
    <div class="space-y-3">
      <div>
        <label class="label">Question Text</label>
        <textarea id="qf-q" class="input resize-none" rows="3" placeholder="Enter the question" required maxlength="400">${esc(q.question || '')}</textarea>
      </div>
      ${opts.map(o => `
      <div>
        <label class="label">Option ${o}</label>
        <input id="qf-opt${o}" class="input" type="text" placeholder="Option ${o}" value="${esc(q['option'+o] || '')}" required maxlength="200"/>
      </div>`).join('')}
      <div>
        <label class="label">Correct Answer</label>
        <select id="qf-ans" class="input">
          ${opts.map(o => `<option value="${o}" ${(q.correctAnswer || 'A') === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
    </div>`;
}

function openAddQModal() {
  openModal(`
    ${qFormHtml('Add Question')}
    <div class="flex gap-3 pt-4">
      <button onclick="_closeModal()" class="btn-ghost flex-1 py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
      <button onclick="submitAddQ()" class="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold">Add Question</button>
    </div>`);
}

async function submitAddQ() {
  const q = $('qf-q').value.trim();
  if (!q) return showToast('Question text required', 'error');
  await window.api.addQuestion({
    question:q, optionA:$('qf-optA').value.trim(), optionB:$('qf-optB').value.trim(),
    optionC:$('qf-optC').value.trim(), optionD:$('qf-optD').value.trim(), correctAnswer:$('qf-ans').value
  });
  closeModal(); showToast('Question added!','success'); renderQuestions();
}

async function openEditQModal(id) {
  const qs = await window.api.getAllQuestions();
  const q = qs.find(x => x.id === id); if (!q) return;
  openModal(`
    ${qFormHtml('Edit Question', { question:q.question, optionA:q.optionA, optionB:q.optionB, optionC:q.optionC, optionD:q.optionD, correctAnswer:q.correctAnswer })}
    <div class="flex gap-3 pt-4">
      <button onclick="_closeModal()" class="btn-ghost flex-1 py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
      <button onclick="submitEditQ('${id}')" class="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold">Save</button>
    </div>`);
}

async function submitEditQ(id) {
  await window.api.updateQuestion(id, {
    question:$('qf-q').value.trim(), optionA:$('qf-optA').value.trim(), optionB:$('qf-optB').value.trim(),
    optionC:$('qf-optC').value.trim(), optionD:$('qf-optD').value.trim(), correctAnswer:$('qf-ans').value
  });
  closeModal(); showToast('Question updated!','success'); renderQuestions();
}

async function deleteQ(id) {
  if (!confirm('Delete this question?')) return;
  await window.api.deleteQuestion(id); showToast('Deleted','warn'); renderQuestions();
}

async function importQs() {
  const r = await window.api.importQuestions();
  if (r.canceled) return;
  showToast(`Imported ${r.added} questions!`, 'success'); renderQuestions();
}

async function exportQs() {
  const r = await window.api.exportQuestions();
  if (r.canceled) return;
  showToast('Questions exported!', 'success');
}

async function resetQs() {
  if (!confirm('Reset all "used" flags? Questions will be playable again.')) return;
  await window.api.resetQuestions(); showToast('Questions reset', 'info'); renderQuestions();
}

// ─── TOURNAMENT ───────────────────────────────────────────────────────────────
async function renderTournament() {
  const [matches, teams, stats] = await Promise.all([
    window.api.getAllMatches(), window.api.getAllTeams(), window.api.getStats()
  ]);
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  app().innerHTML = `
  <div class="slide-up">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-black text-white">Tournament Bracket</h2>
        <p class="text-gray-500 text-xs mt-0.5">${teams.length} teams · ${stats.availableQuestions} questions available</p>
      </div>
      <div class="flex gap-2 items-center">
        <label class="text-xs text-gray-500">Questions / team:</label>
        <input id="qpt-input" type="number" min="1" max="50" value="${stats.suggestedPerTeam || 5}"
          class="w-16 bg-navy-800 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center"/>
        <button onclick="generateTournament()" class="btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold">🔀 Generate Pairs</button>
      </div>
    </div>

    ${matches.length === 0 ? emptyState('⚔️', 'No matches yet', 'Click "Generate Pairs" to shuffle teams into 1v1 battle slots.') : `
    <div class="grid grid-cols-1 gap-4">
      ${matches.map(m => {
        const t1 = teamMap[m.team1Id], t2 = teamMap[m.team2Id];
        const winner = m.winnerId ? teamMap[m.winnerId] : null;
        const statusColor = { pending:'text-gray-400 bg-gray-400/10', active:'text-amber-400 bg-amber-400/10', completed:'text-emerald-400 bg-emerald-400/10' }[m.status];
        return `
        <div class="card p-5 ${m.status === 'active' ? 'match-active' : ''}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4 flex-1">
              <div class="text-gray-500 font-bold text-xs w-16">MATCH ${m.slotNumber}</div>
              <div class="flex-1 flex items-center gap-3">
                <div class="flex-1 text-right">
                  <div class="font-bold text-white text-base ${m.winnerId === m.team1Id ? 'text-amber-400' : ''}">${esc(t1?.schoolName || '?')}</div>
                  <div class="text-xs text-gray-500">${esc(t1?.member1 || '')} & ${esc(t1?.member2 || '')}</div>
                  ${m.status !== 'pending' ? `<div class="text-2xl font-black ${m.winnerId === m.team1Id ? 'text-amber-400' : 'text-white'}">${m.team1Score}</div>` : ''}
                </div>
                <div class="text-center px-3">
                  <div class="text-amber-400 font-black text-lg">VS</div>
                  ${winner ? `<div class="text-xs text-emerald-400 mt-1">🏆 ${esc(winner.schoolName)}</div>` : ''}
                </div>
                <div class="flex-1">
                  <div class="font-bold text-white text-base ${m.winnerId === m.team2Id ? 'text-amber-400' : ''}">${esc(t2?.schoolName || '?')}</div>
                  <div class="text-xs text-gray-500">${esc(t2?.member1 || '')} & ${esc(t2?.member2 || '')}</div>
                  ${m.status !== 'pending' ? `<div class="text-2xl font-black ${m.winnerId === m.team2Id ? 'text-amber-400' : 'text-white'}">${m.team2Score}</div>` : ''}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3 ml-4">
              <span class="text-xs px-2.5 py-1 rounded-full font-semibold ${statusColor}">${m.status.toUpperCase()}</span>
              ${m.status === 'pending' ? `<button onclick="launchMatch('${m.id}')" class="btn-primary px-4 py-2 rounded-lg text-sm font-semibold">▶ Start</button>` : ''}
              ${m.status === 'active' ? `<button onclick="resumeMatch('${m.id}')" class="bg-amber-400 hover:bg-amber-300 text-black px-4 py-2 rounded-lg text-sm font-semibold">⚡ Resume</button>` : ''}
              ${m.status === 'completed' ? `<button onclick="openMatchHistory('${m.id}')" class="btn-ghost px-4 py-2 rounded-lg text-sm font-semibold">📋 History</button>` : ''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`}
  </div>`;
}

async function generateTournament() {
  const qpt = parseInt($('qpt-input')?.value) || null;
  const r = await window.api.generateMatches({ questionsPerTeam: qpt });
  if (r.error) return showToast(r.error, 'error');
  showToast(`Tournament generated! ${r.questionsPerTeam} questions/team`, 'success');
  renderTournament();
}

async function launchMatch(id) {
  const state = await window.api.startMatch(id);
  if (state.error) return showToast(state.error, 'error');
  battleState = state;
  showToast('Match started!', 'success');
  navigate('battle');
}

async function resumeMatch(id) {
  const state = await window.api.getBattleState(id);
  battleState = state;
  navigate('battle');
}

// ─── BATTLE ARENA ─────────────────────────────────────────────────────────────
async function renderBattle() {
  // Try to get active state if battleState not set
  if (!battleState) battleState = await window.api.getActiveMatchState();

  if (!battleState || battleState.status === 'completed') {
    app().innerHTML = `
    <div class="slide-up flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div class="text-6xl mb-4">🎯</div>
      <h2 class="text-2xl font-black text-white mb-2">Battle Arena</h2>
      <p class="text-gray-400 text-sm mb-6">No active match. Go to the Tournament tab to start a match.</p>
      <button onclick="navigate('tournament')" class="btn-primary px-6 py-3 rounded-xl font-semibold">Go to Tournament →</button>
    </div>`;
    return;
  }

  const bs = battleState;
  const currentTeam = bs.currentTurn === 'team1' ? bs.team1 : bs.team2;
  const totalQ = bs.questionsPerTeam;
  const t1done = bs.team1RoundsCompleted, t2done = bs.team2RoundsCompleted;
  const tiebreakerBanner = bs.isTiebreaker
    ? `<div class="bg-red-500/10 border border-red-500/40 text-red-400 text-center py-2 px-4 rounded-xl font-bold text-sm mb-4 animate-pulse">⚡ SUDDEN DEATH TIEBREAKER — Next correct answer wins!</div>`
    : '';

  app().innerHTML = `
  <div class="slide-up max-w-4xl mx-auto">
    ${tiebreakerBanner}
    <!-- Header: Match info -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="text-xs text-gray-500 font-medium mb-1">MATCH ${bs.slotNumber || ''} · BATTLE ARENA</div>
        <h2 class="text-xl font-black text-white">${esc(bs.team1.schoolName)} <span class="text-amber-400">VS</span> ${esc(bs.team2.schoolName)}</h2>
      </div>
      <button onclick="navigate('tournament')" class="btn-ghost px-3 py-2 rounded-lg text-xs">← Back</button>
    </div>

    <!-- Scoreboard -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="card p-4 text-center ${bs.currentTurn === 'team1' ? 'border-amber-400/40 ring-1 ring-amber-400/20' : ''}">
        ${bs.currentTurn === 'team1' ? '<div class="text-xs text-amber-400 font-bold mb-1">▶ YOUR TURN</div>' : '<div class="text-xs text-gray-600 mb-1">WAITING</div>'}
        <div class="font-black text-white text-base">${esc(bs.team1.schoolName)}</div>
        <div class="text-xs text-gray-500 mb-2">${esc(bs.team1.member1)} & ${esc(bs.team1.member2)}</div>
        <div class="text-5xl font-black text-white">${bs.team1Score}</div>
        <div class="text-xs text-gray-600 mt-1">${t1done}/${totalQ} answered</div>
      </div>

      <div class="flex flex-col items-center justify-center">
        <!-- Timer SVG ring -->
        <div class="relative w-24 h-24" id="timer-wrap">
          <svg class="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#1f2937" stroke-width="8"/>
            <circle id="timer-ring" cx="50" cy="50" r="44" fill="none" stroke="#f59e0b"
              stroke-width="8" stroke-linecap="round"
              stroke-dasharray="276.46" stroke-dashoffset="0"/>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span id="timer-text" class="text-2xl font-black text-white">${timerTotal}</span>
          </div>
        </div>
        <div class="text-xs text-gray-500 mt-2">seconds</div>
      </div>

      <div class="card p-4 text-center ${bs.currentTurn === 'team2' ? 'border-amber-400/40 ring-1 ring-amber-400/20' : ''}">
        ${bs.currentTurn === 'team2' ? '<div class="text-xs text-amber-400 font-bold mb-1">▶ YOUR TURN</div>' : '<div class="text-xs text-gray-600 mb-1">WAITING</div>'}
        <div class="font-black text-white text-base">${esc(bs.team2.schoolName)}</div>
        <div class="text-xs text-gray-500 mb-2">${esc(bs.team2.member1)} & ${esc(bs.team2.member2)}</div>
        <div class="text-5xl font-black text-white">${bs.team2Score}</div>
        <div class="text-xs text-gray-600 mt-1">${t2done}/${totalQ} answered</div>
      </div>
    </div>

    <!-- Question -->
    ${bs.currentQuestion ? `
    <div class="card p-6 mb-4" id="question-card">
      <div class="text-xs text-gray-500 font-semibold mb-3 uppercase tracking-wider">
        ${currentTeam.schoolName}'s Question
      </div>
      <p id="q-text" class="text-xl font-bold text-white leading-relaxed mb-6">${esc(bs.currentQuestion.question)}</p>
      <div class="grid grid-cols-1 gap-3" id="options-grid">
        ${['A','B','C','D'].map(o => `
        <button id="opt-${o}" onclick="selectOption('${o}')"
          class="option-btn w-full text-left px-5 py-4 rounded-xl text-white font-medium flex items-center gap-4 bg-navy-800">
          <span class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-black text-amber-400 text-sm shrink-0">${o}</span>
          <span>${esc(bs.currentQuestion['option' + o])}</span>
        </button>`).join('')}
      </div>
    </div>
    <div class="flex gap-3">
      <button id="submit-btn" onclick="submitBattleAnswer()" disabled
        class="btn-primary flex-1 py-4 rounded-xl text-lg font-black disabled:opacity-40 disabled:cursor-not-allowed">
        ✓ Submit Answer
      </button>
    </div>` : '<div class="card p-6 text-center text-gray-500">Loading question…</div>'}
  </div>`;

  selectedOpt = null;
  if (bs.currentQuestion) startTimer(bs);
}

function selectOption(opt) {
  if (selectedOpt !== null && document.getElementById('submit-btn').disabled === false) {
    // Already locked in
  }
  selectedOpt = opt;
  ['A','B','C','D'].forEach(o => {
    const btn = $(`opt-${o}`);
    if (btn) btn.classList.toggle('selected', o === opt);
  });
  const sb = $('submit-btn');
  if (sb) sb.disabled = false;
}

function startTimer(bs) {
  stopTimer();
  timerSeconds = timerTotal;
  const ring = $('timer-ring'), txt = $('timer-text');
  const circ = 276.46;
  timerInterval = setInterval(async () => {
    timerSeconds--;
    if (ring) ring.style.strokeDashoffset = circ * (1 - timerSeconds / timerTotal);
    if (txt) {
      txt.textContent = timerSeconds;
      txt.className = 'text-2xl font-black ' + (timerSeconds > 10 ? 'text-white' : timerSeconds > 5 ? 'text-yellow-400' : 'text-red-400');
    }
    if (timerSeconds <= 5 && timerSeconds > 0) sfx.tick();
    if (timerSeconds <= 0) {
      stopTimer();
      await handleTimeout(bs.matchId);
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

async function submitBattleAnswer() {
  if (!selectedOpt || !battleState) return;
  stopTimer();
  lockOptions();
  const result = await window.api.submitAnswer(battleState.matchId, selectedOpt);
  await handleAnswerResult(result);
}

async function handleTimeout(matchId) {
  lockOptions();
  const result = await window.api.timeoutAnswer(matchId);
  await handleAnswerResult(result);
}

function lockOptions() {
  ['A','B','C','D'].forEach(o => { const b = $(`opt-${o}`); if (b) b.onclick = null; });
  const sb = $('submit-btn'); if (sb) sb.disabled = true;
}

async function handleAnswerResult(result) {
  if (!result || result.error) { showToast(result?.error || 'Error', 'error'); return; }

  // Show correct/wrong feedback
  const correct = $(`opt-${result.correctAnswer}`);
  if (correct) correct.classList.add('correct');
  if (selectedOpt && selectedOpt !== result.correctAnswer) {
    const wrong = $(`opt-${selectedOpt}`); if (wrong) wrong.classList.add('wrong');
  }

  const card = $('question-card');
  if (result.isCorrect) { sfx.success(); if (card) card.classList.add('correct-flash'); }
  else                  { sfx.fail();    if (card) card.classList.add('wrong-flash'); }

  const feedback = result.isTimeout ? '⏰ Time Up!' : result.isCorrect ? '✅ Correct!' : `❌ Wrong! Answer: ${result.correctAnswer}`;
  showToast(feedback, result.isCorrect ? 'success' : 'error');

  await sleep(2200);

  if (result.isMatchComplete) {
    battleState = null;
    sfx.fanfare();
    showMatchResult(result);
  } else {
    battleState = result.battleState;
    renderBattle();
  }
}

function showMatchResult(result) {
  app().innerHTML = `
  <div class="slide-up flex flex-col items-center justify-center min-h-[70vh] text-center">
    <div class="text-7xl mb-4">${result.winnerId ? '🏆' : '🤝'}</div>
    <h2 class="text-4xl font-black text-white mb-2">${result.winnerId ? 'Match Complete!' : "It's a Draw!"}</h2>
    <div class="text-6xl font-black text-amber-400 my-4">${result.team1Score} — ${result.team2Score}</div>
    ${result.winnerId ? '<p class="text-emerald-400 text-xl font-bold mb-6">🎉 Winner Decided!</p>' : '<p class="text-gray-400 text-lg mb-6">Both teams scored equally.</p>'}
    <div class="flex gap-4">
      <button onclick="navigate('tournament')" class="btn-ghost px-6 py-3 rounded-xl font-semibold">View Tournament</button>
      <button onclick="navigate('leaderboard')" class="btn-primary px-6 py-3 rounded-xl font-semibold">🏅 Leaderboard</button>
    </div>
  </div>`;
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
async function renderLeaderboard() {
  const [teams, allDone] = await Promise.all([
    window.api.getLeaderboard(),
    window.api.allMatchesComplete()
  ]);
  const medals = ['🥇','🥈','🥉'];

  // Show podium if all matches are complete
  if (allDone && teams.length > 0) {
    renderPodium(teams); return;
  }

  app().innerHTML = `
  <div class="slide-up">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-black text-white">Live Leaderboard</h2>
        <p class="text-gray-500 text-xs mt-0.5">Rankings update automatically after each match</p>
      </div>
      <div class="flex gap-2">
        <button onclick="renderLeaderboard()" class="btn-ghost px-4 py-2.5 rounded-xl text-sm font-semibold">🔄 Refresh</button>
        <button onclick="printLeaderboard()" class="btn-ghost px-4 py-2.5 rounded-xl text-sm font-semibold">🖨 Print</button>
      </div>
    </div>

    ${teams.length === 0 ? emptyState('🏅','No scores yet','Complete matches to see rankings here.') : `
    <div class="space-y-3">
      ${teams.map((t, i) => {
        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'bg-gray-700/50 text-gray-400';
        const cardClass = i === 0 ? 'border-amber-400/30 ring-1 ring-amber-400/10' : '';
        return `
        <div class="card p-5 flex items-center gap-5 ${cardClass}">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${rankClass}">
            ${i < 3 ? medals[i] : t.rank}
          </div>
          <div class="flex-1">
            <div class="font-bold text-white text-lg">${esc(t.schoolName)}</div>
            <div class="text-xs text-gray-500">${esc(t.member1)} · ${esc(t.member2)}</div>
          </div>
          <div class="text-right">
            <div class="text-4xl font-black ${i === 0 ? 'text-amber-400' : 'text-white'}">${t.score}</div>
            <div class="text-xs text-gray-500">points</div>
          </div>
        </div>`;
      }).join('')}
    </div>`}
  </div>`;
}

function renderPodium(teams) {
  const top3 = teams.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean); // 2nd, 1st, 3rd visual order
  const heights = ['h-28','h-40','h-20'];
  const medals  = ['🥈','🥇','🥉'];
  const labels  = ['2nd Place','1st Place','3rd Place'];

  app().innerHTML = `
  <div class="slide-up">
    <div class="text-center mb-8">
      <div class="text-5xl mb-3">🏆</div>
      <h2 class="text-4xl font-black text-white mb-1">IT Day Champions!</h2>
      <p class="text-amber-400 text-sm font-semibold">All matches complete — Final Results</p>
    </div>
    <!-- Podium -->
    <div class="flex items-end justify-center gap-3 mb-10">
      ${podiumOrder.map((t, i) => `
      <div class="flex flex-col items-center">
        <div class="text-3xl mb-1">${medals[i]}</div>
        <div class="text-xs text-gray-400 mb-1 font-semibold text-center max-w-24">${esc(t?.schoolName || '')}</div>
        <div class="text-2xl font-black text-white mb-2">${t?.score || 0} pts</div>
        <div class="${heights[i]} w-28 ${ i===1?'bg-amber-400':i===0?'bg-gray-400':'bg-amber-700'} rounded-t-xl flex items-end justify-center pb-2">
          <span class="text-black font-black text-sm">${labels[i]}</span>
        </div>
      </div>`).join('')}
    </div>
    <!-- Full rankings -->
    <div class="card p-5">
      <div class="font-semibold text-white text-sm mb-3">📊 Full Rankings</div>
      <div class="space-y-2">
        ${teams.map((t, i) => `
        <div class="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
          <span class="text-gray-500 font-mono text-xs w-6">#${i+1}</span>
          <span class="text-white font-semibold flex-1 text-sm">${esc(t.schoolName)}</span>
          <span class="text-xs text-gray-500">${esc(t.member1)} & ${esc(t.member2)}</span>
          <span class="font-black text-amber-400 text-lg">${t.score}</span>
        </div>`).join('')}
      </div>
    </div>
    <div class="flex justify-center gap-3 mt-6">
      <button onclick="renderLeaderboard._forceList=true;renderLeaderboard()" class="btn-ghost px-6 py-3 rounded-xl font-semibold" onclick="navigate('leaderboard')">📋 List View</button>
      <button onclick="printLeaderboard()" class="btn-primary px-6 py-3 rounded-xl font-semibold">🖨 Print Results</button>
    </div>
  </div>`;
}

function printLeaderboard() {
  window.api.getLeaderboard().then(teams => {
    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(`<!DOCTYPE html><html><head><title>GNS Quiz — Final Results</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #000; }
      h1 { text-align:center; font-size:28px; margin-bottom:4px; }
      h2 { text-align:center; font-size:16px; color:#666; margin-bottom:32px; font-weight:normal; }
      table { width:100%; border-collapse:collapse; }
      th { background:#1a1a2e; color:#fff; padding:12px 16px; text-align:left; font-size:13px; }
      td { padding:10px 16px; border-bottom:1px solid #eee; font-size:14px; }
      tr:nth-child(1) td { background:#fff8e1; font-weight:bold; }
      tr:nth-child(2) td { background:#f5f5f5; }
      tr:nth-child(3) td { background:#fff3e0; }
      .rank { font-weight:bold; }
      .score { font-weight:bold; font-size:18px; }
      footer { text-align:center; margin-top:32px; color:#999; font-size:12px; }
    </style></head><body>
    <h1>🏆 GNS IT Day Quiz — Final Results</h1>
    <h2>${new Date().toLocaleDateString('en-LK', {weekday:'long',year:'numeric',month:'long',day:'numeric'})}</h2>
    <table>
      <thead><tr><th>Rank</th><th>School</th><th>Members</th><th>Score</th></tr></thead>
      <tbody>
        ${teams.map((t,i)=>`<tr><td class="rank">${['🥇','🥈','🥉'][i]||'#'+(i+1)}</td><td>${t.schoolName}</td><td>${t.member1} &amp; ${t.member2}</td><td class="score">${t.score}</td></tr>`).join('')}
      </tbody>
    </table>
    <footer>GNS Quiz Manager — Printed on ${new Date().toLocaleString()}</footer>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  });
}

async function openMatchHistory(matchId) {
  const h = await window.api.getMatchHistory(matchId);
  if (!h) return showToast('History not available', 'error');

  const t1color = 'text-blue-400', t2color = 'text-purple-400';
  openModal(`
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="font-bold text-white">Match ${h.slotNumber} — History</h3>
        <div class="text-xs text-gray-500 mt-0.5">${esc(h.team1.schoolName)} vs ${esc(h.team2.schoolName)} · Final: ${h.team1Score}–${h.team2Score}</div>
        ${h.winner ? `<div class="text-xs text-emerald-400 font-semibold mt-0.5">🏆 Winner: ${esc(h.winner.schoolName)}</div>` : '<div class="text-xs text-gray-400">Draw</div>'}
        ${h.tiebreakerActivated ? '<div class="text-xs text-red-400 font-semibold mt-0.5">⚡ Tiebreaker was triggered</div>' : ''}
      </div>
      <button onclick="_closeModal()" class="text-gray-500 hover:text-white text-xl leading-none">×</button>
    </div>
    <div class="space-y-2 max-h-96 overflow-y-auto pr-1">
      ${h.rounds.map(r => `
      <div class="bg-navy-800 rounded-xl p-3 border border-white/5">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold ${r.teamId === h.team1.id ? t1color : t2color}">${esc(r.teamName)}</span>
          <span class="text-xs ${ r.isTimeout ? 'text-gray-500' : r.isCorrect ? 'text-emerald-400' : 'text-red-400'} font-semibold">
            ${r.isTimeout ? '⏰ Timeout' : r.isCorrect ? '✅ Correct' : '❌ Wrong'}
          </span>
        </div>
        <div class="text-xs text-gray-300 leading-relaxed mb-1">${esc(r.question)}</div>
        <div class="text-xs text-gray-500">
          Answered: <span class="font-semibold text-white">${r.selectedAnswer || 'None'}</span>
          · Correct: <span class="font-semibold text-emerald-400">${r.correctAnswer}</span>
        </div>
      </div>`).join('')}
    </div>`);
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────
function emptyState(icon, title, desc) {
  return `<div class="flex flex-col items-center justify-center py-24 text-center">
    <div class="text-5xl mb-4">${icon}</div>
    <div class="font-bold text-white text-lg mb-1">${title}</div>
    <div class="text-gray-500 text-sm">${desc}</div>
  </div>`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Global CSS helpers (applied via Tailwind class names in buttons) ─────────
// We add .btn-primary and .btn-ghost via a <style> tag injected at runtime
(function injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
    .btn-primary { background: #f59e0b; color: #000; font-weight: 700; transition: all .18s ease; cursor: pointer; }
    .btn-primary:hover { background: #fbbf24; }
    .btn-ghost { background: rgba(255,255,255,.05); color: #d1d5db; font-weight: 600; border: 1px solid rgba(255,255,255,.08); transition: all .18s ease; cursor: pointer; }
    .btn-ghost:hover { background: rgba(255,255,255,.09); color: #fff; }
    .input { width: 100%; background: #162040; border: 1px solid rgba(255,255,255,.1); border-radius: .65rem; padding: .6rem .85rem; color: #fff; font-size: .875rem; outline: none; transition: border-color .15s; }
    .input:focus { border-color: #f59e0b; }
    .label { display: block; font-size: .7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin-bottom: .35rem; }
  `;
  document.head.appendChild(s);
})();

// ─── Bootstrap ────────────────────────────────────────────────────────────────
navigate('dashboard');
