// server.js - Backend for Greenfuel Asset Management

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const nodemailer = require('nodemailer');
const multer = require('multer'); // For handling file uploads

// --- Multer Setup for in-memory file storage ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();
const port = 3000;

// --- Nodemailer Transporter Setup ---
// IMPORTANT: For production, use environment variables for sensitive data.
const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com', // Correct host from your error logs
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: 'itadmin4@greenfuelenergy.in', // Your email address
        pass: 'Manesar@123',   // <-- REPLACE with your actual password or App Password
    },
});


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

const db = mysql.createPool(dbConfig);

db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        return;
    }
    console.log('Successfully connected to MySQL database.');
    connection.release();
});

// --- HELPER FUNCTION ---
const nullGetter = (part, scope) => {
    if (part.value === 'undefined') { return ''; }
    if (scope[part.value] == null) { return ''; }
    return undefined;
};

async function generateHandoverDocBuffer(data) {
    try {
        const templatePath = path.resolve(__dirname, 'public', 'templates', 'Undertaking_IT_Asset_Handover_Form.docx');
        const content = fs.readFileSync(templatePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter });
        
        // Use the updated .render() method to fix deprecation warning
        doc.render(data);

        return doc.getZip().generate({ type: 'nodebuffer' });
    } catch (error) {
        console.error('DOCX generation error:', error);
        throw new Error('Error generating document buffer');
    }
}


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
    
    // Fix for the database insert error by removing the empty ID
    delete newAsset.id;

    const query = 'INSERT INTO asset_issues SET ?';
    db.query(query, newAsset, (err, result) => {
        if (err) {
            console.error('Database insert error:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                 return res.status(409).json({ success: false, message: 'An asset with this serial number already exists.' });
            }
            return res.status(500).json({ success: false, message: 'Failed to create new asset issue.' });
        }
        
        // Return the newly created asset data so the frontend can switch to the preview view
        const createdAsset = { id: result.insertId, ...newAsset };
        res.status(201).json({ success: true, message: 'Asset issue created successfully!', data: createdAsset });
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

// 11A. GET ALL GARBAGE ASSETS
app.get('/api/garbage-assets', (req, res) => {
    const query = 'SELECT * FROM garbage_assets ORDER BY date_marked_as_garbage DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch garbage assets.' });
        }
        res.json(results);
    });
});

// 11B. ADD NEW GARBAGE ASSET
app.post('/api/garbage-assets', async (req, res) => {
    const assetData = req.body;
    if (!assetData.serial_number || !assetData.date_marked_as_garbage) {
        return res.status(400).json({ success: false, message: 'Serial Number and Date are required.' });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        await connection.query('INSERT INTO garbage_assets SET ?', assetData);
        await connection.query('DELETE FROM asset_issues WHERE serial_number = ?', [assetData.serial_number]);
        await connection.query('DELETE FROM registered_assets WHERE asset_serial_no = ?', [assetData.serial_number]);

        await connection.commit();
        res.status(201).json({ success: true, message: 'Asset successfully moved to garbage and removed from inventory.' });

    } catch (err) {
        if (connection) await connection.rollback();
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'This serial number has already been marked as garbage.' });
        }
        console.error('Database transaction error:', err);
        res.status(500).json({ success: false, message: 'Failed to move asset to garbage.' });
    } finally {
        if (connection) connection.release();
    }
});

