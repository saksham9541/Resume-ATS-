/* ==========================================================================
   ResumeAI – frontend
   ========================================================================== */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let token = localStorage.getItem('resumeai_token') || '';
let user = null;
let resumes = [];
let analyses = [];
let lastOutput = '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 4000);
}

function saveBlob(blob, name) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch('/api' + path, { ...options, headers });

  if (!response.ok) {
    let detail;
    try {
      detail = (await response.json()).detail;
    } catch {
      // response body was not JSON
    }
    throw Error(
      typeof detail === 'string' ? detail : 'Request failed: ' + response.status
    );
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  return isJson ? response.json() : response.blob();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function auth(mode) {
  try {
    const result = await api('/' + mode, {
      method: 'POST',
      body: JSON.stringify({
        email: $('email').value,
        password: $('password').value,
      }),
    });
    token = result.token;
    localStorage.setItem('resumeai_token', token);
    await init();
  } catch (e) {
    toast(e.message);
  }
}

function logout() {
  token = '';
  user = null;
  localStorage.removeItem('resumeai_token');
  $('workspace').hidden = true;
  $('auth').hidden = false;
  $('who').textContent = '';
}

async function init() {
  try {
    user = await api('/me');
    $('auth').hidden = true;
    $('workspace').hidden = false;
    $('who').textContent = user.email;
    $('adminTab').hidden = user.role !== 'admin';
    await refresh();
  } catch {
    logout();
  }
}

// ---------------------------------------------------------------------------
// Dashboard / lists
// ---------------------------------------------------------------------------
async function refresh() {
  [resumes, analyses] = await Promise.all([api('/resumes'), api('/analyses')]);

  // Counters
  $('countRes').textContent = resumes.length;
  $('countAna').textContent = analyses.length;
  $('best').textContent = analyses.length
    ? Math.max(...analyses.map((a) => a.score)) + '%'
    : '—';

  // Resume dropdowns
  const resumeOptions = resumes
    .map((r) => `<option value="${r.id}">${esc(r.filename)} (#${r.id})</option>`)
    .join('');
  for (const id of ['resumeSelect', 'aiResume']) {
    $(id).innerHTML = resumeOptions;
  }

  // Resume list
  $('resumeList').innerHTML =
    resumes
      .map(
        (r) => `
        <div class="item">
          <div>
            <b>${esc(r.filename)}</b>
            <small>${esc(r.created_at)}</small>
          </div>
          <div class="actions">
            <button onclick="downloadResume(${r.id})">Download PDF</button>
            <button class="secondary" onclick="removeResume(${r.id})">Delete</button>
          </div>
        </div>`
      )
      .join('') || '<p>No resumes yet.</p>';

  // Analysis list
  $('analysisList').innerHTML =
    analyses
      .map(
        (a) => `
        <div class="item">
          <div>
            <b>${esc(a.filename)}</b>
            <small>${esc(a.created_at)}</small>
          </div>
          <button onclick="viewAnalysis(${a.id})">Score ${a.score}%</button>
        </div>`
      )
      .join('') || '<p>No analyses yet.</p>';
}

// ---------------------------------------------------------------------------
// Resumes
// ---------------------------------------------------------------------------
async function upload() {
  const file = $('pdf').files[0];
  if (!file) return toast('Choose a PDF first');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const result = await api('/resumes', { method: 'POST', body: formData });
    toast('Saved ' + result.filename);
    await refresh();
  } catch (e) {
    toast(e.message);
  }
}

async function downloadResume(id) {
  try {
    const blob = await api('/resumes/' + id + '/download');
    saveBlob(blob, 'resume.pdf');
  } catch (e) {
    toast(e.message);
  }
}

