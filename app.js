// Portfolio Management App JavaScript

class PortfolioManager {
    constructor() {
        this.data = {
            bonds: [],
            etfs: [],            // no longer used for value; kept so UI doesn't break if present
            transactions: [],
            stats: {}
        };
        this.charts = {};
        this.currentTab = 'dashboard';
        this.filters = {
            bonds: { search: '', issuer: '', depot: '', excludeMatured: true },
            etfs: { search: '' },
            transactions: { search: '', type: '', date: '' }
        };
        
        this.init();
    }

    // ===== Helpers =====
    isBondActive(bond, asOf = new Date()) {
        const maturity = new Date(bond.maturityDate);
        return maturity.getTime() > asOf.getTime();
    }
    getActiveBonds(asOf = new Date()) {
        return this.data.bonds.filter(b => this.isBondActive(b, asOf));
    }

    // From earlier YTM helpers (used only for MV calcs previously) – not needed now for stats.
    yearsBetween(d1, d2) {
        const MS_PER_DAY = 1000 * 60 * 60 * 24;
        return (d2 - d1) / MS_PER_DAY / 365.25;
    }
    generateCashFlows(bond, asOf = new Date()) {
        const par = bond.parValue || 0;
        const freq = bond.couponFrequency || 1;
        const cpnPerPeriod = (bond.couponRate / 100) * par / freq;

        const mat = new Date(bond.maturityDate);
        if (mat <= asOf) return [];
        const years = this.yearsBetween(asOf, mat);
        const periods = Math.max(1, Math.ceil(years * freq));

        const cfs = [];
        for (let k = 1; k <= periods; k++) {
            const tYears = k / freq;
            const amt = (k === periods) ? (cpnPerPeriod + par) : cpnPerPeriod;
            cfs.push({ t: tYears, amount: amt });
        }
        return cfs;
    }
    imputedCleanPriceFromYTM(bond, asOf = new Date()) {
        const y = (bond.yieldToMaturity || 0) / 100;
        const cfs = this.generateCashFlows(bond, asOf);
        if (cfs.length === 0) return 0;
        let pv = 0;
        for (const { t, amount } of cfs) pv += amount / Math.pow(1 + y, t);
        return pv;
    }
    bondMarketValue(bond, asOf = new Date()) {
        if (typeof bond.currentPrice === 'number') return bond.currentPrice;
        return this.imputedCleanPriceFromYTM(bond, asOf);
    }

    // NEW: ETF net from transactions (buys minus sells), in currency
    getETFValueFromTransactions() {
        return this.data.transactions.reduce((sum, tx) => {
            const t = (tx.type || '').toLowerCase();
            if (t === 'etfbuy' || t === 'etfacquisition' || t === 'etf_acquisition') {
                return sum + (tx.amount || 0);
            }
            if (t === 'etfsell' || t === 'etfsale' || t === 'etf_sale') {
                return sum - (tx.amount || 0);
            }
            return sum;
        }, 0);
    }

    // ===== Lifecycle =====
    init() {
        this.setupEventListeners();
        this.showEmptyState();
    }

