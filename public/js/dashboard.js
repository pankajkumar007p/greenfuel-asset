document.addEventListener('DOMContentLoaded', () => {
    // --- VANTA.JS THEME CONFIGURATION ---
    let vantaEffect = null;
    const themeVantaSettings = {
        blue: {
            color: 0x005aaa,
            shininess: 30.00,
            waveHeight: 15.00,
            waveSpeed: 0.75,
            zoom: 0.90
        },
        dark: {
            color: 0x1a1a1a, // Dark grey
            shininess: 15.00,
            waveHeight: 10.00,
            waveSpeed: 0.60,
            zoom: 0.90
        },
        green: {
            color: 0x285028, // Forest green
            shininess: 20.00,
            waveHeight: 12.00,
            waveSpeed: 0.70,
            zoom: 0.90
        },
        grey: {
            color: 0x808080, // Standard grey
            shininess: 10.00,
            waveHeight: 14.00,
            waveSpeed: 0.65,
            zoom: 0.90
        }
    };

    /**
     * Initializes or updates the VANTA.WAVES background effect based on the selected theme.
     * It ensures any existing effect is destroyed before creating a new one to prevent
     * performance issues.
     * @param {string} theme - The name of the theme to apply (e.g., 'blue', 'dark').
     */
    const initializeVanta = (theme) => {
        // Destroy the previous instance if it exists
        if (vantaEffect) {
            vantaEffect.destroy();
        }

        // Get the settings for the current theme, or default to blue
        const settings = themeVantaSettings[theme] || themeVantaSettings.blue;

        // Create a new Vanta instance with the selected theme's settings
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
                ...settings // Apply theme-specific settings
            });
        } catch (e) {
            console.error("Vanta.js initialization failed: ", e);
            const vantaBg = document.getElementById('vanta-bg');
            if (vantaBg) vantaBg.style.display = 'none'; // Hide if Vanta fails
        }
    };

    // --- CLEANUP ON PAGE UNLOAD ---
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
    const assetDetailModal = document.getElementById('assetDetailModal');

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
        garbageAssets: document.getElementById('garbageAssetsTemplate'),
    };

    // --- STATE MANAGEMENT ---
    let currentView = 'dashboard';
    let allIssuedAssets = [];
    let allRegisteredAssets = [];
    let reportData = [];
    let currentFormData = {};
    let assetPieChart = null;

    // --- THEME LOGIC ---
    /**
     * Applies the selected theme to the body, saves it to localStorage,
     * and updates the Vanta.js background to match.
     * @param {string} theme - The theme name.
     */
    const applyTheme = (theme) => {
        document.body.dataset.theme = theme;
        localStorage.setItem('assetManagementTheme', theme);
        themeSwitcher.value = theme;
        initializeVanta(theme); // Dynamically update Vanta background
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
            case 'dashboard':
                loadDashboardData();
                break;
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
            case 'garbageAssets': setupGarbageAssetsView(); break;
        }
    };

    // --- VIEW-SPECIFIC LOGIC FUNCTIONS ---
    const loadDashboardData = async () => {
        try {
            const [regResponse, issuedResponse, statsResponse, distResponse] = await Promise.all([
                fetch('/api/registered-assets'),
                fetch('/api/assets'),
                fetch('/api/dashboard-stats'),
                fetch('/api/asset-distribution')
            ]);
            allRegisteredAssets = await regResponse.json();
            allIssuedAssets = await issuedResponse.json();
            const statsData = await statsResponse.json();
            const distData = await distResponse.json();

            populateDashboardStats();
            renderDistributionTable(statsData);
            renderPieChart(distData.map(d => d.category), distData.map(d => d.count));
            setupStatCardListeners();

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            document.querySelector('.stats-cards-container').innerHTML = '<p>Error loading dashboard data.</p>';
        }
    };

    const populateDashboardStats = () => {
        const issuedSerialNumbers = new Set(allIssuedAssets.map(asset => asset.serial_number));
        const availableAssets = allRegisteredAssets.filter(asset => !issuedSerialNumbers.has(asset.asset_serial_no));

        document.getElementById('totalAssets').textContent = allRegisteredAssets.length;
        document.getElementById('issuedAssets').textContent = allIssuedAssets.length;
        document.getElementById('availableAssets').textContent = availableAssets.length;
    };

    const renderDistributionTable = (data) => {
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
            if (a === 'IT Stock') return 1; if (b === 'IT Stock') return -1;
            return a.localeCompare(b);
        });
        const table = document.getElementById('assetDistributionTable');
        if (!table) return;
        const thead = table.querySelector('thead');
        thead.innerHTML = `<tr><th>Device</th>${sortedDepartments.map(d => `<th>${d}</th>`).join('')}<th>Total</th></tr>`;
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
    };
    
    const renderPieChart = (labels, data) => {
        const ctx = document.getElementById('assetPieChart')?.getContext('2d');
        if (!ctx) return;
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
    
    const setupStatCardListeners = () => {
        const container = document.querySelector('.stats-cards-container');
        if (!container) return;
        container.addEventListener('click', (e) => {
            const card = e.target.closest('.stat-card');
            if (!card) return;
    
            const assetType = card.dataset.assetType;
            let title = '';
            let data = [];
            const issuedSerialNumbers = new Set(allIssuedAssets.map(asset => asset.serial_number));
    
            switch (assetType) {
                case 'total':
                    title = 'Total Registered Assets';
                    data = allRegisteredAssets;
                    break;
                case 'issued':
                    title = 'Issued Assets';
                    data = allIssuedAssets;
                    break;
                case 'available':
                    title = 'Assets in Stock (Available)';
                    data = allRegisteredAssets.filter(asset => !issuedSerialNumbers.has(asset.asset_serial_no));
                    break;
            }
            showAssetModal(title, data, assetType);
        });
    };
    
    const showAssetModal = (title, data, type) => {
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
    
        modalTitle.textContent = title;
    
        if (data.length === 0) {
            modalBody.innerHTML = '<p>No assets to display in this category.</p>';
        } else {
            const headers = (type === 'issued') 
                ? ['S/No', 'Make/Model', 'Employee', 'Department']
                : ['S/No', 'Make', 'Model', 'Status'];
    
            let tableHTML = `<table id="modalTable"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    
            const issuedSerials = new Set(allIssuedAssets.map(a => a.serial_number || a.asset_serial_no));
    
            tableHTML += data.map(asset => {
                if (type === 'issued') {
                    return `<tr>
                        <td>${asset.serial_number || '-'}</td>
                        <td>${asset.make_model || '-'}</td>
                        <td>${asset.employee_name || '-'}</td>
                        <td>${asset.department || '-'}</td>
                    </tr>`;
                } else {
                    const serial = asset.asset_serial_no;
                    const status = issuedSerials.has(serial)
                        ? '<span class="status-issued">Issued</span>'
                        : '<span class="status-available">Available</span>';
                    return `<tr>
                        <td>${serial || '-'}</td>
                        <td>${asset.asset_make || '-'}</td>
                        <td>${asset.asset_model || '-'}</td>
                        <td>${status}</td>
                    </tr>`;
                }
            }).join('');
            
            tableHTML += `</tbody></table>`;
            modalBody.innerHTML = tableHTML;
        }
    
        assetDetailModal.classList.add('visible');
    
        const closeModal = () => {
            assetDetailModal.classList.remove('visible');
        };
    
        assetDetailModal.querySelector('.modal-close-btn').onclick = closeModal;
        assetDetailModal.addEventListener('click', (e) => {
            if (e.target === assetDetailModal) {
                closeModal();
            }
        }, { once: true });
    };

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
        const phoneInput = assetForm.querySelector('[name="phone_number"]');
        const phoneValidationMsg = phoneInput.nextElementSibling;
        const serialInput = assetForm.querySelector('[name="serial_number"]');
        const serialValidationMsg = serialInput.parentElement.querySelector('.validation-message');
        const makeModelInput = assetForm.querySelector('[name="make_model"]');

        if (assetToEdit && Object.keys(assetToEdit).length > 0) {
            formTitle.textContent = 'Edit Asset Issue';
            submitBtn.textContent = 'Update';
            for (const key in assetToEdit) {
                if (assetForm.elements[key]) {
                    assetForm.elements[key].value = assetToEdit[key] || '';
                }
            }
            serialInput.readOnly = true;
        } else {
            const dateInput = assetForm.querySelector('[name="issue_date_manual"]');
            if (dateInput) dateInput.value = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        }

        phoneInput.addEventListener('input', () => {
            const phoneRegex = /^\d{10}$/;
            phoneInput.value = phoneInput.value.replace(/[^0-9]/g, '');
            if (phoneInput.value === '' || phoneRegex.test(phoneInput.value)) {
                phoneValidationMsg.textContent = '';
                phoneValidationMsg.className = 'validation-message';
            } else {
                phoneValidationMsg.textContent = 'Enter a valid 10-digit mobile number.';
                phoneValidationMsg.className = 'validation-message error';
            }
        });

        serialInput.addEventListener('blur', async () => {
            if (serialInput.readOnly) return;
            const serialNumber = serialInput.value.trim();
            serialValidationMsg.textContent = '';
            makeModelInput.value = '';

            if (serialNumber === '') {
                serialValidationMsg.className = 'validation-message';
                return;
            }

            try {
                const response = await fetch(`/api/validate-serial/${serialNumber}`);
                const result = await response.json();

                serialValidationMsg.textContent = result.message;
                if (response.ok && result.isValid) {
                    serialValidationMsg.className = 'validation-message success';
                    if (result.assetDetails) {
                        makeModelInput.value = `${result.assetDetails.asset_make || ''} ${result.assetDetails.asset_model || ''}`.trim();
                    }
                } else {
                    serialValidationMsg.className = 'validation-message error';
                }
            } catch (error) {
                console.error('Validation fetch error:', error);
                serialValidationMsg.textContent = 'Could not validate. Please try again.';
                serialValidationMsg.className = 'validation-message error';
            }
        });

        assetForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const isPhoneValid = phoneInput.value === '' || /^\d{10}$/.test(phoneInput.value);
            const isSerialValid = serialValidationMsg.classList.contains('success') || serialInput.readOnly;

            if (!isPhoneValid || !isSerialValid) {
                formMessage.textContent = 'Please correct the errors before submitting.';
                formMessage.className = 'message error';
                return;
            }

            const formData = new FormData(assetForm);
            const data = Object.fromEntries(formData.entries());
            const assetId = data.id;
            const url = assetId ? `/api/assets/${assetId}` : '/api/assets';
            const method = assetId ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                const result = await response.json();
                
                if (!response.ok) {
                    formMessage.textContent = result.message;
                    formMessage.className = 'message error';
                    return;
                }

                if (method === 'POST') {
                    switchView('previewIssue', result.data);
                } else {
                    formMessage.textContent = result.message;
                    formMessage.className = 'message success';
                    setTimeout(() => switchView('existingIssues'), 1500);
                }

            } catch (error) {
                console.error('Form submission error:', error);
                formMessage.textContent = 'An error occurred during submission.';
                formMessage.className = 'message error';
            }
        });

        document.getElementById('clearBtn').addEventListener('click', () => { 
            assetForm.reset(); 
            formMessage.className = 'message';
            phoneValidationMsg.textContent = '';
            serialValidationMsg.textContent = '';
        });
        document.getElementById('downloadDocxBtn').addEventListener('click', () => generateHandoverDocument(previewForm));
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
            if (previewForm.elements[key]) {
                previewForm.elements[key].value = assetData[key] || '';
            }
        }
        
        document.getElementById('downloadPreviewDocxBtn').addEventListener('click', () => generateHandoverDocument(previewForm));

        const sendEmailBtn = document.getElementById('sendEmailBtn');
        const emailModal = document.getElementById('emailConfirmModal');
        const emailForm = document.getElementById('emailConfirmForm');
        const closeBtn = emailModal.querySelector('.modal-close-btn');
        const emailRecipientSpan = document.getElementById('emailRecipient');
        const emailMessageDiv = document.getElementById('emailFormMessage');

        sendEmailBtn.addEventListener('click', () => {
            emailRecipientSpan.textContent = assetData.email_id;
            emailForm.reset();
            emailMessageDiv.className = 'message';
            emailModal.classList.add('visible');
        });

        const closeModal = () => emailModal.classList.remove('visible');
        closeBtn.addEventListener('click', closeModal);
        emailModal.addEventListener('click', (e) => {
            if (e.target === emailModal) closeModal();
        });

        emailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            emailMessageDiv.className = 'message';
            
            const formData = new FormData();
            formData.append('assetIssueId', assetData.id);
            const attachmentFile = emailForm.querySelector('#emailAttachment').files[0];
            if (attachmentFile) {
                formData.append('attachment', attachmentFile);
            }

            try {
                const response = await fetch('/api/send-welcome-email', {
                    method: 'POST',
                    body: formData,
                });

                const result = await response.json();
                emailMessageDiv.textContent = result.message;
                emailMessageDiv.className = response.ok ? 'message success' : 'message error';

                if (response.ok) {
                    setTimeout(() => {
                        closeModal();
                    }, 2000);
                }
            } catch (error) {
                console.error('Email sending error:', error);
                emailMessageDiv.textContent = 'An error occurred while sending the email.';
                emailMessageDiv.className = 'message error';
            }
        });
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
                        form.elements['division_from'].value = asset.division || '';
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

    const loadGarbageAssets = async () => {
        try {
            const response = await fetch('/api/garbage-assets');
            const data = await response.json();
            const tableBody = document.querySelector('#garbageAssetsTable tbody');
            if (!tableBody) return;
            tableBody.innerHTML = '';
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5">No assets have been marked as garbage yet.</td></tr>';
                return;
            }
            data.forEach(asset => {
                const row = document.createElement('tr');
                const garbageDate = new Date(asset.date_marked_as_garbage).toLocaleDateString();
                row.innerHTML = `
                    <td>${garbageDate}</td>
                    <td>${asset.serial_number}</td>
                    <td>${asset.asset_type || '-'}</td>
                    <td>${asset.assigned_department || '-'}</td>
                    <td>${asset.reason_for_disposal}</td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Failed to load garbage assets:', error);
            document.querySelector('#garbageAssetsTable tbody').innerHTML = '<tr><td colspan="8">Error loading data.</td></tr>';
        }
    };
    
    const setupGarbageAssetsView = () => {
        const form = document.getElementById('garbageAssetsForm');
        const messageDiv = document.getElementById('garbageFormMessage');
        const dateInput = form.querySelector('[name="date_marked_as_garbage"]');
    
        dateInput.valueAsDate = new Date();
    
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            messageDiv.className = 'message';
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
    
            try {
                const response = await fetch('/api/garbage-assets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                const result = await response.json();
                messageDiv.textContent = result.message;
                messageDiv.className = response.ok ? 'message success' : 'message error';
                if (response.ok) {
                    form.reset();
                    dateInput.valueAsDate = new Date();
                    loadGarbageAssets();
                }
            } catch (error) {
                console.error('Garbage asset submission error:', error);
                messageDiv.textContent = 'An error occurred during submission.';
                messageDiv.className = 'message error';
            }
        });
    
        loadGarbageAssets();
    };

    // --- INITIALIZE THE APP ---
    applyTheme(localStorage.getItem('assetManagementTheme') || 'blue');
    switchView('dashboard');
});
