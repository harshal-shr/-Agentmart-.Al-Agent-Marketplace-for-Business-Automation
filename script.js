/* ===================== DATA LAYER (localStorage) ===================== */
const DB_KEY = 'agentmart_db_v1';
const THEME_KEY = 'agentmart_theme';
const ACTIVE_CONV_KEY = 'agentmart_active_conv';
const SUPPORT_EMAIL = 'harshalmohite28@gmail.com';

function loadDB(){
  let db = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
  if(!db){
    db = {
      users: [],
      currentUserId: null,
      systems: [
        {id:'sys1', ownerId:'seed', ownerName:'Testing Desktop', title:'Lead Qualifier Agent', desc:'Scores inbound leads using CRM + email signals and routes hot leads to sales instantly.', url:'https://example.com/demo', status:'open', stack:['OpenAI','LangChain','Python']},
        {id:'sys2', ownerId:'seed', ownerName:'Testing Desktop', title:'Support Ticket Triage Bot', desc:'Classifies and auto-tags incoming support tickets, drafts first-response replies.', url:'https://example.com/demo2', status:'open', stack:['OpenAI','Slack Bot']}
      ],
      needs: [
        {id:'req1', ownerId:'seed', ownerName:'Acme Retail Co.', title:'Automate WhatsApp customer replies', desc:'Need an agent to auto-handle common WhatsApp customer questions (order status, returns).', duration:'3 weeks', status:'open'},
        {id:'req2', ownerId:'seed', ownerName:'Northwind Logistics', title:'Invoice data extraction pipeline', desc:'Extract line-items from vendor invoice PDFs into our ERP automatically.', duration:'2 weeks', status:'open'}
      ],
      conversations: []   // { id, participants:[userIdA,userIdB], names:{id:name}, messages:[{from,text,ts}] }
    };
    saveDB(db);
  }
  if(!db.conversations) db.conversations = [];
  return db;
}
function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }
let db = loadDB();

function currentUser(){
  return db.users.find(u => u.id === db.currentUserId) || null;
}
function uid(){ return 'id_' + Math.random().toString(36).slice(2,10); }

/* ===================== TOAST (jQuery animation) ===================== */
function toast(msg){
  const $t = $('#toast');
  $t.stop(true, true).text(msg).fadeIn(200);
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => $t.fadeOut(400), 2200);
}
function copySupport(btn){
  navigator.clipboard?.writeText(SUPPORT_EMAIL);
  const $btn = $(btn);
  const original = $btn.text();
  $btn.text('✓ Copied!').prop('disabled', true);
  setTimeout(() => $btn.text(original).prop('disabled', false), 1500);
  toast('Support email copied: ' + SUPPORT_EMAIL);
}

/* ===================== THEME ===================== */
function applyTheme(mode){
  document.documentElement.setAttribute('data-theme', mode);
  const icon = mode==='light' ? '☀️' : '🌙';
  $('#theme-btn, #theme-btn-landing').text(icon);
  localStorage.setItem(THEME_KEY, mode);
}
function toggleTheme(){
  const current = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(current==='dark' ? 'light' : 'dark');
}

/* ===================== VALIDATION HELPERS ===================== */
function isValidEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ===================== AUTH (auth.html) ===================== */
function switchAuth(which){
  document.getElementById('auth-login').style.display = which==='login' ? 'block':'none';
  document.getElementById('auth-register').style.display = which==='register' ? 'block':'none';
}
function toggleRegRole(){
  const isClient = document.getElementById('role-client').checked;
  document.getElementById('reg-company-wrap').style.display = isClient ? 'block':'none';
  document.getElementById('reg-github-wrap').style.display = isClient ? 'none':'block';
}
function togglePasswordVisibility(inputId, eyeEl){
  const input = document.getElementById(inputId);
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  eyeEl.textContent = showing ? '👁' : '🙈';
}

function handleRegister(){
  const role = document.querySelector('input[name="reg-role"]:checked').value;
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const company = document.getElementById('reg-company').value.trim();
  const github = document.getElementById('reg-github').value.trim();
  const linkedin = document.getElementById('reg-linkedin').value.trim();

  if(!name || !email || !password){ toast('Please fill all required fields.'); return; }
  if(!isValidEmail(email)){ toast('Please enter a valid email address.'); return; }
  if(password.length < 6){ toast('Password must be at least 6 characters.'); return; }
  if(role==='client' && !company){ toast('Company name is required for business clients.'); return; }
  if(db.users.some(u => u.email === email)){ toast('An account with this email already exists.'); return; }

  const user = { id: uid(), role, name, email, password, company, github, linkedin, handle:'', bio:'', avatarUrl:'' };
  db.users.push(user);
  db.currentUserId = user.id;
  saveDB(db);
  window.location.href = 'feed.html';
}

