// Portfolio Management App JavaScript

class PortfolioManager {
  constructor() {
    this.data = { bonds: [], stats: {} };
    this.charts = {};
    this.currentTab = 'dashboard';
    this.filters = {
      bonds: { search: '', issuer: '', depot: '', year: '', excludeMatured: true },
      interest: { issuer: '', depot: '', year: '', showPast: false }
    };

    // CACHE KEYS
    this.CACHE_KEY_BONDS = 'bonds_json_v1';
    this.CACHE_KEY_TS    = 'bonds_cached_at';

    this.init();
  }

  // ---------- Cache helpers ----------
  loadBondsFromCache() {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY_BONDS);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return false;
      this.data.bonds = parsed;
      return true;
    } catch (e) {
      console.warn('Failed to parse cached bonds:', e);
      return false;
    }
  }

  saveBondsToCache() {
    try {
      localStorage.setItem(this.CACHE_KEY_BONDS, JSON.stringify(this.data.bonds));
      localStorage.setItem(this.CACHE_KEY_TS, String(Date.now()));
    } catch (e) {
      console.warn('Failed to save bonds cache:', e);
    }
  }

  clearBondsCache() {
    try {
      localStorage.removeItem(this.CACHE_KEY_BONDS);
      localStorage.removeItem(this.CACHE_KEY_TS);
    } catch {}
  }

  // Active = not matured
  isBondActive(bond, asOf = new Date()) {
    return new Date(bond.maturityDate).getTime() > asOf.getTime();
  }
  getActiveBonds(asOf = new Date()) {
    return this.data.bonds.filter(b => this.isBondActive(b, asOf));
  }
  isActiveInYear(bond, year) {
    const t = Date.parse(bond.maturityDate);
    if (!Number.isFinite(t)) return false;
    const startOfYear = new Date(year, 0, 1).getTime();
    return t >= startOfYear;
  }

  init() {
    this.setupEventListeners();

    if (this.loadBondsFromCache()) {
      this.calculateStats();
      this.updateUI();
      this.hideEmptyState();
      this.switchTab('dashboard');
    } else {
      this.showEmptyState();
    }
  }

  setupEventListeners() {
    // Upload modal
    const uploadBtn = document.getElementById('uploadBtn');
    const emptyUploadBtn = document.getElementById('emptyUploadBtn');
    const closeModal = document.getElementById('closeModal');
    const loadSampleBtn = document.getElementById('loadSampleData');

    if (uploadBtn) uploadBtn.addEventListener('click', e => { e.preventDefault(); this.openUploadModal(); });
    if (emptyUploadBtn) emptyUploadBtn.addEventListener('click', e => { e.preventDefault(); this.openUploadModal(); });
    if (closeModal) closeModal.addEventListener('click', e => { e.preventDefault(); this.closeUploadModal(); });
    if (loadSampleBtn) loadSampleBtn.addEventListener('click', e => { e.preventDefault(); this.loadSampleData(); });

    // File upload (bonds only)
    const bondsFile = document.getElementById('bondsFile');
    if (bondsFile) bondsFile.addEventListener('change', e => this.handleFileUpload(e, 'bonds'));

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const tab = e.currentTarget.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });

    // Filters
    const bondSearch = document.getElementById('bondSearch');
    const issuerFilter = document.getElementById('issuerFilter');
    const depotFilter = document.getElementById('depotFilter');
    const excludeToggle = document.getElementById('excludeMaturedToggle');
    const yearFilter = document.getElementById('maturityYearFilter');
    const interestIssuerFilter = document.getElementById('interestIssuerFilter');
    const interestDepotFilter = document.getElementById('interestDepotFilter');
    const interestYearFilter = document.getElementById('interestYearFilter');
    const interestShowPast = document.getElementById('interestShowPast');

    if (bondSearch)  bondSearch.addEventListener('input', e => this.updateFilter('bonds', 'search', e.target.value));
    if (issuerFilter) issuerFilter.addEventListener('change', e => this.updateFilter('bonds', 'issuer', e.target.value));
    if (depotFilter)  depotFilter.addEventListener('change', e => this.updateFilter('bonds', 'depot', e.target.value));
    if (yearFilter) yearFilter.addEventListener('change', e => this.updateFilter('bonds', 'year', e.target.value));
    if (interestIssuerFilter) interestIssuerFilter.addEventListener('change', e => this.updateFilter('interest', 'issuer', e.target.value));
    if (interestDepotFilter) interestDepotFilter.addEventListener('change', e => this.updateFilter('interest', 'depot', e.target.value));
    if (interestYearFilter) interestYearFilter.addEventListener('change', e => this.updateFilter('interest', 'year', e.target.value));
    if (interestShowPast) interestShowPast.addEventListener('change', e => this.updateFilter('interest', 'showPast', e.target.checked));

    if (excludeToggle) {
      this.filters.bonds.excludeMatured = !!excludeToggle.checked;
      excludeToggle.addEventListener('change', e => this.updateFilter('bonds', 'excludeMatured', e.target.checked));
    }

    // Bond detail modal
    const closeBondDetail = document.getElementById('closeBondDetail');
    if (closeBondDetail) closeBondDetail.addEventListener('click', e => { e.preventDefault(); this.closeBondDetailModal(); });

    // Close modals on outside click
    const uploadModal = document.getElementById('uploadModal');
    const bondDetailModal = document.getElementById('bondDetailModal');
    if (uploadModal) uploadModal.addEventListener('click', e => { if (e.target === e.currentTarget) this.closeUploadModal(); });
    if (bondDetailModal) bondDetailModal.addEventListener('click', e => { if (e.target === e.currentTarget) this.closeBondDetailModal(); });
  }

  showEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const mainContent = document.querySelector('.main-content');
    if (emptyState) emptyState.classList.add('active');
    if (mainContent) mainContent.style.display = 'none';
  }
  hideEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const mainContent = document.querySelector('.main-content');
    if (emptyState) emptyState.classList.remove('active');
    if (mainContent) mainContent.style.display = 'block';
  }

  openUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) modal.classList.remove('hidden');
  }
  closeUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) modal.classList.add('hidden');
  }
  showLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) loading.classList.remove('hidden');
  }
  hideLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) loading.classList.add('hidden');
  }

  async loadSampleData() {
    this.showLoading();
    const sampleData = {
      bonds: [
        {
          "yieldToMaturity": 3.24,
          "issuer": "BP Capital Markets PLC",
          "name": "1,077% BP Capital Markets PLC 2025",
          "isin": "XS1637863629",
          "id": "6566B604-2159-4BF9-A6C4-211D9D4DB6D0",
          "wkn": "A19KJG",
          "initialPrice": 97414,
          "couponRate": 1.08,
          "parValue": 100000,
          "maturityDate": "2025-06-25T22:00:00Z",
          "depotBank": "ING"
        },
        {
          "yieldToMaturity": 2.85,
          "issuer": "Deutsche Bank AG",
          "name": "2.5% Deutsche Bank AG 2026",
          "isin": "DE000DB7XYZ9",
          "id": "48FC0004-2CB4-4B5C-B943-20C52C1643B5",
          "wkn": "DB7XYZ",
          "initialPrice": 99500,
          "couponRate": 2.50,
          "parValue": 100000,
          "maturityDate": "2026-03-15T22:00:00Z",
          "depotBank": "Deutsche Bank"
        }
      ]
    };

    setTimeout(() => {
      try {
        this.data.bonds = sampleData.bonds;
        this.saveBondsToCache();
        this.calculateStats();
        this.updateUI();
        this.hideLoading();
        this.closeUploadModal();
        this.hideEmptyState();
        this.switchTab('dashboard');
      } catch (error) {
        console.error('Error loading sample data:', error);
        this.hideLoading();
        alert('Error loading sample data');
      }
    }, 300);
  }

  async handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    this.showLoading();
    try {
      const text = await this.readFile(file);
      const data = JSON.parse(text);
      this.data[type] = Array.isArray(data) ? data : [data];

      if (this.data.bonds.length > 0) {
        this.saveBondsToCache();
        this.calculateStats();
        this.updateUI();
        this.hideEmptyState();
        this.closeUploadModal();
        this.switchTab('dashboard');
        this.updateCharts();
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading file: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // -------- Stats (bonds only) --------
  calculateStats() {
    const activeBonds = this.getActiveBonds(new Date());
    const totalPrincipal = activeBonds.reduce((sum, b) => sum + (b.parValue || 0), 0);
    const averageYield = activeBonds.length
      ? activeBonds.reduce((s, b) => s + (b.yieldToMaturity || 0), 0) / activeBonds.length
      : 0;

    this.data.stats = {
      activeBonds: activeBonds.length,
      totalPrincipal,
      averageYield
    };
  }

  updateUI() {
    this.updateStats();
    this.updateCharts();
    this.updateFilters();
    this.updateInterestFilters();
    this.renderBonds();
    this.renderInterestTimeline();
  }

  updateStats() {
    const { totalPrincipal, activeBonds, averageYield } = this.data.stats;
    const totalPrincipalEl = document.getElementById('totalPrincipal');
    const activeBondsEl = document.getElementById('activeBonds');
    const avgYieldEl = document.getElementById('avgYield');

    if (totalPrincipalEl) totalPrincipalEl.textContent = this.formatCurrency(totalPrincipal || 0);
    if (activeBondsEl)  activeBondsEl.textContent = activeBonds ?? 0;
    if (avgYieldEl)     avgYieldEl.textContent = (averageYield ?? 0).toFixed(2) + '%';
  }

 updateCharts() {
  // If you no longer use the doughnut chart, ensure itâ€™s destroyed
  if (this.charts.composition) { this.charts.composition.destroy(); this.charts.composition = null; }
  if (this.charts.interest)    { this.charts.interest.destroy();    this.charts.interest    = null; }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      this.createMaturityTable();   // table in EUR with % of total + per-year yield
      this.createInterestChart();   // bar chart + â‚¬150k reference line
      this.createIssuerTable(); // Table of issuers
    });
  });
}


  // Composition: active bonds by par per issuer
  createCompositionChart() {
    const canvas = document.getElementById('compositionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (this.charts.composition) this.charts.composition.destroy();

    const issuerData = {};
    this.getActiveBonds().forEach(b => {
      issuerData[b.issuer] = (issuerData[b.issuer] || 0) + (b.parValue || 0);
    });

    this.charts.composition = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(issuerData),
        datasets: [{
          data: Object.values(issuerData),
          backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  // Table: for each year -> Principal (EUR), % of total, Yield of that year
        createMaturityTable() {
      const container = document.getElementById('maturityTableContainer');
      if (!container) return;
    
      const active = this.getActiveBonds();
      if (!active.length) {
        container.innerHTML = `<div class="empty-table">No upcoming maturities.</div>`;
        return;
      }
    
      // Group principal that MATURES in year Y
      const byYearPrincipal = {};
      active.forEach(b => {
        const y = new Date(b.maturityDate).getFullYear();
        const par = Number(b.parValue) || 0;
        byYearPrincipal[y] = (byYearPrincipal[y] || 0) + par;
      });
    
      const years = Object.keys(byYearPrincipal).map(Number).sort((a,b)=>a-b);
      if (!years.length) {
        container.innerHTML = `<div class="empty-table">No upcoming maturities.</div>`;
        return;
      }
    
      // Formatters
      const fmtEUR = (v) => new Intl.NumberFormat('de-DE', {
        style: 'currency', currency: 'EUR', maximumFractionDigits: 0
      }).format(v);
      const fmtPct0 = (v) => new Intl.NumberFormat('de-DE', {
        maximumFractionDigits: 0
      }).format(v * 100) + '%';
      const fmtPct1 = (v) => new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 1, maximumFractionDigits: 1
      }).format(v * 100) + '%';
    
      // Principal outstanding DURING year Y = all bonds with maturity >= Y
      const principalOutstandingInYear = (Y) =>
        active.reduce((sum, b) => {
          const matY = new Date(b.maturityDate).getFullYear();
          const par  = Number(b.parValue) || 0;
          return matY >= Y ? sum + par : sum;
        }, 0);
    
      // Interest expected in year Y = Î£(par * coupon%) for bonds active in Y
      const interestInYear = (Y) =>
        active.reduce((sum, b) => {
          const matY = new Date(b.maturityDate).getFullYear();
          const par  = Number(b.parValue) || 0;
          const r    = Number(b.couponRate) || 0; // % p.a.
          return matY >= Y ? sum + par * (r / 100) : sum;
        }, 0);
    
      const totalPrincipalActive = active.reduce((s, b) => s + (Number(b.parValue) || 0), 0);
    
      const rowsHtml = years.map(y => {
        const principalMaturing = byYearPrincipal[y] || 0;       // Principal (EUR)
        const shareOfTotal      = totalPrincipalActive > 0 ? (principalMaturing / totalPrincipalActive) : 0; // %
        const principalOutY     = principalOutstandingInYear(y);  // denominator for yield
        const interestY         = interestInYear(y);              // numerator for yield
        const yieldY            = principalOutY > 0 ? (interestY / principalOutY) : 0;
    
        return `
          <tr>
            <td>${y}</td>
            <td class="num">${fmtEUR(principalMaturing)}</td>
            <td class="num">${fmtPct0(shareOfTotal)}</td>
            <td class="num">${fmtPct1(yieldY)}</td>
          </tr>
        `;
      }).join('');
    
      container.innerHTML = `
        <table class="table table--no-cards">
          <thead>
            <tr>
              <th>Year</th>
              <th>Principal (EUR)</th>
              <th>Percentage</th>
              <th>Yield</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;
    }


  createIssuerTable() {
  const container = document.getElementById('issuerBreakdownContainer');
  if (!container) return;

  const active = this.getActiveBonds();
  if (!active.length) {
    container.innerHTML = `<div class="empty-table">No active bonds.</div>`;
    return;
  }

  // Sum principal by issuer
  const byIssuer = active.reduce((acc, b) => {
    const issuer = b.issuer || 'â€”';
    const par = Number(b.parValue) || 0;
    acc[issuer] = (acc[issuer] || 0) + par;
    return acc;
  }, {});

  const totalPrincipal = Object.values(byIssuer).reduce((s, v) => s + v, 0);

  // Sort issuers by principal desc
  const rows = Object.entries(byIssuer)
    .sort((a, b) => b[1] - a[1]);

  // Formatters
  const fmtEUR = (v) => new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
  }).format(v);
  const fmtPct0 = (v) => new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 0
  }).format(v * 100) + '%';

  const rowsHtml = rows.map(([issuer, principal]) => {
    const pct = totalPrincipal > 0 ? principal / totalPrincipal : 0;
    return `
      <tr>
        <td data-label="Issuer">${issuer}</td>
        <td class="num" data-label="Principal (EUR)">${fmtEUR(principal)}</td>
        <td class="num" data-label="% of Total">${fmtPct0(pct)}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="table table--no-cards">
      <thead>
        <tr>
          <th>Issuer</th>
          <th>Principal (EUR)</th>
          <th>% of Total</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td>Total</td>
          <td class="num">${fmtEUR(totalPrincipal)}</td>
          <td class="num">${fmtPct0(1)}</td>
        </tr>
      </tbody>
    </table>
  `;
}


  updateFilters() {
    const sourceBonds = this.filters.bonds.excludeMatured ? this.getActiveBonds() : this.data.bonds;

    // Issuers
    const issuers = [...new Set(sourceBonds.map(b => b.issuer))].sort((a, b) => a.localeCompare(b));
    const issuerSelect = document.getElementById('issuerFilter');
    if (issuerSelect) {
      issuerSelect.innerHTML = '<option value="">All Issuers</option>';
      issuers.forEach(issuer => issuerSelect.innerHTML += `<option value="${issuer}">${issuer}</option>`);
      if (this.filters.bonds.issuer && !issuers.includes(this.filters.bonds.issuer)) this.filters.bonds.issuer = '';
    }

    // Depots
    const depots = [...new Set(sourceBonds.map(b => b.depotBank))];
    const depotSelect = document.getElementById('depotFilter');
    if (depotSelect) {
      depotSelect.innerHTML = '<option value="">All Depots</option>';
      depots.forEach(depot => depotSelect.innerHTML += `<option value="${depot}">${depot}</option>`);
      if (this.filters.bonds.depot && !depots.includes(this.filters.bonds.depot)) this.filters.bonds.depot = '';
    }


  // Years
    const years = [...new Set(
    sourceBonds
      .map(b => {
        const t = Date.parse(b.maturityDate);
        return Number.isFinite(t) ? new Date(t).getFullYear() : null;
      })
      .filter(y => y != null)
  )].sort((a, b) => a - b);

  const yearSelect = document.getElementById('maturityYearFilter');
  if (yearSelect) {
    yearSelect.innerHTML = '<option value="">All Maturity Years</option>';
    years.forEach(y => yearSelect.innerHTML += `<option value="${y}">${y}</option>`);
    if (this.filters.bonds.year && !years.includes(Number(this.filters.bonds.year))) this.filters.bonds.year = '';
    // keep the UI in sync after we may have reset it
    yearSelect.value = this.filters.bonds.year || '';
  }
    const excludeToggle = document.getElementById('excludeMaturedToggle');
    if (excludeToggle) excludeToggle.checked = !!this.filters.bonds.excludeMatured;
  }

  updateInterestFilters() {
    const selects = {
      issuer: document.getElementById('interestIssuerFilter'),
      depot: document.getElementById('interestDepotFilter'),
      year: document.getElementById('interestYearFilter')
    };
    const now = new Date();
    const currentYear = now.getFullYear();

    const validBonds = this.data.bonds.filter(b => Number.isFinite(Date.parse(b.maturityDate)));
    if (!validBonds.length) {
      if (selects.issuer) selects.issuer.innerHTML = '<option value="">All Issuers</option>';
      if (selects.depot) selects.depot.innerHTML = '<option value="">All Depots</option>';
      if (selects.year) selects.year.innerHTML = '<option value="">All Years</option>';
      return;
    }

    const maxYear = Math.max(...validBonds.map(b => new Date(b.maturityDate).getFullYear()), currentYear);
    const yearsSet = new Set();
    for (let y = currentYear; y <= maxYear; y++) yearsSet.add(y);

    // Issuers
    if (selects.issuer) {
      const issuers = [...new Set(validBonds.map(b => b.issuer).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      selects.issuer.innerHTML = '<option value="">All Issuers</option>' + issuers.map(i => `<option value="${i}">${i}</option>`).join('');
      if (this.filters.interest.issuer && !issuers.includes(this.filters.interest.issuer)) this.filters.interest.issuer = '';
      selects.issuer.value = this.filters.interest.issuer || '';
    }

    // Depots
    if (selects.depot) {
      const depots = [...new Set(validBonds.map(b => b.depotBank).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      selects.depot.innerHTML = '<option value="">All Depots</option>' + depots.map(d => `<option value="${d}">${d}</option>`).join('');
      if (this.filters.interest.depot && !depots.includes(this.filters.interest.depot)) this.filters.interest.depot = '';
      selects.depot.value = this.filters.interest.depot || '';
    }

    // Years
    if (selects.year) {
      const years = [...yearsSet].sort((a, b) => a - b);
      selects.year.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
      if (this.filters.interest.year && !years.includes(Number(this.filters.interest.year))) this.filters.interest.year = '';
      selects.year.value = this.filters.interest.year || '';
    }

    // Show past
    const pastToggle = document.getElementById('interestShowPast');
    if (pastToggle) pastToggle.checked = !!this.filters.interest.showPast;
  }

  switchTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeNavItem = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeNavItem) activeNavItem.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const activeTab = document.getElementById(`${tabName}Tab`);
    if (activeTab) activeTab.classList.add('active');

    this.currentTab = tabName;
    if (tabName === 'dashboard' && this.data.bonds.length > 0) this.updateCharts();
    if (tabName === 'interest' && this.data.bonds.length > 0) {
      this.updateInterestFilters();
      this.renderInterestTimeline();
    }
  }

  updateFilter(type, filterName, value) {
    this.filters[type][filterName] = value;
    if (type === 'bonds') {
      if (filterName === 'excludeMatured') this.updateFilters();
      this.renderBonds();
    } else if (type === 'interest') {
      this.renderInterestTimeline();
    }
  }

  renderBonds() {
    const container = document.getElementById('bondsList');
    if (!container) return;

    let bonds = this.filters.bonds.excludeMatured ? this.getActiveBonds() : [...this.data.bonds];

    const f = this.filters.bonds;
    if (f.search) {
      const q = f.search.toLowerCase();
      bonds = bonds.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.issuer || '').toLowerCase().includes(q) ||
        (b.isin || '').toLowerCase().includes(q)
      );
    }
    if (f.issuer) bonds = bonds.filter(b => b.issuer === f.issuer);
    if (f.depot)  bonds = bonds.filter(b => b.depotBank === f.depot);

    if (f.year) bonds = bonds.filter(b => {
      const t = Date.parse(b.maturityDate);
      return Number.isFinite(t) && new Date(t).getFullYear() === Number(f.year);
    });

    // Sort by maturity soonest-first (keeps active above matured)
    const now = new Date();
    bonds.sort((a, b) => {
      const aActive = this.isBondActive(a, now);
      const bActive = this.isBondActive(b, now);
      if (aActive !== bActive) return aActive ? -1 : 1;
      const aTime = new Date(a.maturityDate).getTime();
      const bTime = new Date(b.maturityDate).getTime();
      const aVal = Number.isFinite(aTime) ? aTime : Infinity;
      const bVal = Number.isFinite(bTime) ? bTime : Infinity;
      return aVal - bVal;
    });

    container.innerHTML = bonds.map(b => this.createBondCard(b)).join('');
    container.querySelectorAll('.bond-card').forEach((card, i) => {
      card.addEventListener('click', () => this.showBondDetails(bonds[i]));
    });
  }

  createBondCard(bond) {
    const isActive = this.isBondActive(bond);
    const maturityDate = new Date(bond.maturityDate).toLocaleDateString();
    return `
      <div class="bond-card">
        <div class="bond-header">
          <div class="bond-name">${bond.name}</div>
        </div>
        <div class="bond-details">
          <div class="detail-item">
            <div class="detail-label">Issuer</div>
            <div class="detail-value">${bond.issuer}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Coupon</div>
            <div class="detail-value">${(bond.couponRate ?? 0).toFixed(3)}%</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Par Value</div>
            <div class="detail-value">${this.formatCurrency(bond.parValue || 0)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Maturity</div>
            <div class="detail-value">${maturityDate}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Depot</div>
            <div class="detail-value">${bond.depotBank}</div>
          </div>
        </div>
        <div class="status-badge ${isActive ? 'status-badge--active' : 'status-badge--matured'}">
          ${isActive ? 'Active' : 'Matured'}
        </div>
      </div>
    `;
  }
createInterestChart() {
  const canvas = document.getElementById('interestChart');
  if (!canvas) return;

  const active = this.getActiveBonds();
  if (active.length === 0) return;

  // Build yearly interest map and sorted labels
  const yearsSet = new Set();
  active.forEach(b => yearsSet.add(new Date(b.maturityDate).getFullYear()));
  const years = Array.from(yearsSet).sort((a,b)=>a-b);

  const interestByYear = years.map(Y =>
    active.reduce((sum, b) => {
      const matY = new Date(b.maturityDate).getFullYear();
      const par  = Number(b.parValue) || 0;
      const r    = Number(b.couponRate) || 0;
      return matY >= Y ? sum + par * (r / 100) : sum;
    }, 0)
  );

  // Custom plugin to draw the â‚¬150,000 reference line
  const REF = 150000;
  const refLinePlugin = {
    id: 'refLine',
    afterDraw(chart) {
      const { ctx, chartArea: { left, right }, scales: { y } } = chart;
      if (!y) return;
      const yPos = y.getPixelForValue(REF);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(left, yPos);
      ctx.lineTo(right, yPos);
      ctx.setLineDash([6,6]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.textAlign = 'right';
      ctx.fillText('EUR 150.000', right - 4, yPos - 6);
      ctx.restore();
    }
  };

  // Destroy previous
  if (this.charts.interest) { this.charts.interest.destroy(); this.charts.interest = null; }

  this.charts.interest = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: 'Interest (EUR)',
        data: interestByYear
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: {
          ticks: {
            callback: (v) => new Intl.NumberFormat('de-DE', {
              style: 'currency', currency: 'EUR', maximumFractionDigits: 0
            }).format(v)
          },
          beginAtZero: true
        }
      }
    },
    plugins: [refLinePlugin]
  });
}

  renderInterestTimeline() {
    const container = document.getElementById('interestTimeline');
    if (!container) return;

    if (!this.data.bonds.length) {
      container.innerHTML = `<div class="timeline-empty">Load bonds to see upcoming interest.</div>`;
      return;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const currentYear = now.getFullYear();

    const validBonds = this.data.bonds.filter(b => Number.isFinite(Date.parse(b.maturityDate)));
    if (!validBonds.length) {
      container.innerHTML = `<div class="timeline-empty">Load bonds to see upcoming interest.</div>`;
      return;
    }

    const maxYear = Math.max(...validBonds.map(b => new Date(b.maturityDate).getFullYear()), currentYear);
    const allYears = [];
    for (let y = currentYear; y <= maxYear; y++) allYears.push(y);
    const years = this.filters.interest.year ? [Number(this.filters.interest.year)] : allYears;

    const fmtEUR = (v) => new Intl.NumberFormat('de-DE', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    }).format(v);
    const fmtDate = (d) => d.toLocaleDateString();

      const blocks = years.map(year => {
        const payments = this.data.bonds
          .map(b => {
            const t = Date.parse(b.maturityDate);
            if (!Number.isFinite(t)) return null;
            const maturityDate = new Date(t);
            const maturityYear = maturityDate.getFullYear();
            if (year > maturityYear) return null;

          const payDate = new Date(year, maturityDate.getMonth(), maturityDate.getDate());
          const payTs = payDate.getTime();
          const par = Number(b.parValue) || 0;
          const rate = Number(b.couponRate) || 0;
          const interest = par * (rate / 100);

          return { bond: b, payDate, payTs, interest, rate };
        })
        .filter(Boolean)
        .filter(p => {
          const f = this.filters.interest;
          const issuerOk = !f.issuer || p.bond.issuer === f.issuer;
          const depotOk = !f.depot || p.bond.depotBank === f.depot;
          const yearOk = !f.year || Number(f.year) === year;
          const showPast = !!f.showPast;
          const isPast = p.payTs < startOfToday;
          const pastOk = showPast || !isPast;
          return issuerOk && depotOk && yearOk && pastOk;
        })
        .sort((a, b) => a.payTs - b.payTs);

        const total = payments.reduce((sum, p) => sum + p.interest, 0);

        const items = payments.map(({ bond, payDate, payTs, interest, rate }) => {
          const isPast = payTs < startOfToday;
          return `
          <div class="timeline-item ${isPast ? 'timeline-item--past' : ''}">
            <div class="timeline-item-header">
              <div class="timeline-item-title">${bond.name || bond.isin || 'Bond'}</div>
              <div class="timeline-header-right">
                ${isPast ? '<span class="timeline-badge timeline-badge--past">Past</span>' : ''}
                <div class="timeline-amount">${fmtEUR(interest)}</div>
              </div>
            </div>
            <div class="timeline-meta">
              <span>Coupon ${rate.toFixed(2)}%</span>
              <span>Nominal ${this.formatCurrency(bond.parValue || 0)}</span>
              <span>Bank ${bond.depotBank || 'N/A'}</span>
              <span>Payment ${fmtDate(payDate)}</span>
            </div>
          </div>
        `;
        }).join('');

        return `
          <div class="timeline-year">
            <div class="timeline-marker"></div>
            <div class="timeline-year-header">
              <div class="timeline-year-label">
                <span class="timeline-toggle" aria-hidden="true">+</span>
                <span>${year}</span>
              </div>
              <div class="timeline-year-total">${fmtEUR(total)}</div>
            </div>
            ${payments.length ? `<div class="timeline-items collapsed">${items}</div>` : `<div class="timeline-empty">No expected interest in ${year}.</div>`}
          </div>
        `;
      }).join('');

    container.innerHTML = `<div class="timeline">${blocks}</div>`;

    // Toggle details on click
    container.querySelectorAll('.timeline-year').forEach(section => {
      const header = section.querySelector('.timeline-year-header');
      const items = section.querySelector('.timeline-items');
      const toggle = section.querySelector('.timeline-toggle');
      if (!header || !items) return;
      const setState = (collapsed) => {
        items.style.display = collapsed ? 'none' : 'block';
        if (toggle) toggle.textContent = collapsed ? '+' : '-';
      };
      setState(true);
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        const collapsed = items.classList.toggle('collapsed');
        setState(collapsed);
      });
    });
  }

  showBondDetails(bond) {
    const modal = document.getElementById('bondDetailModal');
    const title = document.getElementById('bondDetailTitle');
    const content = document.getElementById('bondDetailContent');
    if (!modal || !title || !content) return;

    title.textContent = bond.name;
    content.innerHTML = `
      <div class="bond-detail-grid">
        <div class="detail-section">
          <h4>Basic Information</h4>
          <div class="detail-item"><div class="detail-label">ISIN</div><div class="detail-value">${bond.isin}</div></div>
          <div class="detail-item"><div class="detail-label">WKN</div><div class="detail-value">${bond.wkn}</div></div>
          <div class="detail-item"><div class="detail-label">Issuer</div><div class="detail-value">${bond.issuer}</div></div>
        </div>
        <div class="detail-section">
          <h4>Financial Details</h4>
          <div class="detail-item"><div class="detail-label">Par Value</div><div class="detail-value">${this.formatCurrency(bond.parValue || 0)}</div></div>
          <div class="detail-item"><div class="detail-label">Coupon Rate</div><div class="detail-value">${(bond.couponRate ?? 0).toFixed(2)}%</div></div>
          <div class="detail-item"><div class="detail-label">Yield to Maturity</div><div class="detail-value">${(bond.yieldToMaturity ?? 0).toFixed(2)}%</div></div>
        </div>
        <div class="detail-section">
          <h4>Purchase Details</h4>
          <div class="detail-item"><div class="detail-label">Initial Price</div><div class="detail-value">${this.formatCurrency(bond.initialPrice || 0)}</div></div>
          <div class="detail-item"><div class="detail-label">Depot Bank</div><div class="detail-value">${bond.depotBank}</div></div>
        </div>
        <div class="detail-section">
          <h4>Maturity</h4>
          <div class="detail-item"><div class="detail-label">Maturity Date</div><div class="detail-value">${new Date(bond.maturityDate).toLocaleDateString()}</div></div>
          <div class="detail-item"><div class="detail-label">Days to Maturity</div><div class="detail-value">${Math.ceil((new Date(bond.maturityDate) - new Date()) / (1000 * 60 * 60 * 24))}</div></div>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
  }

  closeBondDetailModal() {
    const modal = document.getElementById('bondDetailModal');
    if (modal) modal.classList.add('hidden');
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => { new PortfolioManager(); });
