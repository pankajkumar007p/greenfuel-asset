// server.js - Backend for Greenfuel Asset Management

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = 'docxtemplater';

const app = express();
const port = 3000;

// --- MIDDLEWARE SETUP ---
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE CONNECTION ---
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Pankaj@123',
    database: 'greenfuel_db',
    connectionLimit: 10,
};

const db = mysql.createPool(dbConfig); // Using a pool is better practice

db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        return;
    }
    console.log('Successfully connected to MySQL database.');
    connection.release();
});


// --- API ROUTES ---

// 1. LOGIN ROUTE
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }
    const query = 'SELECT * FROM admins WHERE username = ? AND password = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
        if (results.length > 0) {
            res.json({ success: true, message: 'Login successful!' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
    });
});

// 2. UPDATE ACCOUNT ROUTE
app.put('/api/account', (req, res) => {
    const { username, email, password } = req.body;

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required to identify the account to update.' });
    }

    let query;
    const queryParams = [];
    const updates = [];
    
    if (email) {
        updates.push('email = ?');
        queryParams.push(email);
    }
    if (password) {
        // In a real application, you should hash the password here.
        updates.push('password = ?');
        queryParams.push(password);
    }

    if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'No new data provided for update.' });
    }

    queryParams.push(username);
    query = `UPDATE admins SET ${updates.join(', ')} WHERE username = ?`;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            console.error('Database update error:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'This email is already in use by another account.' });
            }
            return res.status(500).json({ success: false, message: 'Failed to update account.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }
        res.json({ success: true, message: 'Account updated successfully!' });
    });
});


// 3. GET ALL ASSET ISSUES
app.get('/api/assets', (req, res) => {
    const query = 'SELECT * FROM asset_issues ORDER BY created_at DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch asset records.' });
        }
        res.json(results);
    });
});

// 4. CREATE NEW ASSET ISSUE
app.post('/api/assets', (req, res) => {
    const newAsset = req.body;
    if (!newAsset.employee_name || !newAsset.employee_code || !newAsset.serial_number) {
        return res.status(400).json({ success: false, message: 'Employee Name, Code, and Asset Serial Number are required.' });
    }
    const query = 'INSERT INTO asset_issues SET ?';
    db.query(query, newAsset, (err, result) => {
        if (err) {
            console.error('Database insert error:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                 return res.status(409).json({ success: false, message: 'An asset with this serial number already exists.' });
            }
            return res.status(500).json({ success: false, message: 'Failed to create new asset issue.' });
        }
        res.status(201).json({ success: true, message: 'Asset issue created successfully!', id: result.insertId });
    });
});

// 5. UPDATE ASSET ISSUE
app.put('/api/assets/:id', (req, res) => {
    const assetId = req.params.id;
    const assetData = req.body;
    const query = 'UPDATE asset_issues SET ? WHERE id = ?';
    db.query(query, [assetData, assetId], (err, result) => {
        if (err) {
            console.error('Database update error:', err);
            return res.status(500).json({ success: false, message: 'Failed to update asset issue.' });
        }
        if (result.affectedRows === 0) { return res.status(404).json({ success: false, message: 'Asset not found.' }); }
        res.json({ success: true, message: 'Asset issue updated successfully!' });
    });
});

// 6. DELETE ASSET ISSUE
app.delete('/api/assets/:id', (req, res) => {
    const assetId = req.params.id;
    const query = 'DELETE FROM asset_issues WHERE id = ?';
    db.query(query, [assetId], (err, result) => {
        if (err) {
            console.error('Database delete error:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete asset issue.' });
        }
        if (result.affectedRows === 0) { return res.status(404).json({ success: false, message: 'Asset not found.' }); }
        res.json({ success: true, message: 'Asset issue deleted successfully!' });
    });
});

// 7. REPORTS - FILTER ASSETS
app.get('/api/reports', (req, res) => {
    let { startDate, endDate, department, user } = req.query;
    let query = 'SELECT * FROM asset_issues WHERE 1=1';
    const queryParams = [];
    if (startDate) { query += ' AND created_at >= ?'; queryParams.push(startDate); }
    if (endDate) {
        let nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query += ' AND created_at < ?';
        queryParams.push(nextDay.toISOString().split('T')[0]);
    }
    if (department) { query += ' AND department LIKE ?'; queryParams.push(`%${department}%`); }
    if (user) { query += ' AND (employee_name LIKE ? OR employee_code LIKE ?)'; queryParams.push(`%${user}%`, `%${user}%`); }
    query += ' ORDER BY created_at DESC';
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Report query error:', err);
            return res.status(500).json({ success: false, message: 'Failed to generate report.' });
        }
        res.json(results);
    });
});

