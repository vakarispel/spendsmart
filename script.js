// v3
// ── Supabase konfigūracija ─────────────────────────────────────
const SUPABASE_URL = 'https://uhhaajvmysehhezcmfmn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoaGFhanZteXNlaGhlemNtZm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MDE1ODUsImV4cCI6MjA5MjE3NzU4NX0.32WovgoP_JFAUgft533e5gd2xWHvhdLUU2JoeDFrk7Q';

// ── Auth per tiesioginius fetch (be Supabase bibliotekos) ──────
const AUTH_KEY = 'ss_session';

function saveSession(data) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
}

function clearSession() {
  localStorage.removeItem(AUTH_KEY);
}

// Fake sb objektas su tiesioginiais fetch kvietimais
const sb = {
  _session: loadSession(),

  auth: {
    async signUp({ email, password, options }) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, data: options?.data || {} })
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: data };
      if (data.access_token) { sb._session = data; saveSession(data); }
      return { data, error: null };
    },

    async signInWithPassword({ email, password }) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) return { data: { session: null }, error: data };
      sb._session = data;
      saveSession(data);
      return { data: { session: data, user: data.user }, error: null };
    },

    async signOut() {
      const session = loadSession();
      if (session?.access_token) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${session.access_token}` }
        }).catch(() => {});
      }
      sb._session = null;
      clearSession();
      currentSession = null;
      cachedTransactions = [];
      renderLoggedOut();
    },

    async getSession() {
      const session = loadSession();
      return { data: { session } };
    },

    onAuthStateChange(callback) {
      // Iššaukiam iš karto su esama sesija
      const session = loadSession();
      setTimeout(() => {
        callback(session ? 'INITIAL_SESSION' : 'INITIAL_SESSION', session);
      }, 0);
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  },

  from(table) {
    const session = loadSession();
    const headers = {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || SUPABASE_KEY}`
    };
    const base = `${SUPABASE_URL}/rest/v1/${table}`;

    return {
      select(cols = '*') {
        return {
          order(col, { ascending } = {}) { return this; },
          async then(resolve) {
            const res = await fetch(`${base}?select=${cols}&order=date.desc`, { headers });
            const data = await res.json();
            resolve(res.ok ? { data, error: null } : { data: null, error: data });
          }
        };
      },
      async insert(row) {
        const res = await fetch(base, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify(row)
        });
        return res.ok ? { error: null } : { error: await res.json() };
      },
      update(fields) {
        return {
          eq(col, val) {
            return {
              async then(resolve) {
                const res = await fetch(`${base}?${col}=eq.${val}`, {
                  method: 'PATCH',
                  headers: { ...headers, 'Prefer': 'return=minimal' },
                  body: JSON.stringify(fields)
                });
                resolve(res.ok ? { error: null } : { error: await res.json() });
              }
            };
          }
        };
      },
      delete() {
        return {
          eq(col, val) {
            return {
              async then(resolve) {
                const res = await fetch(`${base}?${col}=eq.${val}`, {
                  method: 'DELETE',
                  headers
                });
                resolve(res.ok ? { error: null } : { error: await res.json() });
              }
            };
          }
        };
      }
    };
  }
};

// Tema išlieka localStorage (tai tik UI nustatymas, ne duomenys)
const STORAGE_KEYS = { theme: 'spendsmart_theme' };