// 12. TRANSFER ASSET
app.post('/api/transfer-asset', async (req, res) => {
    const { asset_issue_id, employee_name_from, employee_code_from, department_from, division_from, asset_type_from, asset_code_from, serial_number_from, reason, ...transferData } = req.body;

    if (!asset_issue_id || !transferData.employee_name_to || !transferData.employee_code_to) {
        return res.status(400).json({ success: false, message: 'Missing required fields for transfer.' });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const updateData = {
            employee_name: transferData.employee_name_to,
            employee_code: transferData.employee_code_to,
            department: transferData.department_to,
            division: transferData.division_to,
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
        await connection.query(updateQuery, [updateData, asset_issue_id]);

        const historyData = {
            asset_issue_id: asset_issue_id,
            asset_code: asset_code_from,
            asset_type: asset_type_from,
            serial_number: serial_number_from,
            employee_name_from: employee_name_from,
            employee_code_from: employee_code_from,
            department_from: department_from,
            division_from: division_from,
            employee_name_to: transferData.employee_name_to,
            employee_code_to: transferData.employee_code_to,
            department_to: transferData.department_to,
            division_to: transferData.division_to,
            reason: reason || null
        };

        const historyQuery = 'INSERT INTO transfer_history SET ?';
        await connection.query(historyQuery, historyData);

        await connection.commit();
        res.json({ success: true, message: 'Asset transferred successfully!' });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Database transaction error during transfer:', err);
        res.status(500).json({ success: false, message: 'Failed to transfer asset.' });
    } finally {
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

        const [issuedResults] = await dbPromise.query(availableQuery);
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

// 14A. VALIDATE SERIAL NUMBER
app.get('/api/validate-serial/:serialNumber', (req, res) => {
    const { serialNumber } = req.params;
    if (!serialNumber) {
        return res.status(400).json({ isValid: false, message: 'Serial number is required.' });
    }

    const garbageQuery = 'SELECT id FROM garbage_assets WHERE serial_number = ?';
    db.query(garbageQuery, [serialNumber], (garbageErr, garbageResults) => {
        if (garbageErr) {
            return res.status(500).json({ isValid: false, message: 'Internal server error.' });
        }
        if (garbageResults.length > 0) {
            return res.status(404).json({ isValid: false, message: 'Asset is in garbage and cannot be issued.' });
        }

        const registerQuery = 'SELECT asset_make, asset_model FROM registered_assets WHERE asset_serial_no = ?';
        db.query(registerQuery, [serialNumber], (err, results) => {
            if (err) {
                return res.status(500).json({ isValid: false, message: 'Internal server error.' });
            }
            if (results.length === 0) {
                return res.status(404).json({ isValid: false, message: 'Invalid Serial Number — Not Registered' });
            }

            const issuedQuery = 'SELECT id FROM asset_issues WHERE serial_number = ?';
            db.query(issuedQuery, [serialNumber], (issueErr, issueResults) => {
                if (issueErr) {
                    return res.status(500).json({ isValid: false, message: 'Internal server error.' });
                }
                if (issueResults.length > 0) {
                    res.status(409).json({ isValid: false, message: 'Asset is already issued.', assetDetails: results[0] });
                } else {
                    res.json({ isValid: true, message: 'Serial number is valid and available.', assetDetails: results[0] });
                }
            });
        });
    });
});


// 15. GENERATE HANDOVER FORM
app.post('/api/generate-handover-form', async (req, res) => {
    try {
        const buf = await generateHandoverDocBuffer(req.body);
        res.setHeader('Content-Disposition', `attachment; filename=Handover_Form_${req.body.employee_name || 'user'}.docx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buf);
    } catch (error) {
        console.error('DOCX generation error:', error);
        res.status(500).send('Error generating document');
    }
});

// 16. SEND WELCOME EMAIL MANUALLY
app.post('/api/send-welcome-email', upload.single('attachment'), (req, res) => {
    const { assetIssueId } = req.body;

    if (!assetIssueId) {
        return res.status(400).json({ success: false, message: 'Asset Issue ID is required.' });
    }

    const query = 'SELECT * FROM asset_issues WHERE id = ?';
    db.query(query, [assetIssueId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ success: false, message: 'Asset issue not found.' });
        }

        const assetData = results[0];
        const mailOptions = {
            from: '"Greenfuel IT Admin" <itadmin@greenfuelenergy.in>',
            to: assetData.email_id,
            subject: 'Welcome to Greenfuel – Your IT Asset Details',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <img src="cid:greenfuelLogo" alt="Greenfuel Energy Logo" style="width: 180px; margin-bottom: 25px;" />
                    <h2>Welcome to Greenfuel, ${assetData.employee_name}!</h2>
                    <p>This email confirms the issuance of your new IT asset. Please find the details below:</p>
                    <ul style="list-style-type: none; padding: 0;">
                        <li style="margin-bottom: 8px;"><strong>Asset Type/Model:</strong> ${assetData.make_model || 'N/A'}</li>
                        <li style="margin-bottom: 8px;"><strong>Serial Number:</strong> ${assetData.serial_number}</li>
                        <li style="margin-bottom: 8px;"><strong>Your Official Email ID:</strong> ${assetData.email_id}</li>
                    </ul>
                    <p>If you have any questions, please contact the IT department.</p>
                    <p>Best regards,<br>Greenfuel IT Team</p>
                </div>
            `,
            attachments: [
                {
                    filename: 'logo.png',
                    path: path.join(__dirname, 'public', 'assets', 'logo.png'),
                    cid: 'greenfuelLogo'
                }
            ]
        };

        if (req.file) {
            mailOptions.attachments.push({
                filename: req.file.originalname,
                content: req.file.buffer,
                contentType: req.file.mimetype,
            });
        }

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Manual email sending error:', error);
                return res.status(500).json({ success: false, message: 'Failed to send email.' });
            }
            console.log('Manual email sent successfully to ' + assetData.email_id + ': ' + info.response);
            res.json({ success: true, message: 'Welcome email sent successfully!' });
        });
    });
});

// --- SERVE FRONTEND ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/dashboard', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'dashboard.html')); });


// --- START SERVER ---
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});