// --- ASSET REGISTRATION ROUTES ---

// 8. REGISTER NEW ASSET
app.post('/api/register-asset', (req, res) => {
    const assetData = req.body;
    
    if (!assetData.asset_serial_no) {
        return res.status(400).json({ success: false, message: 'Asset Serial Number is required.' });
    }
    
    for (const key in assetData) {
        if (assetData[key] === '') {
            assetData[key] = null;
        }
    }

    const query = 'INSERT INTO registered_assets SET ?';
    db.query(query, assetData, (err, result) => {
        if (err) {
            console.error('Database insert error:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'An asset with this serial number is already registered.' });
            }
            return res.status(500).json({ success: false, message: 'Failed to register new asset.' });
        }
        res.status(201).json({ success: true, message: 'Asset registered successfully!', id: result.insertId });
    });
});

// 9. GET ALL REGISTERED ASSETS
app.get('/api/registered-assets', (req, res) => {
    const query = 'SELECT * FROM registered_assets ORDER BY registration_date DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch registered assets.' });
        }
        res.json(results);
    });
});

// 10. GET ASSET DETAILS BY EMPLOYEE
app.get('/api/asset-by-employee', (req, res) => {
    const { searchTerm } = req.query;
    if (!searchTerm) {
        return res.status(400).json({ success: false, message: 'Search term is required.' });
    }
    const query = 'SELECT * FROM asset_issues WHERE employee_name LIKE ? OR employee_code LIKE ? ORDER BY created_at DESC LIMIT 1';
    const searchPattern = `%${searchTerm}%`;

    db.query(query, [searchPattern, searchPattern], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Failed to search for asset.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'No issued asset found for this employee.' });
        }
        res.json({ success: true, data: results[0] });
    });
});

// 11. GET TRANSFER HISTORY
app.get('/api/transfer-history', (req, res) => {
    const query = 'SELECT * FROM transfer_history ORDER BY transfer_date DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch transfer history.' });
        }
        res.json(results);
    });
});


// 12. CORRECTED: TRANSFER ASSET
app.post('/api/transfer-asset', async (req, res) => {
    const { asset_issue_id, employee_name_from, employee_code_from, department_from, asset_type_from, asset_code_from, serial_number_from, reason, ...transferData } = req.body;

    if (!asset_issue_id || !transferData.employee_name_to || !transferData.employee_code_to) {
        return res.status(400).json({ success: false, message: 'Missing required fields for transfer.' });
    }

    let connection;
    try {
        // 1. Get a dedicated connection from the pool
        connection = await db.promise().getConnection();
        
        // 2. Start a transaction on that connection
        await connection.beginTransaction();

        const updateData = {
            employee_name: transferData.employee_name_to,
            employee_code: transferData.employee_code_to,
            department: transferData.department_to,
            designation: transferData.designation_to,
            location: transferData.location_to,
            phone_number: transferData.phone_number_to,
            email_id: transferData.email_id_to,
            hod_name: transferData.hod_name_to,
            operating_system: transferData.operating_system,
            printer_configured: transferData.printer_configured,
            ms_office_version: transferData.ms_office_version,
            windows_update: transferData.windows_update,
            licensed_software_name: transferData.licensed_software_name,
            local_admin_rights_removed: transferData.local_admin_rights_removed,
            antivirus: transferData.antivirus,
            local_admin_pass_set: transferData.local_admin_pass_set,
            sap_configured: transferData.sap_configured,
            backup_configured: transferData.backup_configured,
            seven_zip: transferData.seven_zip,
            chrome: transferData.chrome,
            onedrive_configured: transferData.onedrive_configured,
            laptop_bag: transferData.laptop_bag,
            rmm_agent: transferData.rmm_agent,
            cleaned: transferData.cleaned,
            physical_condition: transferData.physical_condition,
            asset_tag: transferData.asset_tag,
            previous_employee_code: employee_code_from,
            last_transfer_date: new Date()
        };

        const updateQuery = 'UPDATE asset_issues SET ? WHERE id = ?';
        // 3. Execute queries using the connection
        await connection.query(updateQuery, [updateData, asset_issue_id]);

        const historyData = {
            asset_issue_id: asset_issue_id,
            asset_code: asset_code_from,
            asset_type: asset_type_from,
            serial_number: serial_number_from,
            employee_name_from: employee_name_from,
            employee_code_from: employee_code_from,
            department_from: department_from,
            employee_name_to: transferData.employee_name_to,
            employee_code_to: transferData.employee_code_to,
            department_to: transferData.department_to,
            reason: reason || null
        };

        const historyQuery = 'INSERT INTO transfer_history SET ?';
        await connection.query(historyQuery, historyData);

        // 4. Commit the transaction on the connection
        await connection.commit();
        res.json({ success: true, message: 'Asset transferred successfully!' });

    } catch (err) {
        // 5. Rollback on the connection if an error occurs
        if (connection) await connection.rollback();
        console.error('Database transaction error during transfer:', err);
        res.status(500).json({ success: false, message: 'Failed to transfer asset.' });
    } finally {
        // 6. Always release the connection back to the pool
        if (connection) connection.release();
    }
});