function handleLogin(){
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if(!email || !password){ toast('Please enter email and password.'); return; }
  const user = db.users.find(u => u.email === email && u.password === password);
  if(!user){ toast('Invalid email or password.'); return; }
  db.currentUserId = user.id;
  saveDB(db);
  window.location.href = 'feed.html';
}

function handleLogout(){
  db.currentUserId = null;
  saveDB(db);
  window.location.href = 'index.html';
}

/* ===================== APP PAGE GUARD (feed/needs/portal/inbox/profile) =====================
   Call at the top of every app page. Redirects to auth.html if not logged in,
   fills the shared topbar, and highlights the current nav tab (all via jQuery). */
function guardApp(pageName){
  const u = currentUser();
  if(!u){ window.location.href = 'auth.html'; return null; }
  $('#topbar-role').text(u.role === 'developer' ? 'DEVELOPER' : 'CLIENT')
                    .toggleClass('client', u.role === 'client');
  $('.nav-tab').removeClass('active');
  $('.nav-tab[data-tab="' + pageName + '"]').addClass('active');
  return u;
}

/* Fades a freshly-rendered list of .card-item nodes in, staggered (jQuery animation) */
function fadeInCards(containerSelector){
  $(containerSelector).find('.card-item').hide().each(function(i){
    $(this).delay(i * 40).fadeIn(300);
  });
}

/* ===================== MESSAGING / INBOX ===================== */
let activeConvId = localStorage.getItem(ACTIVE_CONV_KEY) || null;

function findOrCreateConversation(otherId, otherName){
  const u = currentUser();
  let conv = db.conversations.find(c => c.participants.includes(u.id) && c.participants.includes(otherId));
  if(!conv){
    conv = { id: uid(), participants:[u.id, otherId], names:{[u.id]:u.name, [otherId]:otherName}, messages:[] };
    db.conversations.push(conv);
    saveDB(db);
  }
  return conv;
}
function contactOwner(ownerId, ownerName){
  const u = currentUser();
  if(ownerId === u.id){ toast('This is your own listing.'); return; }
  const conv = findOrCreateConversation(ownerId, ownerName);
  localStorage.setItem(ACTIVE_CONV_KEY, conv.id);
  window.location.href = 'inbox.html';
}
function renderInbox(){
  const u = currentUser();
  const $list = $('#conv-list');
  const myConvs = db.conversations.filter(c => c.participants.includes(u.id));
  if(myConvs.length===0){
    $list.html(`<div class="p-3 text-muted small">No conversations yet.</div>`);
  } else {
    $list.html(myConvs.map(c => {
      const otherId = c.participants.find(p => p!==u.id);
      const otherName = c.names[otherId] || 'Unknown';
      const last = c.messages[c.messages.length-1];
      return `<div class="conv-row ${activeConvId===c.id?'active':''}" onclick="openConversation('${c.id}')">
        <div class="fw-semibold small">${escapeHtml(otherName)}</div>
        <div class="text-muted small text-truncate">${last ? escapeHtml(last.text) : 'No messages yet'}</div>
      </div>`;
    }).join(''));
  }
  if(activeConvId) openConversation(activeConvId);
}
function openConversation(convId){
  activeConvId = convId;
  localStorage.setItem(ACTIVE_CONV_KEY, convId);
  const u = currentUser();
  const conv = db.conversations.find(c => c.id===convId);
  if(!conv) return;
  $('#chat-empty').hide();
  $('#chat-window').css('display','flex');
  const otherId = conv.participants.find(p => p!==u.id);
  $('#chat-with').text(conv.names[otherId] || 'Unknown');
  const $msgBox = $('#chat-messages');
  $msgBox.html(conv.messages.map(m => `
    <div class="chat-bubble ${m.from===u.id?'mine':'theirs'}">${escapeHtml(m.text)}</div>
  `).join('') || `<div class="text-muted small">Say hello to start the conversation.</div>`);
  $msgBox.scrollTop($msgBox[0].scrollHeight);
  $('.conv-row').removeClass('active');
}
function sendMessage(){
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text || !activeConvId) return;
  const u = currentUser();
  const conv = db.conversations.find(c => c.id===activeConvId);
  conv.messages.push({from:u.id, text, ts:Date.now()});
  saveDB(db);
  input.value='';
  renderInbox();
}

/* ===================== FEED ===================== */
let activeFilters = new Set();
const ALL_TAGS = ['OpenAI','LangChain','Python','Slack Bot','Database'];

