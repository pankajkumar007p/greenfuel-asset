document.addEventListener('DOMContentLoaded', () => {
    // --- VANTA.JS BACKGROUND INITIALIZATION ---
    let vantaEffect = null;
    try {
        vantaEffect = VANTA.WAVES({
            el: "#vanta-bg",
            mouseControls: false,
            touchControls: false,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            scale: 1.00,
            scaleMobile: 1.00,
            color: 0x005aaa,
            shininess: 25.00,
            waveHeight: 15.00,
            waveSpeed: 0.75,
            zoom: 0.90
        });
    } catch (e) {
        console.error("Vanta.js initialization failed: ", e);
        const vantaBg = document.getElementById('vanta-bg');
        if(vantaBg) vantaBg.style.display = 'none';
    }

    window.addEventListener('beforeunload', () => {
        if (vantaEffect) vantaEffect.destroy();
    });

    // --- LOADER HIDING LOGIC ---
    const loader = document.getElementById('loader-wrapper');
    window.addEventListener('load', () => {
        loader.classList.add('hidden');
    });

    // --- SIDEBAR SLIDE-IN TRIGGER ---
    document.body.classList.add('loaded');

    // --- INITIALIZE AOS ---
    if (window.AOS) {
        AOS.init({
            once: true,
            duration: 600,
        });
    }

    // --- DOM ELEMENT REFERENCES ---
    const mainContent = document.getElementById('mainContent');
    const sidebarNav = document.querySelector('.sidebar-nav');
    const sidebarFooter = document.querySelector('.sidebar-footer');
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const logoutBtn = document.getElementById('logoutBtn');
    const themeSwitcher = document.getElementById('themeSwitcher');

    // --- TEMPLATE REFERENCES ---
    const templates = {
        dashboard: document.getElementById('dashboardTemplate'),
        newRegistration: document.getElementById('newRegistrationTemplate'),
        assetInventory: document.getElementById('assetInventoryTemplate'),
        previewRegistration: document.getElementById('previewRegistrationTemplate'),
        newIssue: document.getElementById('newIssueTemplate'),
        existingIssues: document.getElementById('existingIssuesTemplate'),
        previewIssue: document.getElementById('previewIssueTemplate'),
        reports: document.getElementById('reportsTemplate'),
        account: document.getElementById('accountTemplate'),
        assetTransfer: document.getElementById('assetTransferTemplate'),
        transferHistory: document.getElementById('transferHistoryTemplate'),
    };

    // --- STATE MANAGEMENT ---
    let currentView = 'dashboard';
    let allIssuedAssets = [];
    let allRegisteredAssets = [];
    let reportData = [];
    let currentFormData = {};
    let assetPieChart = null;

    // --- THEME LOGIC ---
    const applyTheme = (theme) => {
        document.body.dataset.theme = theme;
        localStorage.setItem('assetManagementTheme', theme);
        themeSwitcher.value = theme;
    };
    themeSwitcher.addEventListener('change', (e) => applyTheme(e.target.value));

    // --- NAVIGATION HANDLING ---
    const switchView = (view, data = null) => {
        if (!view) return;
        currentView = view;
        currentFormData = data || {};
        updateActiveLink(view);
        render();
        if (window.innerWidth <= 992) {
            document.body.classList.remove('sidebar-visible');
        }
    };

    const updateActiveLink = (view) => {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`.nav-link[data-view="${view}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            const parentGroup = activeLink.closest('.nav-item-group');
            if (parentGroup && !parentGroup.classList.contains('open')) {
                parentGroup.classList.add('open');
            }
        }
    };

    sidebarNav.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        if (link.classList.contains('nav-link-group')) {
            e.preventDefault();
            link.closest('.nav-item-group').classList.toggle('open');
            return;
        }
        if (link.classList.contains('nav-link')) {
            e.preventDefault();
            switchView(link.dataset.view);
        }
    });

    sidebarFooter.addEventListener('click', (e) => {
        const link = e.target.closest('a.nav-link');
        if (link && link.dataset.view) {
            e.preventDefault();
            if (link.dataset.view === 'account') {
                switchView(link.dataset.view);
            }
        }
    });

    // --- RENDER FUNCTION ---
    const render = () => {
        mainContent.classList.add('fade-out');
        setTimeout(() => {
            mainContent.innerHTML = '';
            const template = templates[currentView];
            if (template) {
                mainContent.appendChild(template.content.cloneNode(true));
                addEventListenersForView(currentView);
            } else {
                mainContent.innerHTML = `<h2>View '${currentView}' not found.</h2>`;
            }
            mainContent.classList.remove('fade-out');
            if (window.AOS) {
                AOS.init({ once: true, duration: 600 });
            }
        }, 300);
    };
    
    // --- MOBILE SIDEBAR TOGGLE ---
    mobileMenuButton.addEventListener('click', () => document.body.classList.toggle('sidebar-visible'));
    sidebarOverlay.addEventListener('click', () => document.body.classList.remove('sidebar-visible'));

    // --- LOGOUT ---
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('assetManagementTheme');
        window.location.href = '/';
    });
    
    // --- EVENT LISTENERS DISPATCHER ---
    const addEventListenersForView = (view) => {
        switch (view) {
            case 'dashboard': loadDashboardStats(); loadPieChartData(); break;
            case 'newRegistration': setupNewRegistrationForm(); break;
            case 'assetInventory': loadAssetInventory(); break;
            case 'previewRegistration': setupPreviewRegistrationForm(currentFormData); break;
            case 'newIssue': setupAssetForm(currentFormData); break;
            case 'existingIssues': loadExistingIssues(); break;
            case 'previewIssue': setupPreviewIssueForm(currentFormData); break;
            case 'reports': setupReports(); break;
            case 'account': setupAccountForm(); break;
            case 'assetTransfer': setupAssetTransferForm(); break;
            case 'transferHistory': loadTransferHistory(); break;
        }
    };

    // --- VIEW-SPECIFIC LOGIC FUNCTIONS ---
    
    const setupAccountForm = () => {
        const form = document.getElementById('accountForm');
        const messageDiv = document.getElementById('accountFormMessage');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            messageDiv.className = 'message';
            messageDiv.textContent = '';
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            if (!data.password) delete data.password;
            try {
                const response = await fetch('/api/account', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                messageDiv.textContent = result.message;
                messageDiv.className = response.ok ? 'message success' : 'message error';
            } catch (error) {
                console.error('Account update error:', error);
                messageDiv.textContent = 'An error occurred while updating the account.';
                messageDiv.className = 'message error';
            }
        });
    };

    const loadDashboardStats = async () => {
        try {
            const response = await fetch('/api/dashboard-stats');
            const data = await response.json();
            const pivot = {};
            const departments = new Set(['IT Stock']);
            const devices = new Set();
            data.forEach(item => {
                devices.add(item.device);
                departments.add(item.department);
                if (!pivot[item.device]) pivot[item.device] = {};
                pivot[item.device][item.department] = item.count;
            });
            const sortedDepartments = Array.from(departments).sort((a, b) => {
                if (a === 'IT Stock') return 1;
                if (b === 'IT Stock') return -1;
                return a.localeCompare(b);
            });
            const table = document.getElementById('assetDistributionTable');
            const thead = table.querySelector('thead');
            thead.innerHTML = `<tr><th>Device</th>${sortedDepartments.map(d => `<th>${d}</th>`).join('')}<th>Total</th></tr>`;
            let totalIssued = 0;
            let totalAvailable = 0;
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = '';
            const grandTotals = { total: 0 };
            sortedDepartments.forEach(dept => grandTotals[dept] = 0);
            devices.forEach(device => {
                let rowTotal = 0;
                const row = document.createElement('tr');
                let rowHTML = `<td>${device}</td>`;
                sortedDepartments.forEach(dept => {
                    const count = pivot[device][dept] || 0;
                    rowHTML += `<td>${count}</td>`;
                    rowTotal += count;
                    grandTotals[dept] += count;
                    if (dept === 'IT Stock') totalAvailable += count; else totalIssued += count;
                });
                rowHTML += `<td><strong>${rowTotal}</strong></td>`;
                row.innerHTML = rowHTML;
                tbody.appendChild(row);
                grandTotals.total += rowTotal;
            });
            const footerRow = document.createElement('tr');
            footerRow.style.fontWeight = 'bold';
            let footerHTML = `<td>Total</td>`;
            sortedDepartments.forEach(dept => footerHTML += `<td>${grandTotals[dept]}</td>`);
            footerHTML += `<td>${grandTotals.total}</td>`;
            footerRow.innerHTML = footerHTML;
            tbody.appendChild(footerRow);
            document.getElementById('issuedAssets').textContent = totalIssued;
            document.getElementById('availableAssets').textContent = totalAvailable;
            document.getElementById('totalAssets').textContent = totalIssued + totalAvailable;
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
            const container = document.querySelector('.stats-table-container');
            if (container) container.innerHTML = '<p>Error loading dashboard data.</p>';
        }
    };

    const loadPieChartData = async () => {
        try {
            const response = await fetch('/api/asset-distribution');
            const data = await response.json();
            const labels = data.map(item => item.category);
            const counts = data.map(item => item.count);
            renderPieChart(labels, counts);
        } catch (error) {
            console.error('Failed to load pie chart data:', error);
            const chartContainer = document.querySelector('.chart-container');
            if(chartContainer) chartContainer.innerHTML = '<p>Error loading chart data.</p>';
        }
    };

    const renderPieChart = (labels, data) => {
        const ctx = document.getElementById('assetPieChart').getContext('2d');
        if (assetPieChart) assetPieChart.destroy();
        assetPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Asset Distribution',
                    data: data,
                    backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6c757d', '#fd7e14', '#6610f2'],
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    };

    const setupNewRegistrationForm = () => {
        const form = document.getElementById('newRegistrationForm');
        const messageDiv = document.getElementById('registrationFormMessage');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            try {
                const response = await fetch('/api/register-asset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                const result = await response.json();
                messageDiv.textContent = result.message;
                messageDiv.className = response.ok ? 'message success' : 'message error';
                if (response.ok) form.reset();
            } catch (error) {
                console.error('Registration submission error:', error);
                messageDiv.textContent = 'An error occurred during registration.';
                messageDiv.className = 'message error';
            }
        });
        form.querySelector('.btn-secondary').addEventListener('click', () => { form.reset(); messageDiv.className = 'message'; });
    };

    const loadAssetInventory = async () => {
        try {
            const [regResponse, issuedResponse] = await Promise.all([fetch('/api/registered-assets'), fetch('/api/assets')]);
            allRegisteredAssets = await regResponse.json();
            allIssuedAssets = await issuedResponse.json();
            const issuedSerialNumbers = new Set(allIssuedAssets.map(asset => asset.serial_number));
            const tableBody = document.querySelector('#inventoryTable tbody');
            tableBody.innerHTML = '';
            if (allRegisteredAssets.length === 0) { tableBody.innerHTML = '<tr><td colspan="7">No assets registered yet.</td></tr>'; return; }
            allRegisteredAssets.forEach(asset => {
                const isIssued = issuedSerialNumbers.has(asset.asset_serial_no);
                const status = isIssued ? '<span class="status-issued">Issued</span>' : '<span class="status-available">Available</span>';
                const warrantyEnd = asset.warranty_end_date ? new Date(asset.warranty_end_date).toLocaleDateString() : 'N/A';
                const row = document.createElement('tr');
                row.innerHTML = `<td>${asset.asset_serial_no}</td><td>${asset.asset_make || '-'}</td><td>${asset.asset_model || '-'}</td><td>${asset.vendor || '-'}</td><td>${warrantyEnd}</td><td>${status}</td><td class="actions-cell"><button class="btn btn-secondary preview-reg-btn" data-id="${asset.id}">Preview</button></td>`;
                tableBody.appendChild(row);
            });
            document.querySelectorAll('.preview-reg-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const assetData = allRegisteredAssets.find(a => a.id == e.target.dataset.id);
                    if (assetData) switchView('previewRegistration', assetData);
                });
            });
        } catch (error) {
            console.error('Failed to load asset inventory:', error);
            document.querySelector('#inventoryTable tbody').innerHTML = '<tr><td colspan="7">Error loading data.</td></tr>';
        }
    };

    const setupPreviewRegistrationForm = (assetData) => {
        const previewForm = document.getElementById('previewRegistrationForm');
        if (!assetData) return;
        for (const key in assetData) {
            if (previewForm.elements[key]) {
                const isDate = key.includes('date') && assetData[key];
                previewForm.elements[key].value = isDate ? assetData[key].split('T')[0] : assetData[key] || '';
            }
        }
    };

    const setupAssetForm = (assetToEdit = {}) => {
        const assetForm = document.getElementById('assetForm');
        if (!assetForm) return;
        const formTitle = document.getElementById('formTitle');
        const submitBtn = document.getElementById('submitBtn');
        const formMessage = document.getElementById('formMessage');

        if (assetToEdit && Object.keys(assetToEdit).length > 0) {
            formTitle.textContent = 'Edit Asset Issue';
            submitBtn.textContent = 'Update';
            for (const key in assetToEdit) { if (assetForm.elements[key]) assetForm.elements[key].value = assetToEdit[key] || ''; }
        } else {
            const dateInput = assetForm.querySelector('[name="issue_date_manual"]');
            if (dateInput) dateInput.value = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        }

        assetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(assetForm);
            const data = Object.fromEntries(formData.entries());
            const assetId = data.id;
            const url = assetId ? `/api/assets/${assetId}` : '/api/assets';
            const method = assetId ? 'PUT' : 'POST';
            try {
                const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                const result = await response.json();
                formMessage.textContent = result.message;
                formMessage.className = response.ok ? 'message success' : 'message error';
                if (response.ok) {
                    assetForm.reset();
                    setTimeout(() => switchView('existingIssues'), 1500);
                }
            } catch (error) {
                console.error('Form submission error:', error);
                formMessage.textContent = 'An error occurred.';
                formMessage.className = 'message error';
            }
        });

        document.getElementById('clearBtn').addEventListener('click', () => { assetForm.reset(); formMessage.className = 'message'; });
        document.getElementById('downloadDocxBtn').addEventListener('click', () => generateHandoverDocument(assetForm));
    };

    const generateHandoverDocument = async (form) => {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        try {
            const response = await fetch('/api/generate-handover-form', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `Handover_Form_${data.employee_name || 'user'}.docx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } else {
                alert('Error generating document. Please try again.');
            }
        } catch (error) {
            console.error('Error downloading document:', error);
            alert('An error occurred while trying to download the document.');
        }
    };

    const loadExistingIssues = async () => {
        try {
            const response = await fetch('/api/assets');
            allIssuedAssets = await response.json();
            const tableBody = document.querySelector('#issuesTable tbody');
            tableBody.innerHTML = '';
            if (allIssuedAssets.length === 0) { tableBody.innerHTML = '<tr><td colspan="7">No asset issues found.</td></tr>'; return; }
            allIssuedAssets.forEach(asset => {
                const row = document.createElement('tr');
                const displayDate = asset.issue_date_manual || new Date(asset.created_at).toLocaleDateString();
                row.innerHTML = `<td>${asset.employee_code}</td><td>${asset.employee_name}</td><td>${asset.department}</td><td>${asset.asset_type}</td><td>${asset.serial_number}</td><td>${displayDate}</td><td class="actions-cell"><button class="btn btn-secondary preview-issue-btn" data-id="${asset.id}">Preview</button></td>`;
                tableBody.appendChild(row);
            });
            document.querySelectorAll('.preview-issue-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const assetData = allIssuedAssets.find(a => a.id == e.target.dataset.id);
                    if (assetData) switchView('previewIssue', assetData);
                });
            });
        } catch (error) {
            console.error('Failed to load assets:', error);
            document.querySelector('#issuesTable tbody').innerHTML = '<tr><td colspan="7">Error loading data.</td></tr>';
        }
    };

    const setupPreviewIssueForm = (assetData) => {
        const previewForm = document.getElementById('previewForm');
        if (!assetData) return;
        for (const key in assetData) {
            if (previewForm.elements[key]) previewForm.elements[key].value = assetData[key] || '';
        }
        document.getElementById('downloadPreviewDocxBtn').addEventListener('click', () => generateHandoverDocument(previewForm));
    };

    const setupAssetTransferForm = () => {
        const form = document.getElementById('assetTransferForm');
        const searchInput = document.getElementById('transferEmployeeSearch');
        const messageDiv = document.getElementById('transferFormMessage');
        let searchTimeout;

        const clearFromFields = () => {
            form.querySelectorAll('[name$="_from"]').forEach(field => field.value = '');
            form.elements['asset_issue_id'].value = '';
        };

        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const searchTerm = searchInput.value;
            if (searchTerm.length < 2) { clearFromFields(); return; }
            searchTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`/api/asset-by-employee?searchTerm=${encodeURIComponent(searchTerm)}`);
                    const result = await response.json();
                    if (response.ok && result.success) {
                        const asset = result.data;
                        form.elements['asset_issue_id'].value = asset.id;
                        form.elements['employee_name_from'].value = asset.employee_name || '';
                        form.elements['employee_code_from'].value = asset.employee_code || '';
                        form.elements['department_from'].value = asset.department || '';
                        form.elements['asset_type_from'].value = asset.asset_type || '';
                        form.elements['asset_code_from'].value = asset.asset_code || '';
                        form.elements['serial_number_from'].value = asset.serial_number || '';
                        messageDiv.className = 'message';
                    } else {
                        clearFromFields();
                        messageDiv.textContent = result.message || 'No asset found.';
                        messageDiv.className = 'message error';
                    }
                } catch (error) {
                    clearFromFields();
                    messageDiv.textContent = 'Error searching.';
                    messageDiv.className = 'message error';
                }
            }, 500);
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            if (!data.asset_issue_id) {
                messageDiv.textContent = 'Please select an asset to transfer.';
                messageDiv.className = 'message error';
                return;
            }
            try {
                const response = await fetch('/api/transfer-asset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                messageDiv.textContent = result.message;
                messageDiv.className = response.ok ? 'message success' : 'message error';
                if (response.ok) {
                    form.reset();
                    setTimeout(() => switchView('transferHistory'), 1500);
                }
            } catch (error) {
                messageDiv.textContent = 'An error occurred during transfer.';
                messageDiv.className = 'message error';
            }
        });

        document.getElementById('clearTransferFormBtn').addEventListener('click', () => {
            form.reset();
            messageDiv.className = 'message';
        });
    };
    
    const loadTransferHistory = async () => {
        try {
            const response = await fetch('/api/transfer-history');
            const historyData = await response.json();
            const tableBody = document.querySelector('#transferHistoryTable tbody');
            tableBody.innerHTML = '';
            if (historyData.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="8">No transfer history found.</td></tr>';
                return;
            }
            historyData.forEach(item => {
                const row = document.createElement('tr');
                const transferDate = new Date(item.transfer_date).toLocaleString();
                row.innerHTML = `
                    <td>${transferDate}</td>
                    <td>${item.asset_code || '-'}</td>
                    <td>${item.serial_number || '-'}</td>
                    <td>${item.employee_name_from || '-'} (${item.employee_code_from || '-'})</td>
                    <td>${item.department_from || '-'}</td>
                    <td>${item.employee_name_to || '-'} (${item.employee_code_to || '-'})</td>
                    <td>${item.department_to || '-'}</td>
                    <td>${item.reason || '-'}</td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Failed to load transfer history:', error);
            document.querySelector('#transferHistoryTable tbody').innerHTML = '<tr><td colspan="8">Error loading data.</td></tr>';
        }
    };

    const setupReports = () => {
        document.getElementById('generateReportBtn').addEventListener('click', generateReport);
        document.getElementById('printReportBtn').addEventListener('click', () => window.print());
        document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);
        document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    };

    const generateReport = async () => {
        const startDate = document.getElementById('startDateFilter').value;
        const endDate = document.getElementById('endDateFilter').value;
        const department = document.getElementById('departmentFilter').value;
        const user = document.getElementById('userFilter').value;
        const query = new URLSearchParams({ startDate, endDate, department, user }).toString();
        try {
            const response = await fetch(`/api/reports?${query}`);
            reportData = await response.json();
            renderReportTable(reportData);
            document.getElementById('reportActions').style.display = reportData.length > 0 ? 'flex' : 'none';
        } catch (error) {
            console.error('Error generating report:', error);
            document.getElementById('reportResultContainer').innerHTML = '<p>Error fetching report data.</p>';
        }
    };

    const renderReportTable = (data) => {
        const container = document.getElementById('reportResultContainer');
        container.innerHTML = '';
        if (data.length === 0) { container.innerHTML = '<p>No records match the filter criteria.</p>'; return; }
        const table = document.createElement('table');
        table.id = 'reportTable';
        table.innerHTML = `<thead><tr><th>Date</th><th>Emp Code</th><th>Name</th><th>Department</th><th>Asset Type</th><th>Serial No.</th><th>Hostname</th></tr></thead><tbody>
                ${data.map(row => {
                    const displayDate = row.issue_date_manual || new Date(row.created_at).toLocaleDateString();
                    return `<tr><td>${displayDate}</td><td>${row.employee_code}</td><td>${row.employee_name}</td><td>${row.department}</td><td>${row.asset_type}</td><td>${row.serial_number}</td><td>${row.hostname}</td></tr>`;
                }).join('')}</tbody>`;
        container.appendChild(table);
    };

    const exportToPDF = () => {
        if (reportData.length === 0) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.autoTable({ html: '#reportTable', startY: 20, headStyles: { fillColor: [0, 86, 179] }, didDrawPage: data => doc.text("Greenfuel Asset Report", 14, 15) });
        doc.save('asset_report.pdf');
    };
    
    const exportToExcel = () => {
        if (reportData.length === 0) return;
        const ws = XLSX.utils.table_to_sheet(document.getElementById('reportTable'));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Asset Report");
        XLSX.writeFile(wb, "asset_report.xlsx");
    };

    // --- INITIALIZE THE APP ---
    applyTheme(localStorage.getItem('assetManagementTheme') || 'blue');
    switchView('dashboard');
});