// 13. DASHBOARD STATS ROUTE
app.get('/api/dashboard-stats', async (req, res) => {
    try {
        const dbPromise = db.promise();
        
        const issuedQuery = `
            SELECT 
                COALESCE(asset_type, 'Unknown') as device, 
                COALESCE(department, 'Unassigned') as department, 
                COUNT(*) as count
            FROM asset_issues 
            GROUP BY device, department;
        `;
        
        const availableQuery = `
            SELECT 
                COALESCE(ra.asset_make, 'Unknown') as device, 
                'IT Stock' as department, 
                COUNT(*) as count
            FROM registered_assets ra
            LEFT JOIN asset_issues ai ON ra.asset_serial_no = ai.serial_number
            WHERE ai.id IS NULL
            GROUP BY device;
        `;

        const [issuedResults] = await dbPromise.query(issuedQuery);
        const [availableResults] = await dbPromise.query(availableQuery);

        const combinedResults = [...issuedResults, ...availableResults];

        res.json(combinedResults);

    } catch (err) {
        console.error('Dashboard stats query error:', err);
        res.status(500).json({ success: false, message: 'Failed to generate dashboard statistics.' });
    }
});

// 14. ASSET DISTRIBUTION FOR PIE CHART
app.get('/api/asset-distribution', (req, res) => {
    const query = `
        SELECT 
            CASE 
                WHEN asset_type IN ('Laptop', 'Desktop', 'Laptop/Desktop') THEN 'Laptops/Desktops'
                WHEN asset_type = 'Data Card' THEN 'Data Cards'
                WHEN asset_type = 'Printer' THEN 'Printers'
                ELSE COALESCE(asset_type, 'Unknown Category') 
            END as category,
            COUNT(*) as count
        FROM asset_issues
        GROUP BY category
        ORDER BY count DESC;
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Asset distribution query error:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch asset distribution data.' });
        }
        res.json(results);
    });
});


// 15. GENERATE HANDOVER FORM (DOCX)
const nullGetter = (part, scope) => {
    if (part.value === 'undefined') { return ''; }
    if (scope[part.value] == null) { return ''; }
    return undefined;
};

app.post('/api/generate-handover-form', (req, res) => {
    try {
        const templatePath = path.resolve(__dirname, 'public', 'templates', 'Undertaking_IT_Asset_Handover_Form.docx');
        const content = fs.readFileSync(templatePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter });
        doc.setData(req.body);
        doc.render();
        const buf = doc.getZip().generate({ type: 'nodebuffer' });
        res.setHeader('Content-Disposition', `attachment; filename=Handover_Form_${req.body.employee_name || 'user'}.docx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buf);
    } catch (error) {
        console.error('DOCX generation error:', error);
        res.status(500).send('Error generating document');
    }
});


// --- SERVE FRONTEND ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/dashboard', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'dashboard.html')); });


// --- START SERVER ---
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});