function renderFeedFilters(){
  $('#feed-filters').html(ALL_TAGS.map(tag =>
    `<span class="filter-chip ${activeFilters.has(tag)?'active':''}" onclick="toggleFilter('${tag}')">${tag}</span>`
  ).join(''));
}
function toggleFilter(tag){
  activeFilters.has(tag) ? activeFilters.delete(tag) : activeFilters.add(tag);
  renderFeedFilters();
  renderFeed();
}

function renderFeed(){
  renderFeedFilters();
  const u = currentUser();
  const q = (document.getElementById('feed-search').value || '').toLowerCase();
  let items = db.systems.filter(s => {
    const matchesQ = !q || s.title.toLowerCase().includes(q) || s.stack.join(' ').toLowerCase().includes(q);
    const matchesTags = activeFilters.size===0 || s.stack.some(t => activeFilters.has(t));
    return matchesQ && matchesTags;
  });

  if(items.length===0){
    $('#feed-list').html(`<div class="col-12"><div class="empty-state panel">No systems match your filters yet.</div></div>`);
    return;
  }

  $('#feed-list').html(items.map((s) => {
    const isOwner = u && s.ownerId === u.id;
    return `
    <div class="col-md-6">
      <div class="card-item h-100">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <div class="fw-semibold">${escapeHtml(s.title)}</div>
            <div class="text-muted small">By ${escapeHtml(s.ownerName)}</div>
          </div>
          <span class="status-tag ${s.status==='open'?'status-open':'status-booked'}">${s.status==='open'?'OPEN':'BOOKED'}</span>
        </div>
        <p class="small text-muted mb-2">${escapeHtml(s.desc || '')}</p>
        <div class="mb-2">${s.stack.map(t=>`<span class="stack-chip">${escapeHtml(t)}</span>`).join('')}</div>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
          ${s.url ? `<a href="${escapeAttr(s.url)}" target="_blank" class="small" style="color:var(--teal)">View demo →</a>` : '<span></span>'}
          <div class="d-flex gap-2">
            ${isOwner ? `
              <button class="btn btn-outline-line btn-sm" onclick="deleteSystem('${s.id}')">Delete</button>
            ` : `
              <button class="btn btn-outline-line btn-sm" onclick="contactOwner('${s.ownerId}','${escapeAttr(s.ownerName)}')">Message</button>
              ${s.status==='open' ? `<button class="btn btn-amber btn-sm" onclick="bookSystem('${s.id}')">Book Now</button>` : ''}
            `}
          </div>
        </div>
      </div>
    </div>
  `}).join(''));
  fadeInCards('#feed-list');
}
function bookSystem(id){
  const s = db.systems.find(x=>x.id===id);
  if(!s) return;
  s.status = 'booked';
  saveDB(db);
  renderFeed();
  toast('System booked.');
}
function deleteSystem(id){
  db.systems = db.systems.filter(s=>s.id!==id);
  saveDB(db);
  renderFeed();
  toast('Listing deleted.');
}

/* ===================== BUSINESS NEEDS ===================== */
function showPostRequirement(){ $('#post-req-form').slideDown(200); }
function cancelReqForm(){
  $('#post-req-form').slideUp(150);
  document.getElementById('req-title').value='';
  document.getElementById('req-desc').value='';
}
function submitRequirement(){
  const title = document.getElementById('req-title').value.trim();
  const desc = document.getElementById('req-desc').value.trim();
  const duration = document.getElementById('req-duration').value;
  if(!title || !desc){ toast('Please fill title and description.'); return; }
  const u = currentUser();
  db.needs.unshift({id:uid(), ownerId:u.id, ownerName:u.company || u.name, title, desc, duration, status:'open'});
  saveDB(db);
  cancelReqForm();
  renderNeeds();
  toast('Requirement published.');
}
function renderNeeds(){
  const u = currentUser();
  const isClient = u && u.role === 'client';
  $('#post-req-btn').toggle(isClient);

  const q = (document.getElementById('needs-search').value || '').toLowerCase();
  const items = db.needs.filter(n => !q || n.title.toLowerCase().includes(q));

  if(items.length===0){
    $('#needs-list').html(`<div class="empty-state panel">No business requirements match your search.</div>`);
    return;
  }
  $('#needs-list').html(items.map((n) => {
    const isOwner = u && n.ownerId === u.id;
    const isDev = u && u.role === 'developer';
    return `
    <div class="card-item">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-semibold">${escapeHtml(n.title)}</div>
          <div class="text-muted small mb-2">Posted by: ${escapeHtml(n.ownerName)}</div>
        </div>
        <span class="status-tag ${n.status==='open'?'status-open':'status-booked'}">${n.status==='open'?'OPEN TO BUILD':'BOOKED'}</span>
      </div>
      <p class="small text-muted mb-2">${escapeHtml(n.desc)}</p>
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span class="stack-chip">Duration: ${escapeHtml(n.duration)}</span>
        <div class="d-flex gap-2">
          ${isOwner ? `
            <button class="btn btn-outline-line btn-sm" onclick="deleteRequirement('${n.id}')">Delete</button>
          ` : `
            <button class="btn btn-outline-line btn-sm" onclick="contactOwner('${n.ownerId}','${escapeAttr(n.ownerName)}')">Message</button>
            ${(isDev && n.status==='open') ? `<button class="btn btn-amber btn-sm" onclick="bookRequirement('${n.id}')">Take This</button>` : ''}
          `}
        </div>
      </div>
    </div>
  `}).join(''));
  fadeInCards('#needs-list');
}
function bookRequirement(id){
  const n = db.needs.find(x=>x.id===id);
  if(!n) return;
  n.status='booked';
  saveDB(db);
  renderNeeds();
  toast('Requirement marked as booked.');
}
function deleteRequirement(id){
  db.needs = db.needs.filter(n=>n.id!==id);
  saveDB(db);
  renderNeeds();
  toast('Requirement deleted.');
}