// ── DOM elementai ──────────────────────────────────────────────
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const sessionActions = document.getElementById('sessionActions');
const welcomeText = document.getElementById('welcomeText');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const transactionForm = document.getElementById('transactionForm');
const transactionList = document.getElementById('transactionList');
const emptyState = document.getElementById('emptyState');
const filterType = document.getElementById('filterType');
const searchInput = document.getElementById('searchInput');
const logoutBtn = document.getElementById('logoutBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const toast = document.getElementById('toast');
const emptyStateBtn = document.getElementById('emptyStateBtn');
const transactionSubmitBtn = document.getElementById('transactionSubmitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const dateInput = document.getElementById('transactionDate');
const transactionFormTitle = document.getElementById('transactionFormTitle');
const transactionFormSubtitle = document.getElementById('transactionFormSubtitle');
const editNotice = document.getElementById('editNotice');
const operationsSection = document.getElementById('operationsSection');
const formCard = document.querySelector('.form-card');
const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
const transactionType = document.getElementById('transactionType');
const transactionCategory = document.getElementById('transactionCategory');
const navItems = Array.from(document.querySelectorAll('.nav-item'));
const sectionAnchors = Array.from(document.querySelectorAll('.section-anchor'));

const transactionAmountInput = document.getElementById('transactionAmount');
const transactionDescriptionInput = document.getElementById('transactionDescription');
const registerNameInput = document.getElementById('registerName');
const registerEmailInput = document.getElementById('registerEmail');
const registerPasswordInput = document.getElementById('registerPassword');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');

const dashboardAdAmount = document.getElementById('dashboardAdAmount');
const dashboardAdTerm = document.getElementById('dashboardAdTerm');
const dashboardAdAmountValue = document.getElementById('dashboardAdAmountValue');
const dashboardAdTermValue = document.getElementById('dashboardAdTermValue');
const dashboardAdMonthly = document.getElementById('dashboardAdMonthly');
const dashboardAdTotal = document.getElementById('dashboardAdTotal');
const dashboardAdRate = document.getElementById('dashboardAdRate');
const dashboardAdOfferMonthly = document.getElementById('dashboardAdOfferMonthly');

const trendCanvas = document.getElementById('trendChart');
const expenseCanvas = document.getElementById('expenseChart');

const adRefs = {
  top: {
    avatar: document.getElementById('topAdAvatar'),
    brand: document.getElementById('topAdBrand'),
    url: document.getElementById('topAdUrl'),
    deviceUrl: document.getElementById('topAdDeviceUrl'),
    kicker: document.getElementById('topAdKicker'),
    title: document.getElementById('topAdTitle'),
    desc: document.getElementById('topAdDesc'),
    chips: document.getElementById('topAdChips'),
    rating: document.getElementById('topAdRating'),
    reviews: document.getElementById('topAdReviews'),
    note: document.getElementById('topAdNote'),
    metric: document.getElementById('topAdMetric'),
    btnPrimary: document.getElementById('topAdBtnPrimary'),
    btnSecondary: document.getElementById('topAdBtnSecondary'),
    dots: document.getElementById('topAdDots')
  },
  native: {
    avatar: document.getElementById('nativeAdAvatar'),
    brand: document.getElementById('nativeAdBrand'),
    url: document.getElementById('nativeAdUrl'),
    kicker: document.getElementById('nativeAdKicker'),
    title: document.getElementById('nativeAdTitle'),
    desc: document.getElementById('nativeAdDesc'),
    points: document.getElementById('nativeAdPoints'),
    smallBrand: document.getElementById('nativeAdSmallBrand'),
    price: document.getElementById('nativeAdPrice'),
    rating: document.getElementById('nativeAdRating'),
    meta: document.getElementById('nativeAdMeta'),
    meta2: document.getElementById('nativeAdMeta2'),
    btn: document.getElementById('nativeAdBtn'),
    dots: document.getElementById('nativeAdDots')
  }
};

const totals = {
  income: document.getElementById('incomeTotal'),
  expense: document.getElementById('expenseTotal'),
  balance: document.getElementById('balanceTotal'),
  heroBalance: document.getElementById('heroBalance'),
  count: document.getElementById('transactionCount'),
  monthlyDifference: document.getElementById('monthlyDifference'),
  topCategory: document.getElementById('topCategory'),
  lastTransaction: document.getElementById('lastTransaction'),
  currentMonthExpense: document.getElementById('currentMonthExpense'),
  currentMonthIncome: document.getElementById('currentMonthIncome'),
  sidebarGoal: document.getElementById('sidebarGoal'),
  goalText: document.getElementById('goalText')
};

const CATEGORY_MAP = {
  income: ['Alga', 'Premija', 'Stipendija', 'Laisvai samdomas darbas', 'Pardavimai', 'Dovanos', 'Kita'],
  expense: ['Maistas', 'Transportas', 'Būstas', 'Sąskaitos', 'Mokslai', 'Laisvalaikis', 'Sveikata', 'Kita']
};

const DEMO_ADS = {
  top: [
    {
      brand: 'PaskolaGo', avatar: '€', url: 'paskolago.lt',
      kicker: 'Greita vartojimo paskola',
      title: 'Gauk iki 15 000 € internetu per kelias minutes',
      desc: 'Pateik paraišką nuotoliu, gauk atsakymą greitai ir matyk preliminarias sąlygas be papildomo vizito skyriuje.',
      chips: ['Atsakymas per 2 min.', 'Nuo 8,9% BVKKMN', 'Be užstato'],
      rating: '4.7/5', reviews: '9 000+ paraiškų',
      note: 'Demo reklamos blokas, stilizuotas kaip tikras paskolos pasiūlymas.',
      metric: 'Iki €15k', ctaPrimary: 'Pildyti paraišką', ctaSecondary: 'Žiūrėti sąlygas'
    },
    {
      brand: 'CreditNow', avatar: 'C', url: 'creditnow.lt',
      kicker: 'Paskola būstui ar remontui',
      title: 'Palygink kredito pasiūlymus ir rask mažesnę mėnesio įmoką',
      desc: 'Vienoje vietoje peržiūrėk kelis pasiūlymus, preliminarią įmoką ir galimą finansavimo sumą pagal tavo poreikį.',
      chips: ['Iki 25 000 €', 'Keli partneriai', 'Paraiška internetu'],
      rating: '4.8/5', reviews: '11 500+ užklausų',
      note: 'Šviesus native bannerio stilius sukurtas tam, kad reklama išsiskirtų tamsiame dashboarde.',
      metric: '€25k', ctaPrimary: 'Gauti pasiūlymą', ctaSecondary: 'Skaičiuoti įmoką'
    },
    {
      brand: 'Lizingas+', avatar: 'L', url: 'lizingasplus.lt',
      kicker: 'Refinansavimas ir lizingas',
      title: 'Sujunk kelias įmokas į vieną ir paprasčiau planuok mėnesio biudžetą',
      desc: 'Greitas refinansavimo pasiūlymas su aiškia mėnesio įmoka, terminu ir preliminaria bendra kredito kaina.',
      chips: ['Refinansavimas', 'Fiksuota įmoka', 'Atsakymas tą pačią dieną'],
      rating: '4.6/5', reviews: '6 800+ klientų',
      note: 'Demo reklama su aiškiais CTA ir kredito pasiūlymo stilistika.',
      metric: '1 įmoka', ctaPrimary: 'Pildyti paraišką', ctaSecondary: 'Peržiūrėti'
    }
  ],
  native: [
    {
      brand: 'RefiPlus', avatar: 'R', url: 'refiplus.lt',
      kicker: 'Paskolos refinansavimas',
      title: 'Sujunk įmokas į vieną mokėjimą ir sumažink mėnesio naštą',
      desc: 'Palygink refinansavimo pasiūlymus, gauk individualias sąlygas ir matyk preliminarią mėnesio įmoką iš karto.',
      points: ['Atsakymas per 2 min.', 'Galima mažesnė mėnesio įmoka', 'Paraiška internetu 24/7'],
      price: 'Nuo 7,9% BVKKMN', rating: '4.6/5', meta: 'Be užstato', meta2: 'Sprendimas internetu', cta: 'Gauti pasiūlymą'
    },
    {
      brand: 'MiniCredit', avatar: 'M', url: 'minicredit.lt',
      kicker: 'Trumpalaikė paskola',
      title: 'Skubioms išlaidoms – sprendimas per kelias minutes',
      desc: 'Kai reikia greito finansavimo netikėtoms išlaidoms, pateik paraišką ir peržiūrėk individualų pasiūlymą internetu.',
      points: ['Iki 5 000 €', 'Aiškios sąlygos', 'Greitas atsakymas'],
      price: 'Iki €5 000', rating: '4.5/5', meta: 'Be popierinių dokumentų', meta2: 'Darbo dienomis greitai', cta: 'Pildyti paraišką'
    },
    {
      brand: 'HomeLoan', avatar: 'H', url: 'homeloan.lt',
      kicker: 'Paskola remontui',
      title: 'Atnaujink namus su lankstesniu finansavimo planu',
      desc: 'Pasitikrink preliminarią paskolos sumą, terminą ir mėnesio įmoką prieš priimdamas sprendimą.',
      points: ['Iki 20 000 €', 'Lankstus terminas', 'Aiški mėnesio įmoka'],
      price: 'Nuo 119 €/mėn.', rating: '4.8/5', meta: 'Skaičiuoklė internete', meta2: 'Partnerių pasiūlymai', cta: 'Skaičiuoti įmoką'
    }
  ]
};

// ── Būsena ────────────────────────────────────────────────────
const adRotationState = { top: 0, native: 0 };
let editingTransactionId = null;
let currentSession = null;       // Supabase sesija
let cachedTransactions = [];     // Lokalus cache, kad neikartotų fetch'ų

// ── Init ──────────────────────────────────────────────────────
if (dateInput) dateInput.valueAsDate = new Date();
updateCategoryOptions(transactionType?.value || 'income');

window.addEventListener('resize', () => {
  drawTrendChart(cachedTransactions);
  drawExpenseChart(cachedTransactions);
});

// Auth inicializacija vyksta initApp() funkcijoje

// ── Auth funkcijos ─────────────────────────────────────────────
async function registerUser(name, email, password) {
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
  if (error) throw error;
  return data;
}

async function loginUser(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentSession = data.session;
  return data;
}

async function logoutUser() {
  await sb.auth.signOut();
}

function getCurrentUserName() {
  const session = loadSession();
  return session?.user?.user_metadata?.name || session?.user?.email || '';
}

// ── Transakcijų CRUD per Supabase ─────────────────────────────
async function fetchTransactions() {
  const { data, error } = await sb
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function insertTransaction(tx) {
  const { error } = await sb.from('transactions').insert({
    user_id: currentSession.user.id,
    type: tx.type,
    amount: tx.amount,
    category: tx.category,
    date: tx.date,
    description: tx.description,
    registered: false
  });
  if (error) throw error;
}

async function updateTransactionInDb(id, fields) {
  const { error } = await sb.from('transactions').update(fields).eq('id', id);
  if (error) throw error;
}

async function deleteTransactionInDb(id) {
  const { error } = await sb.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

async function deleteAllTransactions() {
  const { error } = await sb
    .from('transactions')
    .delete()
    .eq('user_id', currentSession.user.id);
  if (error) throw error;
}

// ── Pagrindinis render srautas ─────────────────────────────────
async function loadAndRenderApp() {
  cachedTransactions = await fetchTransactions();
  renderDashboard(cachedTransactions);
}

function renderLoggedOut() {
  authSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  sessionActions.classList.add('hidden');
}

function renderDashboard(transactions) {
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  sessionActions.classList.remove('hidden');
  welcomeText.textContent = `Prisijungęs: ${getCurrentUserName()}`;

  renderTransactions(transactions);
  updateSummary(transactions);
  updateInsights(transactions);
  drawTrendChart(transactions);
  drawExpenseChart(transactions);
  updateActiveSectionByScroll();
}

// ── Reklamos ──────────────────────────────────────────────────
function renderAdDots(container, items, activeIndex) {
  if (!container) return;
  container.innerHTML = items.map((_, index) => `
    <span class="ad-dot ${index === activeIndex ? 'active' : ''}" aria-hidden="true"></span>
  `).join('');
}

function renderTopAd(index = 0) {
  const ad = DEMO_ADS.top[index];
  const refs = adRefs.top;
  if (!ad || !refs.title) return;
  refs.avatar.textContent = ad.avatar;
  refs.brand.textContent = ad.brand;
  refs.url.textContent = ad.url;
  refs.deviceUrl.textContent = ad.url;
  refs.kicker.textContent = ad.kicker;
  refs.title.textContent = ad.title;
  refs.desc.textContent = ad.desc;
  refs.rating.textContent = ad.rating;
  refs.reviews.textContent = ad.reviews;
  refs.note.textContent = ad.note;
  refs.metric.textContent = ad.metric;
  refs.btnPrimary.textContent = ad.ctaPrimary;
  refs.btnSecondary.textContent = ad.ctaSecondary;
  refs.btnPrimary.dataset.adName = ad.title;
  refs.btnSecondary.dataset.adName = ad.title;
  refs.chips.innerHTML = ad.chips.map(chip => `<span>${chip}</span>`).join('');
  renderAdDots(refs.dots, DEMO_ADS.top, index);
}

function renderNativeAd(index = 0) {
  const ad = DEMO_ADS.native[index];
  const refs = adRefs.native;
  if (!ad || !refs.title) return;
  refs.avatar.textContent = ad.avatar;
  refs.brand.textContent = ad.brand;
  refs.url.textContent = ad.url;
  refs.kicker.textContent = ad.kicker;
  refs.title.textContent = ad.title;
  refs.desc.textContent = ad.desc;
  refs.points.innerHTML = ad.points.map(point => `<li>${point}</li>`).join('');
  refs.smallBrand.textContent = ad.brand.toUpperCase();
  refs.price.textContent = ad.price;
  refs.rating.textContent = ad.rating;
  refs.meta.textContent = ad.meta;
  refs.meta2.textContent = ad.meta2;
  refs.btn.textContent = ad.cta;
  refs.btn.dataset.adName = ad.title;
  renderAdDots(refs.dots, DEMO_ADS.native, index);
}

function startAdRotation() {
  renderTopAd(adRotationState.top);
  renderNativeAd(adRotationState.native);
  if (startAdRotation.started) return;
  startAdRotation.started = true;
  setInterval(() => { adRotationState.top = (adRotationState.top + 1) % DEMO_ADS.top.length; renderTopAd(adRotationState.top); }, 6500);
  setInterval(() => { adRotationState.native = (adRotationState.native + 1) % DEMO_ADS.native.length; renderNativeAd(adRotationState.native); }, 8200);
}

// ── Pagalbinės funkcijos ───────────────────────────────────────
function formatCompactCurrency(value) {
  return new Intl.NumberFormat('lt-LT', { maximumFractionDigits: 0 }).format(Number(value || 0)) + ' €';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('lt-LT', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('lt-LT', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateString));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, isError = false) {
  const variant = isError ? 'error' : 'success';
  const icon = isError ? '⚠' : '✓';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><div class="toast-body"><strong>${isError ? 'Klaida' : 'Pavyko'}</strong><span>${message}</span></div>`;
  toast.classList.remove('error', 'success');
  toast.classList.add(variant, 'show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove('show'), 2800);
}

function updateDashboardAdCalculator() {
  if (!dashboardAdAmount || !dashboardAdTerm) return;
  const principal = Number(dashboardAdAmount.value || 5000);
  const months = Number(dashboardAdTerm.value || 48);
  const annualRate = 8.9;
  const monthlyRate = annualRate / 100 / 12;
  const monthlyPayment = monthlyRate === 0
    ? principal / months
    : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  const totalPayment = monthlyPayment * months;
  const monthlyLabel = `${formatCompactCurrency(Math.round(monthlyPayment))} / mėn.`;
  if (dashboardAdAmountValue) dashboardAdAmountValue.textContent = formatCompactCurrency(principal);
  if (dashboardAdTermValue) dashboardAdTermValue.textContent = `${months} mėn.`;
  if (dashboardAdMonthly) dashboardAdMonthly.textContent = monthlyLabel;
  if (dashboardAdOfferMonthly) dashboardAdOfferMonthly.textContent = monthlyLabel;
  if (dashboardAdTotal) dashboardAdTotal.textContent = formatCompactCurrency(Math.round(totalPayment));
  if (dashboardAdRate) dashboardAdRate.textContent = `${annualRate.toFixed(1).replace('.', ',')}%`;
}

// ── Tema ──────────────────────────────────────────────────────
function getThemeColors() {
  const styles = getComputedStyle(document.body);
  return {
    muted: styles.getPropertyValue('--chart-muted').trim() || 'rgba(151,165,195,0.92)',
    text: styles.getPropertyValue('--chart-text').trim() || 'rgba(245,247,255,0.98)',
    cardTop: styles.getPropertyValue('--chart-bg-top').trim() || 'rgba(255,255,255,0.03)',
    cardBottom: styles.getPropertyValue('--chart-bg-bottom').trim() || 'rgba(255,255,255,0.015)',
    centerBg: styles.getPropertyValue('--chart-center-bg').trim() || 'rgba(8,18,33,0.94)',
    border: styles.getPropertyValue('--chart-border').trim() || 'rgba(255,255,255,0.08)',
    tagBg: styles.getPropertyValue('--chart-tag-bg').trim() || 'rgba(255,255,255,0.04)'
  };
}

function updateThemeToggleButton() {
  if (!themeToggleBtn) return;
  const isLight = document.body.dataset.theme === 'light';
  themeToggleBtn.querySelector('.theme-toggle-icon').textContent = isLight ? '☀' : '☾';
  themeToggleBtn.querySelector('.theme-toggle-text').textContent = isLight ? 'Šviesus režimas' : 'Tamsus režimas';
}

function applyTheme(theme) {
  const safeTheme = theme === 'light' ? 'light' : 'dark';
  document.body.dataset.theme = safeTheme;
  localStorage.setItem(STORAGE_KEYS.theme, safeTheme);
  updateThemeToggleButton();
  if (!dashboardSection.classList.contains('hidden')) {
    drawTrendChart(cachedTransactions);
    drawExpenseChart(cachedTransactions);
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || 'dark';
  applyTheme(savedTheme);
}

// ── Validacija ─────────────────────────────────────────────────
function ensureErrorNode(input) {
  if (!input) return null;
  let node = input.parentElement.querySelector('.field-error');
  if (!node) { node = document.createElement('small'); node.className = 'field-error'; input.parentElement.appendChild(node); }
  return node;
}

function setFieldError(input, message) {
  const node = ensureErrorNode(input);
  if (!node) return;
  input.classList.add('input-error');
  node.textContent = message;
}

function clearFieldError(input) {
  if (!input) return;
  input.classList.remove('input-error');
  const node = input.parentElement.querySelector('.field-error');
  if (node) node.textContent = '';
}

function clearFormErrors(form) {
  form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  form.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}

function validateRegisterForm() {
  clearFormErrors(registerForm);
  let valid = true;
  const name = registerNameInput.value.trim();
  const email = registerEmailInput.value.trim();
  const password = registerPasswordInput.value;
  if (name.length < 2) { setFieldError(registerNameInput, 'Įvesk bent 2 simbolių vardą.'); valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError(registerEmailInput, 'Įvesk teisingą el. pašto adresą.'); valid = false; }
  if (!password || password.length < 6) { setFieldError(registerPasswordInput, 'Slaptažodis turi būti bent 6 simbolių.'); valid = false; }
  return valid;
}

function validateLoginForm() {
  clearFormErrors(loginForm);
  let valid = true;
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError(loginEmailInput, 'Įvesk teisingą el. pašto adresą.'); valid = false; }
  if (!password) { setFieldError(loginPasswordInput, 'Įvesk slaptažodį.'); valid = false; }
  return valid;
}

function validateTransactionForm() {
  clearFormErrors(transactionForm);
  let valid = true;
  const amount = parseFloat(transactionAmountInput.value);
  const description = transactionDescriptionInput.value.trim();
  const category = transactionCategory.value;
  const date = dateInput.value;
  if (!Number.isFinite(amount) || amount <= 0) { setFieldError(transactionAmountInput, 'Suma turi būti didesnė už 0.'); valid = false; }
  if (!category) { setFieldError(transactionCategory, 'Pasirink kategoriją.'); valid = false; }
  if (!date) { setFieldError(dateInput, 'Pasirink datą.'); valid = false; }
  if (description.length < 3) { setFieldError(transactionDescriptionInput, 'Aprašymas turi būti bent 3 simbolių.'); valid = false; }
  return valid;
}

// ── Formos UI pagalbinės ───────────────────────────────────────
function updateCategoryOptions(type) {
  if (!transactionCategory) return;
  const categories = CATEGORY_MAP[type] || CATEGORY_MAP.expense;
  const current = transactionCategory.value;
  transactionCategory.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  if (categories.includes(current)) transactionCategory.value = current;
}

function focusTransactionForm({ descriptionFirst = false } = {}) {
  scrollToSection('operationsSection');
  if (formCard) {
    formCard.classList.remove('focus-flash');
    void formCard.offsetWidth;
    formCard.classList.add('focus-flash');
    clearTimeout(focusTransactionForm.flashTimeout);
    focusTransactionForm.flashTimeout = setTimeout(() => formCard.classList.remove('focus-flash'), 1400);
  }
  const target = descriptionFirst ? transactionDescriptionInput : transactionAmountInput;
  setTimeout(() => { if (target) { target.focus(); target.select?.(); } }, 380);
}

function setEditMode(isEditing) {
  if (formCard) formCard.classList.toggle('editing-mode', isEditing);
  if (editNotice) editNotice.classList.toggle('hidden', !isEditing);
  if (transactionFormTitle) transactionFormTitle.textContent = isEditing ? 'Redaguoti finansinį įrašą' : 'Naujas finansinis įrašas';
  if (transactionFormSubtitle) transactionFormSubtitle.textContent = isEditing
    ? 'Pakoreguok pasirinktą įrašą ir išsaugok pakeitimus.'
    : 'Pridėk pajamas arba išlaidas su visa reikalinga informacija.';
  if (transactionSubmitBtn) transactionSubmitBtn.textContent = isEditing ? 'Išsaugoti pakeitimus' : 'Pridėti įrašą';
  if (cancelEditBtn) cancelEditBtn.classList.toggle('hidden', !isEditing);
}

function startEditTransaction(id) {
  const item = cachedTransactions.find(t => t.id === id);
  if (!item) return;
  editingTransactionId = id;
  transactionType.value = item.type;
  updateCategoryOptions(item.type);
  transactionAmountInput.value = item.amount;
  transactionCategory.value = item.category;
  dateInput.value = item.date;
  transactionDescriptionInput.value = item.description;
  renderTransactions(cachedTransactions);
  setEditMode(true);
  focusTransactionForm();
  showToast('Įrašas paruoštas redagavimui.');
}

function stopEditTransaction() {
  editingTransactionId = null;
  transactionForm.reset();
  if (transactionType) transactionType.value = 'income';
  updateCategoryOptions('income');
  if (dateInput) dateInput.valueAsDate = new Date();
  setEditMode(false);
  clearFormErrors(transactionForm);
}

// ── Navigacija ─────────────────────────────────────────────────
function setActiveNav(targetId) {
  navItems.forEach(item => item.classList.toggle('active', item.dataset.target === targetId));
}

function scrollToSection(targetId) {
  const section = document.getElementById(targetId);
  if (!section) return;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setActiveNav(targetId);
}

function updateActiveSectionByScroll() {
  if (dashboardSection.classList.contains('hidden')) return;
  let currentId = 'overviewSection';
  sectionAnchors.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top <= 180) currentId = section.id;
  });
  setActiveNav(currentId);
}

// ── Transakcijų render ─────────────────────────────────────────
function getFilteredTransactions(transactions) {
  const selectedType = filterType.value;
  const searchValue = searchInput.value.trim().toLowerCase();
  return transactions.filter(item => {
    const typeMatch = selectedType === 'all' || item.type === selectedType;
    const text = `${item.description} ${item.category}`.toLowerCase();
    return typeMatch && (!searchValue || text.includes(searchValue));
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderTransactions(transactions) {
  const filtered = getFilteredTransactions(transactions);
  transactionList.innerHTML = '';
  emptyState.classList.toggle('hidden', filtered.length > 0);
  filtered.forEach(item => {
    const wrapper = document.createElement('article');
    wrapper.className = `transaction-item ${editingTransactionId === item.id ? 'editing' : ''}`;
    wrapper.innerHTML = `
      <div class="transaction-badge ${item.type}">${item.type === 'income' ? '+' : '-'}</div>
      <div class="transaction-main">
        <h4>${escapeHtml(item.description)}</h4>
        <div class="transaction-meta">
          <span>${escapeHtml(item.category)}</span>
          <span>${formatDate(item.date)}</span>
          <span>${item.type === 'income' ? 'Pajamos' : 'Išlaidos'}</span>
        </div>
      </div>
      <div class="transaction-right">
        <div class="transaction-amount ${item.type}">${item.type === 'income' ? '+' : '-'} ${formatCurrency(item.amount)}</div>
        <span class="status-pill ${item.registered ? 'done' : 'pending'}">
          ${item.registered ? 'Užregistruota' : 'Laukia'}
        </span>
        <div class="transaction-actions">
          <button class="icon-btn" data-action="edit" data-id="${item.id}">Redaguoti</button>
          <button class="icon-btn success" data-action="toggle" data-id="${item.id}">${item.registered ? 'Atšaukti' : 'Pažymėti'}</button>
          <button class="icon-btn delete" data-action="delete" data-id="${item.id}">Ištrinti</button>
        </div>
      </div>
    `;
    transactionList.appendChild(wrapper);
  });
}

// ── Suvestinė ─────────────────────────────────────────────────
function updateSummary(transactions) {
  const income = transactions.filter(i => i.type === 'income').reduce((s, i) => s + Number(i.amount), 0);
  const expense = transactions.filter(i => i.type === 'expense').reduce((s, i) => s + Number(i.amount), 0);
  const balance = income - expense;
  totals.income.textContent = formatCurrency(income);
  totals.expense.textContent = formatCurrency(expense);
  totals.balance.textContent = formatCurrency(balance);
  totals.heroBalance.textContent = formatCurrency(balance);
  totals.count.textContent = String(transactions.length);

  const now = new Date();
  const monthTx = transactions.filter(i => {
    const d = new Date(i.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const mIncome = monthTx.filter(i => i.type === 'income').reduce((s, i) => s + Number(i.amount), 0);
  const mExpense = monthTx.filter(i => i.type === 'expense').reduce((s, i) => s + Number(i.amount), 0);
  const mDiff = mIncome - mExpense;

  totals.monthlyDifference.textContent = `Šį mėnesį pokytis ${formatCurrency(mDiff)}`;
  totals.currentMonthIncome.textContent = formatCurrency(mIncome);
  totals.currentMonthExpense.textContent = formatCurrency(mExpense);
  if (totals.sidebarGoal) totals.sidebarGoal.textContent = formatCurrency(mDiff);
  if (totals.goalText) totals.goalText.textContent = mDiff >= 0 ? 'Šį mėnesį pajamos viršija išlaidas.' : 'Šį mėnesį išlaidos viršija pajamas.';
}

function updateInsights(transactions) {
  const byCategory = {};
  transactions.filter(i => i.type === 'expense').forEach(i => {
    byCategory[i.category] = (byCategory[i.category] || 0) + Number(i.amount);
  });
  const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  totals.topCategory.textContent = top ? `${top[0]} • ${formatCurrency(top[1])}` : 'Nėra duomenų';
  const latest = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  totals.lastTransaction.textContent = latest ? `${latest.description} • ${formatCurrency(latest.amount)}` : 'Nėra įrašų';
}

// ── Diagramos ─────────────────────────────────────────────────
function drawTrendChart(transactions) {
  if (!trendCanvas) return;
  const ctx = trendCanvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const width = trendCanvas.clientWidth || 700;
  const height = 280;
  trendCanvas.width = width * ratio;
  trendCanvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawChartBackground(ctx, width, height);

  const grouped = {};
  transactions.filter(i => i.type === 'expense').forEach(i => { grouped[i.category] = (grouped[i.category] || 0) + Number(i.amount); });
  let entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  if (entries.length > 5) {
    const top = entries.slice(0, 4);
    const restSum = entries.slice(4).reduce((s, [, v]) => s + v, 0);
    top.push(['Kita', restSum]);
    entries = top;
  }
  drawDonutChart(ctx, width, height, entries, {
    emptyText: 'Kol kas nėra išlaidų duomenų pie chart atvaizdavimui.',
    centerLabel: 'Išlaidos',
    centerValue: formatCurrency(entries.reduce((s, [, v]) => s + v, 0)),
    colors: ['#5f7bff', '#24c78a', '#ffb44f', '#ff7d66', '#8d75ff', '#5ed0f4']
  });
}

function drawExpenseChart(transactions) {
  if (!expenseCanvas) return;
  const ctx = expenseCanvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const width = expenseCanvas.clientWidth || 460;
  const height = 280;
  expenseCanvas.width = width * ratio;
  expenseCanvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawChartBackground(ctx, width, height);

  const income = transactions.filter(i => i.type === 'income').reduce((s, i) => s + Number(i.amount), 0);
  const expense = transactions.filter(i => i.type === 'expense').reduce((s, i) => s + Number(i.amount), 0);
  drawDonutChart(ctx, width, height, [['Pajamos', income], ['Išlaidos', expense]], {
    emptyText: 'Kol kas nėra duomenų santykio diagramai.',
    centerLabel: 'Balansas',
    centerValue: formatCurrency(income - expense),
    colors: ['#22c07d', '#f26b6b'],
    compact: true
  });
}

function drawDonutChart(ctx, width, height, entries, options = {}) {
  const theme = getThemeColors();
  const validEntries = entries.filter(([, value]) => Number(value) > 0);
  if (!validEntries.length) {
    ctx.fillStyle = theme.muted;
    ctx.font = '14px Inter';
    ctx.fillText(options.emptyText || 'Nėra duomenų.', 22, 42);
    return;
  }
  const total = validEntries.reduce((s, [, v]) => s + Number(v), 0);
  const colors = options.colors || ['#6c8cff', '#22c07d', '#f4bf59', '#f26b6b', '#8e7dff'];
  const compact = Boolean(options.compact);
  const centerX = compact ? width * 0.34 : width * 0.30;
  const centerY = height * 0.54;
  const outerRadius = Math.min(width, height) * (compact ? 0.28 : 0.33);
  const innerRadius = outerRadius * 0.58;

  let startAngle = -Math.PI / 2;
  validEntries.forEach(([, value], index) => {
    const sliceAngle = (Number(value) / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, outerRadius, startAngle + 0.012, endAngle - 0.012);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
    startAngle = endAngle;
  });

  ctx.beginPath();
  ctx.fillStyle = theme.centerBg;
  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = theme.muted;
  ctx.font = compact ? '12px Inter' : '13px Inter';
  ctx.fillText(options.centerLabel || 'Iš viso', centerX, centerY - 6);
  ctx.fillStyle = theme.text;
  ctx.font = compact ? '700 15px Inter' : '700 18px Inter';
  ctx.fillText(options.centerValue || formatCurrency(total), centerX, centerY + 16);

  const legendX = compact ? width * 0.62 : width * 0.60;
  let legendY = compact ? 44 : 38;
  ctx.textAlign = 'left';
  validEntries.forEach(([label, value], index) => {
    const color = colors[index % colors.length];
    ctx.fillStyle = color;
    roundRect(ctx, legendX, legendY, 12, 12, 4, true, false);
    ctx.fillStyle = theme.text;
    ctx.font = '13px Inter';
    ctx.fillText(label, legendX + 20, legendY + 10);
    const percent = ((Number(value) / total) * 100).toFixed(0);
    ctx.fillStyle = theme.muted;
    ctx.font = '12px Inter';
    ctx.fillText(`${formatCurrency(value)} • ${percent}%`, legendX + 20, legendY + 28);
    legendY += 44;
  });
}

function drawChartBackground(ctx, width, height) {
  const theme = getThemeColors();
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, theme.cardTop);
  gradient.addColorStop(1, theme.cardBottom);
  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, width, height, 18, true, false);
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (width <= 0 || height <= 0) return;
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// ── Event listeners ───────────────────────────────────────────

// Registracija
registerForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validateRegisterForm()) { showToast('Patikrink registracijos laukus.', true); return; }
  const name = registerNameInput.value.trim();
  const email = registerEmailInput.value.trim();
  const password = registerPasswordInput.value;
  try {
    await registerUser(name, email, password);
    registerForm.reset();
    clearFormErrors(registerForm);
    showToast('Registracija sėkminga! Dabar prisijunk.');
  } catch (err) {
    const msg = err.message.includes('already') ? 'Toks el. paštas jau užregistruotas.' : err.message;
    setFieldError(registerEmailInput, msg);
    showToast('Registracija nepavyko.', true);
  }
});

// Prisijungimas
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validateLoginForm()) { showToast('Patikrink prisijungimo duomenis.', true); return; }
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;
  try {
    await loginUser(email, password);
    loginForm.reset();
    clearFormErrors(loginForm);
    showToast('Prisijungimas sėkmingas.');
  } catch (err) {
    setFieldError(loginPasswordInput, 'Neteisingas el. paštas arba slaptažodis.');
    showToast('Neteisingi prisijungimo duomenys.', true);
  }
});

// Transakcijų forma
transactionForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validateTransactionForm()) { showToast('Patikrink įrašo laukus.', true); return; }
  const type = transactionType.value;
  const amount = parseFloat(transactionAmountInput.value);
  const category = transactionCategory.value;
  const date = dateInput.value;
  const description = transactionDescriptionInput.value;

  try {
    if (editingTransactionId) {
      await updateTransactionInDb(editingTransactionId, { type, amount, category, date, description: description.trim() });
      showToast('Įrašas sėkmingai atnaujintas.');
    } else {
      await insertTransaction({ type, amount, category, date, description });
      showToast('Finansinis įrašas pridėtas.');
    }
    stopEditTransaction();
    await loadAndRenderApp();
  } catch (err) {
    showToast('Nepavyko išsaugoti įrašo.', true);
  }
});

// Transakcijų sąrašo mygtukai
transactionList.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === 'delete') {
      if (editingTransactionId === id) stopEditTransaction();
      await deleteTransactionInDb(id);
      showToast('Įrašas ištrintas.');
      await loadAndRenderApp();
    }
    if (action === 'toggle') {
      const tx = cachedTransactions.find(t => t.id === id);
      if (tx) await updateTransactionInDb(id, { registered: !tx.registered });
      showToast('Įrašo būsena atnaujinta.');
      await loadAndRenderApp();
    }
    if (action === 'edit') {
      event.preventDefault();
      event.stopPropagation();
      startEditTransaction(id);
    }
  } catch (err) {
    showToast('Klaida atliekant veiksmą.', true);
  }
});

// Filtrai
filterType.addEventListener('change', () => renderTransactions(cachedTransactions));
searchInput.addEventListener('input', () => renderTransactions(cachedTransactions));

// Atsijungimas
async function handleLogout() {
  await logoutUser();
  showToast('Sėkmingai atsijungei.');
}
if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', handleLogout);

// Ištrinti viską
clearAllBtn.addEventListener('click', async () => {
  if (!currentSession) return;
  if (!confirm('Ar tikrai nori ištrinti visus įrašus?')) return;
  try {
    await deleteAllTransactions();
    showToast('Visi įrašai ištrinti.');
    await loadAndRenderApp();
  } catch (err) {
    showToast('Nepavyko ištrinti įrašų.', true);
  }
});

// Kiti
if (transactionType) transactionType.addEventListener('change', () => updateCategoryOptions(transactionType.value));
navItems.forEach(item => item.addEventListener('click', () => scrollToSection(item.dataset.target)));
window.addEventListener('scroll', updateActiveSectionByScroll);

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    applyTheme(document.body.dataset.theme === 'light' ? 'dark' : 'light');
  });
}

if (dashboardAdAmount) dashboardAdAmount.addEventListener('input', updateDashboardAdCalculator);
if (dashboardAdTerm) dashboardAdTerm.addEventListener('input', updateDashboardAdCalculator);

if (emptyStateBtn) {
  emptyStateBtn.addEventListener('click', () => {
    if (transactionType) transactionType.value = 'expense';
    updateCategoryOptions(transactionType?.value || 'expense');
    focusTransactionForm({ descriptionFirst: false });
    showToast('Gali iš karto pradėti pildyti naują įrašą.');
  });
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', () => {
    stopEditTransaction();
    showToast('Redagavimas atšauktas.');
  });
}

[registerNameInput, registerEmailInput, registerPasswordInput, loginEmailInput, loginPasswordInput,
 transactionAmountInput, transactionCategory, dateInput, transactionDescriptionInput].forEach(input => {
  if (!input) return;
  input.addEventListener('input', () => clearFieldError(input));
  input.addEventListener('change', () => clearFieldError(input));
});

document.addEventListener('click', event => {
  const button = event.target.closest('.demo-ad-btn');
  if (!button) return;
  const adName = button.dataset.adName || 'partnerio pasiūlymas';
  showToast(`Atidaryta demonstracinė reklama: ${adName}.`);
});

// ── Startas ───────────────────────────────────────────────────
initTheme();
updateDashboardAdCalculator();
startAdRotation();

// Tikriname sesiją iš localStorage iš karto
const _existingSession = loadSession();
if (_existingSession && _existingSession.access_token) {
  currentSession = _existingSession;
  loadAndRenderApp();
} else {
  renderLoggedOut();
}