async function removeResume(id) {
  if (!confirm('Permanently delete this resume and its analyses?')) return;

  try {
    await api('/resumes/' + id, { method: 'DELETE' });
    await refresh();
    toast('Resume deleted');
  } catch (e) {
    toast(e.message);
  }
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------
function renderResult(r) {
  const chips = (words, extraClass = '') =>
    words.map((w) => `<span class="chip ${extraClass}">${esc(w)}</span>`).join('') || 'None';

  $('result').innerHTML = `
    <div class="score">${r.score}<small style="font-size:22px">/100</small></div>
    <p>${esc(r.explanation)}</p>

    <div class="metrics">
      <div class="metric">Keyword coverage<strong>${r.keyword_match}%</strong></div>
      <div class="metric">Sections<strong>${r.sections_score}%</strong></div>
      <div class="metric">Contact<strong>${r.contact_score}%</strong></div>
      <div class="metric">Length<strong>${r.length_score}%</strong></div>
    </div>

    <h3>Matching keywords</h3>
    <div class="chips">${chips(r.matched_keywords)}</div>

    <h3>Missing keywords</h3>
    <div class="chips">${chips(r.missing_keywords, 'missing')}</div>

    <p class="muted">Only add missing skills if they truthfully reflect your experience.</p>`;
}

async function analyze() {
  try {
    if (!$('resumeSelect').value) throw Error('Upload a resume first');

    const result = await api('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        resume_id: Number($('resumeSelect').value),
        job_description: $('job').value,
      }),
    });

    renderResult(result);
    await refresh();
    toast('Analysis saved');
  } catch (e) {
    toast(e.message);
  }
}

async function viewAnalysis(id) {
  try {
    const result = await api('/analyses/' + id);
    renderResult(result.details);
    showTab('analyze');
  } catch (e) {
    toast(e.message);
  }
}

// ---------------------------------------------------------------------------
// AI tools
// ---------------------------------------------------------------------------
async function generate() {
  try {
    if (!$('aiResume').value) throw Error('Upload a resume first');

    $('aiOutput').textContent = 'Generating…';

    const result = await api('/ai/' + $('aiKind').value, {
      method: 'POST',
      body: JSON.stringify({
        resume_id: Number($('aiResume').value),
        job_description: $('aiJob').value,
        question: $('question').value,
      }),
    });

    lastOutput = result.content;
    $('aiOutput').textContent = lastOutput;
    toast('AI result saved');
  } catch (e) {
    $('aiOutput').textContent = '';
    toast(e.message);
  }
}

async function exportOutput() {
  try {
    if (!lastOutput) throw Error('Generate AI content first');

    const blob = await api('/export/pdf', {
      method: 'POST',
      body: JSON.stringify({
        title: 'ResumeAI ' + $('aiKind').selectedOptions[0].text,
        content: lastOutput,
      }),
    });

    saveBlob(blob, 'resumeai-report.pdf');
  } catch (e) {
    toast(e.message);
  }
}

async function showGeneration(id) {
  try {
    const generations = await api('/generations');
    const generation = generations.find((g) => g.id === id);
    if (!generation) return;

    lastOutput = generation.content;
    $('aiOutput').textContent = generation.content;
    showTab('tools');
  } catch (e) {
    toast(e.message);
  }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
async function showTab(tab) {
  document.querySelectorAll('.tab').forEach((el) => {
    el.hidden = el.id !== tab;
  });
  document.querySelectorAll('nav button').forEach((el) => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });

  try {
    if (tab === 'history') {
      const activities = await api('/activities');
      $('activityList').innerHTML =
        activities
          .map(
            (a) => `
            <div class="item">
              <div>
                <b>${esc(a.action)}</b> — ${esc(a.detail)}
                <small>${esc(a.created_at)}</small>
              </div>
            </div>`
          )
          .join('') || 'No activity';
    }

    if (tab === 'library') {
      const generations = await api('/generations');
      $('generationList').innerHTML =
        generations
          .map(
            (g) => `
            <div class="item">
              <div>
                <b>${esc(g.kind)}</b>
                <small>${esc(g.created_at)}</small>
              </div>
              <button onclick="showGeneration(${g.id})">View</button>
            </div>`
          )
          .join('') || 'No AI generations';
    }

    if (tab === 'admin') {
      const stats = await api('/admin/stats');
      const metrics = ['users', 'resumes', 'analyses', 'ai_generations']
        .map((k) => `<div class="metric">${k}<strong>${stats[k]}</strong></div>`)
        .join('');
      const recent = stats.recent_activity
        .map(
          (x) => `
          <div class="item">
            ${esc(x.email)} — ${esc(x.action)} — ${esc(x.detail)}
            <small>${esc(x.created_at)}</small>
          </div>`
        )
        .join('');

      $('adminStats').innerHTML = `
        <div class="metrics">${metrics}</div>
        <h3>Recent activity</h3>
        ${recent}`;
    }
  } catch (e) {
    toast(e.message);
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
document.querySelectorAll('nav button').forEach((button) => {
  button.addEventListener('click', () => showTab(button.dataset.tab));
});

if (token) init();