/* ===================== CREATOR PORTAL ===================== */
function renderPortal(){
  const u = currentUser();
  const isDev = u.role === 'developer';
  $('#portal-locked').toggle(!isDev);
  $('#portal-form-wrap').toggle(isDev);
}
function publishSystem(){
  const u = currentUser();
  const title = document.getElementById('sys-title').value.trim();
  const url = document.getElementById('sys-url').value.trim();
  const status = document.getElementById('sys-status').value;
  const desc = document.getElementById('sys-desc').value.trim();
  const stackRaw = document.getElementById('sys-stack').value.trim();
  if(!title || !url || !desc){ toast('Please fill all required fields.'); return; }
  const stack = stackRaw ? stackRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];
  db.systems.unshift({id:uid(), ownerId:u.id, ownerName:u.name, title, url, status, desc, stack});
  saveDB(db);
  ['sys-title','sys-url','sys-desc','sys-stack'].forEach(id => document.getElementById(id).value='');
  toast('System published to marketplace.');
  window.location.href = 'feed.html';
}

/* ===================== PROFILE ===================== */
function renderProfile(){
  const u = currentUser();
  if(!u) return;
  document.getElementById('profile-name').value = u.name || '';
  document.getElementById('profile-handle').value = u.handle || '';
  document.getElementById('profile-avatar-url').value = u.avatarUrl || '';
  document.getElementById('profile-bio').value = u.bio || '';
  document.getElementById('profile-github').value = u.github || '';
  document.getElementById('profile-linkedin').value = u.linkedin || '';
  document.getElementById('profile-company').value = u.company || '';
  $('#profile-company-wrap').toggle(u.role==='client');
  $('#profile-name-display').text(u.name);
  $('#profile-role-display').text(u.role==='developer' ? 'AI DEVELOPER' : 'BUSINESS CLIENT')
                              .toggleClass('client', u.role==='client');

  const $avatar = $('#profile-avatar');
  const liveUrl = document.getElementById('profile-avatar-url').value.trim();
  if(liveUrl){
    $avatar.css({backgroundImage:`url('${liveUrl.replace(/'/g,"")}')`, backgroundSize:'cover', backgroundPosition:'center'}).text('');
  } else {
    $avatar.css('backgroundImage','none').text((u.name||'??').slice(0,2).toUpperCase());
  }
}
function saveProfile(){
  const u = currentUser();
  u.name = document.getElementById('profile-name').value.trim() || u.name;
  u.handle = document.getElementById('profile-handle').value.trim();
  u.avatarUrl = document.getElementById('profile-avatar-url').value.trim();
  u.bio = document.getElementById('profile-bio').value.trim();
  u.github = document.getElementById('profile-github').value.trim();
  u.linkedin = document.getElementById('profile-linkedin').value.trim();
  if(u.role==='client') u.company = document.getElementById('profile-company').value.trim();
  saveDB(db);
  renderProfile();
  toast('Profile saved.');
}

/* ===================== UTIL ===================== */
function escapeHtml(str){
  return (str||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(str){ return escapeHtml(str); }

/* ===================== INIT (runs on every page) ===================== */
$(function(){
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  if(document.getElementById('role-dev')) toggleRegRole();
});