    setupEventListeners() {
        // Upload modal
        const uploadBtn = document.getElementById('uploadBtn');
        const emptyUploadBtn = document.getElementById('emptyUploadBtn');
        const closeModal = document.getElementById('closeModal');
        const loadSampleBtn = document.getElementById('loadSampleData');

        if (uploadBtn) uploadBtn.addEventListener('click', (e) => { e.preventDefault(); this.openUploadModal(); });
        if (emptyUploadBtn) emptyUploadBtn.addEventListener('click', (e) => { e.preventDefault(); this.openUploadModal(); });
        if (closeModal) closeModal.addEventListener('click', (e) => { e.preventDefault(); this.closeUploadModal(); });
        if (loadSampleBtn) loadSampleBtn.addEventListener('click', (e) => { e.preventDefault(); this.loadSampleData(); });

        // File uploads
        const bondsFile = document.getElementById('bondsFile');
        const etfsFile = document.getElementById('etfsFile'); // optional/ignored
        const transactionsFile = document.getElementById('transactionsFile');

        if (bondsFile) bondsFile.addEventListener('change', (e) => this.handleFileUpload(e, 'bonds'));
        // We no longer require ETF file; keep listener if present, but it won't affect stats
        if (etfsFile) etfsFile.addEventListener('change', (e) => this.handleFileUpload(e, 'etfs'));
        if (transactionsFile) transactionsFile.addEventListener('change', (e) => this.handleFileUpload(e, 'transactions'));

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = e.currentTarget.getAttribute('data-tab');
                if (tab) this.switchTab(tab);
            });
        });

        // Search and filters
        const bondSearch = document.getElementById('bondSearch');
        const issuerFilter = document.getElementById('issuerFilter');
        const depotFilter = document.getElementById('depotFilter');
        const etfSearch = document.getElementById('etfSearch');
        const transactionSearch = document.getElementById('transactionSearch');
        const typeFilter = document.getElementById('typeFilter');
        const dateFilter = document.getElementById('dateFilter');
        const excludeToggle = document.getElementById('excludeMaturedToggle');

        if (bondSearch) bondSearch.addEventListener('input', (e) => this.updateFilter('bonds', 'search', e.target.value));
        if (issuerFilter) issuerFilter.addEventListener('change', (e) => this.updateFilter('bonds', 'issuer', e.target.value));
        if (depotFilter) depotFilter.addEventListener('change', (e) => this.updateFilter('bonds', 'depot', e.target.value));
        if (etfSearch) etfSearch.addEventListener('input', (e) => this.updateFilter('etfs', 'search', e.target.value));
        if (transactionSearch) transactionSearch.addEventListener('input', (e) => this.updateFilter('transactions', 'search', e.target.value));
        if (typeFilter) typeFilter.addEventListener('change', (e) => this.updateFilter('transactions', 'type', e.target.value));
        if (dateFilter) dateFilter.addEventListener('change', (e) => this.updateFilter('transactions', 'date', e.target.value));

        if (excludeToggle) {
            this.filters.bonds.excludeMatured = !!excludeToggle.checked;
            excludeToggle.addEventListener('change', (e) => {
                this.updateFilter('bonds', 'excludeMatured', e.target.checked);
            });
        }

        // Bond detail modal
        const closeBondDetail = document.getElementById('closeBondDetail');
        if (closeBondDetail) closeBondDetail.addEventListener('click', (e) => { e.preventDefault(); this.closeBondDetailModal(); });

        // Close modals on outside click
        const uploadModal = document.getElementById('uploadModal');
        const bondDetailModal = document.getElementById('bondDetailModal');

        if (uploadModal) uploadModal.addEventListener('click', (e) => { if (e.target === e.currentTarget) this.closeUploadModal(); });
        if (bondDetailModal) bondDetailModal.addEventListener('click', (e) => { if (e.target === e.currentTarget) this.closeBondDetailModal(); });
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
            transactions: [
                {"date":"2025-01-15T17:55:37Z","type":"BondPurchase","bondId":"48FC0004-2CB4-4B5C-B943-20C52C1643B5","amount":100000,"id":"p1"},
                {"date":"2024-10-24T06:01:48Z","type":"ETFBuy","etfId":"749EFFEC-1DD3-4891-965F-0407BC2F9DA9","amount":24909.318,"id":"p3"},
                {"date":"2024-12-01T10:30:00Z","type":"BondPurchase","bondId":"6566B604-2159-4BF9-A6C4-211D9D4DB6D0","amount":97414,"id":"p2"}
            ],
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
            ],
            etfs: [] // not used
        };

        setTimeout(() => {
            try {
                this.data.bonds = sampleData.bonds;
                this.data.etfs = sampleData.etfs; // ignored for value
                this.data.transactions = sampleData.transactions;
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
        }, 500);
    }

    async handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        this.showLoading();
        try {
            const text = await this.readFile(file);
            const data = JSON.parse(text);
            this.data[type] = Array.isArray(data) ? data : [data];

            // We only require bonds + transactions to proceed
            if (this.data.bonds.length > 0 && this.data.transactions.length > 0) {
                this.calculateStats();
                this.updateUI();
                this.hideEmptyState();
                this.closeUploadModal();
                this.switchTab('dashboard');
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
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // ===== Stats (Total Principal + ETF net from transactions) =====
    calculateStats() {
        const asOf = new Date();
        const activeBonds = this.getActiveBonds(asOf);

        // Total Principal = sum of par of active bonds
        const totalPrincipal = activeBonds.reduce((sum, bond) => sum + (bond.parValue || 0), 0);

        // Keep equal-weighted average yield for display (on active bonds)
        const averageYield = activeBonds.length > 0
            ? activeBonds.reduce((s, b) => s + (b.yieldToMaturity || 0), 0) / activeBonds.length
            : 0;

        // ETF value is net cash invested from transactions (buys - sells)
        const etfValue = this.getETFValueFromTransactions();

        this.data.stats = {
            activeBonds: activeBonds.length,
            totalPrincipal,          // NEW primary metric
            averageYield,
            etfValue                 // from transactions
        };
    }

    updateUI() {
        this.updateStats();
        this.updateCharts();
        this.updateFilters();
        this.renderBonds();
        this.renderETFs();
        this.renderTransactions();
    }

    updateStats() {
        const stats = this.data.stats;
        const totalPrincipalEl = document.getElementById('totalPrincipal'); // NEW id
        const activeBondsEl = document.getElementById('activeBonds');
        const avgYieldEl = document.getElementById('avgYield');
        const etfValueEl = document.getElementById('etfValue');

        if (totalPrincipalEl) totalPrincipalEl.textContent = this.formatCurrency(stats.totalPrincipal || 0);
        if (activeBondsEl) activeBondsEl.textContent = stats.activeBonds ?? 0;
        if (avgYieldEl) avgYieldEl.textContent = (stats.averageYield ?? 0).toFixed(2) + '%';
        if (etfValueEl) etfValueEl.textContent = this.formatCurrency(stats.etfValue || 0);
    }

    updateCharts() {
        setTimeout(() => {
            this.createCompositionChart();
            this.createMaturityChart();
        }, 100);
    }

    // Composition: active bonds by par; ETF slice uses net from transactions (if positive)
    createCompositionChart() {
        const canvas = document.getElementById('compositionChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (this.charts.composition) this.charts.composition.destroy();

        const issuerData = {};
        this.getActiveBonds().forEach(bond => {
            issuerData[bond.issuer] = (issuerData[bond.issuer] || 0) + (bond.parValue || 0);
        });

        // Add ETF as a single bucket only if net > 0 (charts can't show negative)
        const etfNet = this.getETFValueFromTransactions();
        if (etfNet > 0) issuerData['ETFs'] = (issuerData['ETFs'] || 0) + etfNet;

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

    createMaturityChart() {
        const canvas = document.getElementById('maturityChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (this.charts.maturity) this.charts.maturity.destroy();

        const maturityData = {};
        this.getActiveBonds().forEach(bond => {
            const year = new Date(bond.maturityDate).getFullYear();
            maturityData[year] = (maturityData[year] || 0) + 1;
        });

        this.charts.maturity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(maturityData),
                datasets: [{
                    label: 'Number of Bonds',
                    data: Object.values(maturityData),
                    backgroundColor: '#1FB8CD'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    updateFilters() {
        const sourceBonds = this.filters.bonds.excludeMatured ? this.getActiveBonds() : this.data.bonds;

        // Issuers
        const issuers = [...new Set(sourceBonds.map(bond => bond.issuer))];
        const issuerSelect = document.getElementById('issuerFilter');
        if (issuerSelect) {
            issuerSelect.innerHTML = '<option value="">All Issuers</option>';
            issuers.forEach(issuer => { issuerSelect.innerHTML += `<option value="${issuer}">${issuer}</option>`; });
            if (this.filters.bonds.issuer && !issuers.includes(this.filters.bonds.issuer)) this.filters.bonds.issuer = '';
        }

        // Depots
        const depots = [...new Set(sourceBonds.map(bond => bond.depotBank))];
        const depotSelect = document.getElementById('depotFilter');
        if (depotSelect) {
            depotSelect.innerHTML = '<option value="">All Depots</option>';
            depots.forEach(depot => { depotSelect.innerHTML += `<option value="${depot}">${depot}</option>`; });
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
        switch(type) {
            case 'bonds':
                if (filterName === 'excludeMatured') this.updateFilters();
                this.renderBonds();
                break;
            case 'etfs':
                this.renderETFs();
                break;
            case 'transactions':
                this.renderTransactions();
                break;
        }
    }

    renderBonds() {
        const container = document.getElementById('bondsList');
        if (!container) return;

        let bonds = this.filters.bonds.excludeMatured ? this.getActiveBonds() : [...this.data.bonds];

        const filters = this.filters.bonds;
        if (filters.search) {
            const q = filters.search.toLowerCase();
            bonds = bonds.filter(bond => 
                (bond.name || '').toLowerCase().includes(q) ||
                (bond.issuer || '').toLowerCase().includes(q) ||
                (bond.isin || '').toLowerCase().includes(q)
            );
        }
        if (filters.issuer) bonds = bonds.filter(bond => bond.issuer === filters.issuer);
        if (filters.depot) bonds = bonds.filter(bond => bond.depotBank === filters.depot);

        container.innerHTML = bonds.map(bond => this.createBondCard(bond)).join('');
        container.querySelectorAll('.bond-card').forEach((card, index) => {
            card.addEventListener('click', () => this.showBondDetails(bonds[index]));
        });
    }

    createBondCard(bond) {
        const isActive = this.isBondActive(bond);
        const maturityDate = new Date(bond.maturityDate).toLocaleDateString();
        return `
            <div class="bond-card">
                <div class="bond-header">
                    <div class="bond-name">${bond.name}</div>
                    <div class="bond-yield">${(bond.yieldToMaturity ?? 0).toFixed(2)}%</div>
                </div>
                <div class="bond-details">
                    <div class="detail-item">
                        <div class="detail-label">Issuer</div>
                        <div class="detail-value">${bond.issuer}</div>
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

    renderETFs() {
        const container = document.getElementById('etfsList');
        if (!container) return;

        // We don't derive positions from an ETF file anymore. Optionally, show nothing or a summary.
        // For now, keep legacy behavior if an ETF file was uploaded; otherwise empty.
        let etfs = [...this.data.etfs];
        const search = this.filters.etfs.search;
        if (search) {
            etfs = etfs.filter(etf => 
                (etf.etfName || '').toLowerCase().includes(search.toLowerCase()) ||
                (etf.isin || '').toLowerCase().includes(search.toLowerCase())
            );
        }
        container.innerHTML = etfs.map(etf => this.createETFCard(etf)).join('');
    }

    createETFCard(etf) {
        const shares = etf.shares || 0;
        const totalValue = (etf.lastPrice || 0) * shares;
        return `
            <div class="etf-card">
                <div class="etf-header">
                    <div class="etf-name">${etf.etfName || '(Unnamed ETF)'}</div>
                    <div class="etf-price">€${(etf.lastPrice || 0).toFixed(2)}</div>
                </div>
                <div class="etf-details">
                    <div class="detail-item">
                        <div class="detail-label">ISIN</div>
                        <div class="detail-value">${etf.isin || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Shares</div>
                        <div class="detail-value">${shares.toFixed(2)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Total Value</div>
                        <div class="detail-value">${this.formatCurrency(totalValue)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">WKN</div>
                        <div class="detail-value">${etf.wkn || '-'}</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderTransactions() {
        const container = document.getElementById('transactionsList');
        if (!container) return;

        let transactions = [...this.data.transactions];

        const filters = this.filters.transactions;
        if (filters.search) {
            const q = filters.search.toLowerCase();
            transactions = transactions.filter(tx => 
                (tx.type || '').toLowerCase().includes(q) ||
                (tx.id || '').toLowerCase().includes(q)
            );
        }
        if (filters.type) transactions = transactions.filter(tx => tx.type === filters.type);
        if (filters.date) {
            transactions = transactions.filter(tx => 
                new Date(tx.date).toDateString() === new Date(filters.date).toDateString()
            );
        }

        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        container.innerHTML = transactions.map(tx => this.createTransactionCard(tx)).join('');
    }

    createTransactionCard(transaction) {
        const date = new Date(transaction.date).toLocaleDateString();
        let typeLabel = transaction.type || 'Transaction';
        if (transaction.type === 'BondPurchase') typeLabel = 'Bond Purchase';
        if (transaction.type === 'ETFBuy') typeLabel = 'ETF Buy';
        if (transaction.type === 'ETFSell' || transaction.type === 'ETFSale') typeLabel = 'ETF Sell';
        
        return `
            <div class="transaction-card">
                <div class="transaction-header">
                    <div class="transaction-type">${typeLabel}</div>
                    <div class="transaction-amount">${this.formatCurrency(transaction.amount || 0)}</div>
                </div>
                <div class="transaction-details">
                    <div class="detail-item">
                        <div class="detail-label">Date</div>
                        <div class="detail-value">${date}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">ID</div>
                        <div class="detail-value">${transaction.id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Asset ID</div>
                        <div class="detail-value">${transaction.bondId || transaction.etfId || '-'}</div>
                    </div>
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
                    <div class="detail-item">
                        <div class="detail-label">ISIN</div>
                        <div class="detail-value">${bond.isin}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">WKN</div>
                        <div class="detail-value">${bond.wkn}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Issuer</div>
                        <div class="detail-value">${bond.issuer}</div>
                    </div>
                </div>
                <div class="detail-section">
                    <h4>Financial Details</h4>
                    <div class="detail-item">
                        <div class="detail-label">Par Value</div>
                        <div class="detail-value">${this.formatCurrency(bond.parValue || 0)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Coupon Rate</div>
                        <div class="detail-value">${(bond.couponRate ?? 0).toFixed(2)}%</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Yield to Maturity</div>
                        <div class="detail-value">${(bond.yieldToMaturity ?? 0).toFixed(2)}%</div>
                    </div>
                </div>
                <div class="detail-section">
                    <h4>Purchase Details</h4>
                    <div class="detail-item">
                        <div class="detail-label">Initial Price</div>
                        <div class="detail-value">${this.formatCurrency(bond.initialPrice || 0)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Depot Bank</div>
                        <div class="detail-value">${bond.depotBank}</div>
                    </div>
                </div>
                <div class="detail-section">
                    <h4>Maturity</h4>
                    <div class="detail-item">
                        <div class="detail-label">Maturity Date</div>
                        <div class="detail-value">${new Date(bond.maturityDate).toLocaleDateString()}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Days to Maturity</div>
                        <div class="detail-value">${Math.ceil((new Date(bond.maturityDate) - new Date()) / (1000 * 60 * 60 * 24))}</div>
                    </div>
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
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PortfolioManager();
});
