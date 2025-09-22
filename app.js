// Portfolio Management App JavaScript

class PortfolioManager {
    constructor() {
        this.data = {
            bonds: [],
            stats: {}
        };
        this.charts = {};
        this.currentTab = 'dashboard';
        this.filters = {
            bonds: { search: '', issuer: '', depot: '', excludeMatured: true }
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

    init() {
        this.setupEventListeners();

        // Try to boot from cache first (no user action needed)
        if (this.loadBondsFromCache()) {
            this.calculateStats();
            this.updateUI();
            this.hideEmptyState();
            this.switchTab('dashboard');
        } else {
            // No cache -> show empty state
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

        if (bondSearch)  bondSearch.addEventListener('input', e => this.updateFilter('bonds', 'search', e.target.value));
        if (issuerFilter) issuerFilter.addEventListener('change', e => this.updateFilter('bonds', 'issuer', e.target.value));
        if (depotFilter)  depotFilter.addEventListener('change', e => this.updateFilter('bonds', 'depot', e.target.value));

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

                // Save to cache so it auto-loads next time
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
        }, 400);
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
            // Save to cache so it auto-loads on next visit
            this.saveBondsToCache();
        
            this.calculateStats();
            this.updateUI();
            this.hideEmptyState();
            this.closeUploadModal();
        
            // Show dashboard and rebuild charts when visible
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
        this.renderBonds();
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
    // Destroy the composition chart if present (table doesn’t need destruction)
    if (this.charts.composition) { this.charts.composition.destroy(); this.charts.composition = null; }

    // Wait for layout to settle (ensures container is visible)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            this.createCompositionChart();
            this.createMaturityTable(); // <- build the table instead of a chart
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

    // Principal maturing per year
    // Table of maturities with interest & yield per year (values in kEUR)
createMaturityTable() {
    const container = document.getElementById('maturityTableContainer');
    if (!container) return;

    const active = this.getActiveBonds();
    const byMaturityYear = {};
    active.forEach(b => {
        const year = new Date(b.maturityDate).getFullYear();
        const par  = Number(b.parValue) || 0;
        byMaturityYear[year] = (byMaturityYear[year] || 0) + par;
    });

    const years = Object.keys(byMaturityYear).map(Number).sort((a,b) => a - b);

    if (years.length === 0) {
        container.innerHTML = `<div class="empty-table">No upcoming maturities.</div>`;
        return;
    }

    // Formatters (divide by 1000 to show kEUR)
    const fmtKEUR = (v) => {
  const k = v / 1000;
  const useDecimals = Math.abs(k) < 100;
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: useDecimals ? 1 : 0,
    maximumFractionDigits: useDecimals ? 1 : 0
  }).format(k);
};  

    const fmtPct = (v) => (v * 100).toFixed(0) + '%';

    const principalOutstandingInYear = (Y) =>
        active.reduce((sum, b) => {
            const matY = new Date(b.maturityDate).getFullYear();
            const par  = Number(b.parValue) || 0;
            return matY >= Y ? sum + par : sum;
        }, 0);

    const interestInYear = (Y) =>
        active.reduce((sum, b) => {
            const matY = new Date(b.maturityDate).getFullYear();
            const par  = Number(b.parValue) || 0;
            const r    = Number(b.couponRate) || 0;
            return matY >= Y ? sum + par * (r / 100) : sum;
        }, 0);

    const totalPrincipalActive = active.reduce((s, b) => s + (Number(b.parValue) || 0), 0);

    let rowsHtml = years.map(y => {
        const maturingThisYear = byMaturityYear[y] || 0;
        const principalOutY    = principalOutstandingInYear(y);
        const interestY        = interestInYear(y);
        const shareOfTotal     = totalPrincipalActive > 0 ? (maturingThisYear / totalPrincipalActive) : 0;
        const yieldOnOutY      = principalOutY > 0 ? (interestY / principalOutY) : 0;

        return `
            <tr>
                <td>${y}</td>
                <td class="num">${fmtKEUR(maturingThisYear)}</td>
                <td class="num">${fmtPct(shareOfTotal)}</td>
                <td class="num">${fmtKEUR(interestY)}</td>
                <td class="num">${fmtPct(yieldOnOutY)}</td>
            </tr>
        `;
    }).join('');

    rowsHtml += `
        <tr class="total-row">
            <td>Total</td>
            <td class="num">${fmtKEUR(totalPrincipalActive)}</td>
            <td class="num">${fmtPct(1)}</td>
            <td class="num">—</td>
            <td class="num">—</td>
        </tr>
    `;

    container.innerHTML = `
        <table class="table table--compact">
            <thead>
                <tr>
                    <th>Year</th>
                    <th>Principal (kEUR)</th>
                    <th>Percentage</th>
                    <th>Interest (kEUR)</th>
                    <th>Yield</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
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

        const excludeToggle = document.getElementById('excludeMaturedToggle');
        if (excludeToggle) excludeToggle.checked = !!this.filters.bonds.excludeMatured;
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
    }

    updateFilter(type, filterName, value) {
        this.filters[type][filterName] = value;
        if (type === 'bonds') {
            if (filterName === 'excludeMatured') this.updateFilters();
            this.renderBonds();
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

        // Optional: sort by maturity soonest-first (keeps active above matured)
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
