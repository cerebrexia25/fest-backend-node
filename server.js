require('dotenv').config();
const express = require('express');
const path = require('path');
const Razorpay = require('razorpay');
const qrcode = require('qrcode');
const nodemailer = require('nodemailer');
const crypto =require('crypto');
const fs = require('fs');
const cors = require('cors');
const admin = require('firebase-admin');

// --- UPDATED FIREBASE INITIALIZATION ---
// Path jahan Cloud Run secret ko mount karega (gcloud deploy command ke anusaar)
const GCLOUD_SECRET_PATH = '/path/to/firebase-key.json';
// Aapke local development ke liye path
const LOCAL_KEY_PATH = './firebase-service-account-key.json';

let serviceAccount;

try {
    // Sabse pehle Cloud Run waale path ko check karein
    if (fs.existsSync(GCLOUD_SECRET_PATH)) {
        console.log('Firebase Admin: Initializing with service account from Cloud Run secret.');
        serviceAccount = JSON.parse(fs.readFileSync(GCLOUD_SECRET_PATH, 'utf8'));
    }
    // Agar woh nahi mila, to local path check karein (development ke liye)
    else if (fs.existsSync(LOCAL_KEY_PATH)) {
        console.log('Firebase Admin: Initializing with local service account file.');
        serviceAccount = require(LOCAL_KEY_PATH);
    }
    // Agar dono hi nahi mile, to error dekar exit karein
    else {
        throw new Error('Firebase service account key not found. Ensure it is mounted as a secret in Cloud Run or available locally.');
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'cerebrexia-ee068' // Ensure this is your correct Project ID
    });

    console.log('Successfully connected to Firebase Admin!');

} catch (error) {
    console.error("Fatal Error initializing Firebase Admin. Check credentials and permissions:", error.message);
    process.exit(1);
}
// --- END OF FIREBASE INITIALIZATION ---


const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // CORS middleware added for frontend access

app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
    next();
});

// --- STATIC FILE SERVING ---
app.use(express.static(path.join(__dirname, 'public')));


const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_SENDER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

const HEAD_COORDINATOR_EMAIL = process.env.HEAD_COORDINATOR_EMAIL || 'thecerebrexia17@gmail.com';
const FEST_CONTACT_EMAIL = process.env.FEST_CONTACT_EMAIL || 'info@cerebrexia25.com';
const FEST_CONTACT_PHONE = process.env.FEST_CONTACT_PHONE || '+919079956283';
const FEST_INSTAGRAM_URL = process.env.FEST_INSTAGRAM_URL || 'https://instagram.com/igimsfest';
const FEST_WHATSAPP_CHANNEL_URL = process.env.FEST_WHATSAPP_CHANNEL_URL || 'https://whatsapp.com/channel/0029VbA0P20HbFV2ke5rlR2G';

function generateUniqueMemberId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Generate a simple, sequential pass number for entry
async function generatePassNumber() {
    const passRef = db.collection('settings').doc('passCounters');
    // Use a transaction to ensure atomic increment for pass number
    const newPassNumber = await db.runTransaction(async (transaction) => {
        const passDoc = await transaction.get(passRef);
        let currentNumber = 1000; // Starting pass number
        if (passDoc.exists && passDoc.data().lastPassNumber) {
            currentNumber = passDoc.data().lastPassNumber + 1;
        }
        transaction.set(passRef, { lastPassNumber: currentNumber }, { merge: true });
        return `FP${currentNumber}`;
    });
    return newPassNumber;
}

async function sendFestEmail(mailOptions) {
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${mailOptions.to}`);
    } catch (emailError) {
        console.error(`Failed to send email to ${mailOptions.to}:`, emailError);
        // Do not throw error here, to allow API response even if email fails
    }
}

console.log("DEBUG ENV VARS CHECK:");
console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID);
console.log("RAZORPAY_KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET ? "SET" : "NOT SET"); // Hide sensitive info
console.log("EMAIL_SENDER:", process.env.EMAIL_SENDER);
console.log("EMAIL_PASSWORD (first 3 chars):", process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.substring(0, 3) + '...' : 'UNDEFINED');
console.log("HEAD_COORDINATOR_EMAIL:", process.env.HEAD_COORDINATOR_EMAIL);

// --- UPDATED EMAIL TEMPLATE STYLES AND STRUCTURES ---
function getEmailStyles() {
    // Note: Email clients have limited CSS support. Inline styles are safer.
    // This style block will primarily apply to outer containers and general text.
    return `
        /* General Body and Container Styles */
        body { margin: 0; padding: 0; background-color: #0a0e1a; font-family: 'Kanit', Arial, sans-serif; color: #e8e8e8; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; width: 100% !important; }
        .container { 
            width: 100%; max-width: 680px; margin: 20px auto; 
            background-color: #100018; /* Dark purple/black */
            border: 1px solid #ff00ff; /* Neon pink border */
            border-radius: 15px; overflow: hidden; 
            box-shadow: 0 5px 25px rgba(255,0,255,0.35); /* Stronger neon pink glow */
            -webkit-font-smoothing: antialiased;
            box-sizing: border-box; /* Added for consistent sizing */
        }

        /* Header Section */
        .header { 
            background: linear-gradient(135deg, #58077d 0%, #8A2BE2 70%, #c77dff 100%); /* Purple to blue gradient */
            padding: 30px 20px; text-align: center; 
            border-bottom: 3px solid #00ffff; /* Neon cyan border */
            color: #ffffff; 
            position: relative;
            box-shadow: inset 0 -3px 10px rgba(0,255,255,0.4);
        }
        .header .logo-text { 
            margin: 0; 
            color: #f9d71c; /* Gold color */
            font-family: 'Exo', 'Orbitron', sans-serif; 
            font-size: 3.2em; font-weight: 900; 
            text-shadow: 0 0 10px rgba(249,215,28,0.8), 0 0 20px rgba(249,215,28,0.6); /* Gold glow */
            letter-spacing: 2px;
            line-height: 1.1;
        }
        .header .subtitle { 
            margin: 10px 0 0; 
            color: #e0e0e0; 
            font-size: 1.25em; 
            font-weight: 400;
            text-shadow: 0 0 5px rgba(255,255,255,0.4);
        }
        .header .slogan {
            font-family: 'Share Tech Mono', monospace; /* Techy font */
            font-size: 0.9em;
            color: #00ffff;
            margin-top: 15px;
            letter-spacing: 0.5px;
            text-shadow: 0 0 8px rgba(0,255,255,0.6);
        }

        /* Content Section */
        .content { 
            padding: 25px 35px; line-height: 1.7; font-size: 1.05em; color: #d8d8d8; 
            text-align: left; /* Ensure text alignment */
        }
        .content h3 { 
            color: #ff99ff; /* Light pink/purple */
            font-family: 'Exo', sans-serif; 
            margin-top: 25px; margin-bottom: 12px; 
            border-bottom: 2px solid rgba(255,102,255,0.5); /* Matching border */
            padding-bottom: 10px; font-size: 1.6em; /* Slightly larger headers */
            font-weight: 700;
            text-shadow: 0 0 8px rgba(255,153,255,0.5);
        }
       
        /* New styling for detail rows (replaces old table structure) */
        .detail-row {
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(204, 153, 255, 0.15); /* Softer dashed line */
            word-wrap: break-word; /* Ensure long words break */
            overflow-wrap: break-word; /* Alternative for word-wrap */
        }
        .detail-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        .detail-label {
            font-weight: 600; 
            color: #00ffff; /* Neon cyan for labels */
            font-size: 0.95em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: block; /* Make label stack on top of value */
            margin-bottom: 5px;
        }
        .detail-value {
            font-size: 1em;
            color: #d8d8d8;
            display: block; /* Make value stack below label */
        }

        /* Important Messages */
        .important { 
            color: #ff6b6b; /* Reddish */
            font-weight: 700; margin-top: 25px; padding: 15px 20px; 
            background: rgba(255,107,107,0.1); /* Soft red background */
            border-left: 5px solid #ff6b6b; /* Stronger red bar */
            border-radius: 8px; /* Rounded corners */
            box-shadow: 0 0 10px rgba(255,107,107,0.3);
        }

        /* QR Code Section */
        .qr-code-section { 
            text-align: center; margin: 25px 0; padding: 10px; 
            background: rgba(255,255,255,0.08); /* Slightly more prominent QR background */
            border-radius: 12px; 
            box-shadow: 0 0 20px rgba(0,255,255,0.5); /* Cyan glow around QR section */
            padding-bottom: 20px; /* More padding at bottom */
        }
        .qr-code-section h3 {
            color: #00ffff; /* Neon cyan */
            font-family: 'Exo', sans-serif;
            font-size: 1.5em;
            margin-bottom: 15px;
            text-shadow: 0 0 8px rgba(0,255,255,0.6);
            border-bottom: none; padding-bottom: 0; /* Override default h3 border */
        }
        .qr-codes-grid {
            /* This is a flexbox/grid like arrangement for responsive multi-QR display */
            /* Using inline-block for better email client compatibility */
            font-size: 0; /* To collapse whitespace between inline-block elements */
            text-align: center;
            max-width: 600px;
            margin: 0 auto;
        }
        .qr-codes-grid .qr-item {
            display: inline-block; /* Essential for responsive grid-like behavior */
            width: 48%; /* Roughly half width, allowing some gap */
            max-width: 200px; /* Max width for larger screens */
            vertical-align: top;
            margin: 1%; /* For spacing between items */
            padding: 15px; 
            background-color: rgba(255,255,255,0.08); 
            border-radius: 10px;
            text-align: center;
            border: 1px solid rgba(0,255,255,0.3);
            box-shadow: 0 0 12px rgba(0,255,255,0.3); 
            transition: transform 0.2s ease;
            box-sizing: border-box; /* Include padding and border in width */
        }
        .qr-codes-grid .qr-item:hover { transform: translateY(-5px); box-shadow: 0 0 18px rgba(0,255,255,0.5); }
        .qr-codes-grid .qr-item img {
            max-width: 100px; 
            height: auto;
            border: 3px solid #ff00ff; 
            padding: 5px;
            background: white;
            border-radius: 8px; 
            margin-bottom: 10px;
            display: block; /* Center image */
            margin-left: auto;
            margin-right: auto;
        }
        .qr-codes-grid .qr-item p {
            margin: 0;
            font-size: 0.95em;
            color: #fff;
            font-weight: 600;
            line-height: 1.3;
            word-wrap: break-word; /* For long names */
        }
        .qr-codes-grid .qr-item .member-id {
            font-size: 0.75em;
            color: #888;
            word-break: break-all;
            margin-top: 5px;
        }

        /* Footer Section */
        .footer { 
            background-color: #0a0012; 
            color: #a0a0a0; padding: 25px 20px; text-align: center; font-size: 0.95em; 
            border-top: 2px solid #ff00ff; 
            box-shadow: inset 0 3px 10px rgba(255,0,255,0.2);
        }
        .footer p { margin: 8px 0; }
        .footer a { color: #00ffff; text-decoration: none; font-weight: 500; transition: color 0.3s ease; } 
        .footer a:hover { color: #ff00ff; } 
        .social-icons { margin-top: 15px; }
        .social-icons a { margin: 0 12px; display: inline-block; transition: transform 0.2s ease; }
        .social-icons a:hover { transform: scale(1.1); }
        .social-icons img { width: 32px; height: 32px; border-radius: 50%; vertical-align: middle; } 

        /* Responsive adjustments (specific for email clients) */
        @media only screen and (max-width: 480px) { /* Adjusted breakpoint for mobile email */
            .container { margin: 10px; border-radius: 10px; }
            .header { padding: 20px 15px; }
            .header .logo-text { font-size: 2em; }
            .header .subtitle { font-size: 1em; }
            .content { padding: 15px 20px; font-size: 0.95em; }
            .content h3 { font-size: 1.3em; }
            .detail-row { margin-bottom: 10px; padding-bottom: 8px; }
            .detail-label { font-size: 0.9em; margin-bottom: 3px; }
            .detail-value { font-size: 0.95em; }
            .qr-codes-grid .qr-item {
                width: 96%; /* Stack QRs on very small screens */
                margin: 2% auto;
                max-width: none; /* Remove max-width on tiny screens */
            }
            .qr-codes-grid .qr-item img { max-width: 90px; }
            .qr-codes-grid .qr-item p { font-size: 0.9em; }
            .footer { padding: 15px 10px; font-size: 0.8em; }
            .social-icons img { width: 26px; height: 26px; }
        }
    `;
}

// All your email generation functions go here... (code hidden for brevity)
// function generateBaseEmailHTML(...) { ... }
// function generateUserFestPassEmail(...) { ... }
// etc...

// --- API ROUTES ---
// All your API routes go here... (code hidden for brevity)
// app.post('/api/register', ...) { ... }
// app.post('/api/register-event', ...) { ... }
// etc...

// --- SERVER LISTEN ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    if (process.env.RAZORPAY_KEY_ID && process.env.EMAIL_SENDER && serviceAccount) {
        console.log("All critical environment variables seem to be loaded.");
    } else {
        console.warn("WARNING: Some critical environment variables are missing. Payments, emails, or Firebase might not work correctly.");
    }
});


function generateBaseEmailHTML(title, headerSubtitle, contentHTML) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Exo:wght@400;700;900&family=Kanit:wght@300;400;500;600;700&family=Orbitron:wght@700&family=Share+Tech+Mono&display=swap" rel="stylesheet" type="text/css">
    <style>${getEmailStyles()}</style>
</head>
<body>
    <div class="container" style="width:100%; max-width:680px; margin:20px auto; background-color:#100018; border:1px solid #ff00ff; border-radius:15px; overflow:hidden; box-shadow:0 5px 25px rgba(255,0,255,0.35); box-sizing:border-box;">
        <div class="header" style="background:linear-gradient(135deg, #58077d 0%, #8A2BE2 70%, #c77dff 100%); padding:30px 20px; text-align:center; border-bottom:3px solid #00ffff; color:#ffffff; box-shadow:inset 0 -3px 10px rgba(0,255,255,0.4);">
            <h1 class="logo-text" style="margin:0; color:#f9d71c; font-family:'Exo','Orbitron',sans-serif; font-size:3.2em; font-weight:900; text-shadow:0 0 10px rgba(249,215,28,0.8), 0 0 20px rgba(249,215,28,0.6); letter-spacing:2px; line-height:1.1;">CEREBREXIA'25</h1>
            <p class="subtitle" style="margin:10px 0 0; color:#e0e0e0; font-size:1.25em; font-weight:400; text-shadow:0 0 5px rgba(255,255,255,0.4);"> ${headerSubtitle}</p>
            <p class="slogan" style="font-family:'Share Tech Mono',monospace; font-size:0.9em; color:#00ffff; margin-top:15px; letter-spacing:0.5px; text-shadow:0 0 8px rgba(0,255,255,0.6);">Connect. Collaborate. Create. The Future of Healthcare.</p>
        </div>
        <div class="content" style="padding:25px 35px; line-height:1.7; font-size:1.05em; color:#d8d8d8; text-align:left;">
            ${contentHTML}
        </div>
        <div class="footer" style="background-color:#0a0012; color:#a0a0a0; padding:25px 20px; text-align:center; font-size:0.95em; border-top:2px solid #ff00ff; box-shadow:inset 0 3px 10px rgba(255,0,255,0.2);">
            <p class="social-icons" style="margin-top:15px;">
                <a href="${FEST_INSTAGRAM_URL}" title="Instagram" style="margin:0 12px; display:inline-block;"><img src="https://i.imgur.com/s4qPmxE.png" alt="Instagram" style="width:32px; height:32px; border-radius:50%; vertical-align:middle;"></a>
                <a href="${FEST_WHATSAPP_CHANNEL_URL}" title="WhatsApp" style="margin:0 12px; display:inline-block;"><img src="https://i.imgur.com/WA0o3yT.png" alt="WhatsApp" style="width:32px; height:32px; border-radius:50%; vertical-align:middle;"></a>
            </p>
            <p style="margin:8px 0;">Contact: <a href="mailto:${FEST_CONTACT_EMAIL}" style="color: #00ffff; text-decoration: none; font-weight: 500;">${FEST_CONTACT_EMAIL}</a> | ${FEST_CONTACT_PHONE}</p>
            <p style="margin:8px 0;">&copy; ${new Date().getFullYear()} CEREBREXIA'25 - IGIMS Patna</p>
        </div>
    </div>
</body>
</html>`;
}

function generateUserFestPassEmail(details, qrCodesToDisplay = []) {
    let qrCodeSection = '';
    if (qrCodesToDisplay && qrCodesToDisplay.length > 0) {
        if (qrCodesToDisplay.length === 1) {
            const qrInfo = qrCodesToDisplay[0];
            qrCodeSection = `
                <div class="qr-code-section" style="padding: 20px; margin: 25px auto; background-color: rgba(255,255,255,0.08); border-radius: 12px; box-shadow: 0 0 20px rgba(0,255,255,0.5); text-align: center;">
                    <h3 style="color:#00ffff; font-family:'Exo',sans-serif; font-size:1.5em; margin-bottom:15px; text-shadow:0 0 8px rgba(0,255,255,0.6); border-bottom:none; padding-bottom:0;">Your Entry QR Code</h3>
                    <img src="cid:festpass_qr_code_0" alt="${qrInfo.name} QR Code" style="max-width:150px; height:auto; border:3px solid #ff00ff; padding:5px; background:white; border-radius:8px; margin-bottom:10px; display:block; margin-left:auto; margin-right:auto;"/>
                    <p style="font-size:0.95em; color:#fff; font-weight:600; line-height:1.3; margin:0; word-wrap:break-word;">${qrInfo.name}${qrInfo.isLeader ? ' (Leader)' : ''}</p>
                    <p style="font-size:0.75em; color:#888; word-break:break-all; margin-top:5px;">ID: ${qrInfo.memberId}</p>
                </div>
            `;
        } else {
            // For multiple QRs (group registrations)
            let qrItemsHtml = '';
            qrCodesToDisplay.forEach((qrInfo, index) => {
                qrItemsHtml += `
                    <div class="qr-item" style="display:inline-block; width:48%; max-width:200px; vertical-align:top; margin:1%; padding:15px; background-color:rgba(255,255,255,0.08); border-radius:10px; text-align:center; border:1px solid rgba(0,255,255,0.3); box-shadow:0 0 12px rgba(0,255,255,0.3); box-sizing:border-box;">
                        <img src="cid:festpass_qr_code_${index}" alt="${qrInfo.name} QR Code" style="max-width:100px; height:auto; border:3px solid #ff00ff; padding:5px; background:white; border-radius:8px; margin-bottom:10px; display:block; margin-left:auto; margin-right:auto;"/>
                        <p style="font-size:0.95em; color:#fff; font-weight:600; line-height:1.3; margin:0; word-wrap:break-word;">${qrInfo.name}${qrInfo.isLeader ? ' (Leader)' : ''}</p>
                        <p style="font-size:0.75em; color:#888; word-break:break-all; margin-top:5px;">ID: ${qrInfo.memberId}</p>
                    </div>
                `;
            });
            qrCodeSection = `
                <div class="qr-code-section" style="padding: 20px; margin: 25px auto; background-color: rgba(255,255,255,0.08); border-radius: 12px; box-shadow: 0 0 20px rgba(0,255,255,0.5); text-align: center;">
                    <h3 style="color:#00ffff; font-family:'Exo',sans-serif; font-size:1.5em; margin-bottom:15px; text-shadow:0 0 8px rgba(0,255,255,0.6); border-bottom:none; padding-bottom:0;">Your Entry QR Codes:</h3>
                    <div class="qr-codes-grid" style="font-size:0; text-align:center; max-width:600px; margin:0 auto; display:block;"> ${qrItemsHtml}
                    </div>
                </div>
            `;
        }
    }

    const detailsHTML = `
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Registration ID:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.id}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Leader Name:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.name}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">College:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.college}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Enrollment Type:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.enrollmentType === 'group' ? `Group (${details.numMembers} members)` : 'Individual'}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Fee Paid:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">₹${details.amount}</p>
        </div>
        <div class="detail-row" style="margin-bottom:0; padding-bottom:0; border-bottom:none; word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Payment ID:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.razorpay_payment_id || 'N/A'}</p>
        </div>
    `;

    const contentHTML = `
        <p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">Dear ${details.name},</p>
        <p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">Your registration for <strong>CEREBREXIA'25 Fest Pass</strong> is confirmed! Your payment was successful.</p>
        <p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">Please save these QR codes and have them ready for scanning at the venue. Each QR is unique for the respective member.</p>
        ${qrCodeSection}
        <h3 style="color:#ff99ff; font-family:'Exo',sans-serif; margin-top:25px; margin-bottom:12px; border-bottom:2px solid rgba(255,102,255,0.5); padding-bottom:10px; font-size:1.6em; font-weight:700; text-shadow:0 0 8px rgba(255,153,255,0.5);">Your Fest Pass Details:</h3>
        <div class="details-section" style="background-color:rgba(255,255,255,0.05); border-radius:8px; padding:15px;">
            ${detailsHTML}
        </div>
        <p class="important" style="color:#ff6b6b; font-weight:700; margin-top:25px; padding:15px 20px; background:rgba(255,107,107,0.1); border-left:5px solid #ff6b6b; border-radius:8px; box-shadow:0 0 10px rgba(255,107,107,0.3);">IMPORTANT: Each attendee must bring their unique QR code (digital or printed) and a valid College/Govt. ID proof for entry.</p>
        <p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">We look forward to seeing you at CEREBREXIA'25!</p>`;
    return generateBaseEmailHTML("CEREBREXIA'25 Fest Pass Confirmed", "Your Fest Pass is Ready!", contentHTML);
}

function generateAdminFestPassEmail(details, qrCodesForGroup = []) {
    let groupMembersHtml = '';
    if (details.enrollmentType === 'group' && details.groupMembers && details.groupMembers.length > 0) {
        groupMembersHtml += '<h4 style="color:#ff99ff; font-family:\'Exo\',sans-serif; margin-top:25px; margin-bottom:12px; font-size:1.4em; font-weight:700; text-shadow:0 0 8px rgba(255,153,255,0.5);">Group Members:</h4><ul style="list-style-type:none; padding-left:0; margin:0;">';
        details.groupMembers.forEach(member => {
            groupMembersHtml += `<li style="margin-bottom:8px; line-height:1.5; color:#d8d8d8; word-wrap:break-word; overflow-wrap:break-word;"><strong>${member.name}</strong> (${member.email}) - College: ${member.college} - Phone: ${member.phone_number || 'N/A'} - Member ID: ${member.memberId}</li>`;
        });
        groupMembersHtml += '</ul>';
    }

    const qrCodeListHtml = qrCodesForGroup.map((qrInfo, index) => `<li style="margin-bottom:5px; line-height:1.5; color:#d8d8d8; word-wrap:break-word; overflow-wrap:break-word;"><strong>${qrInfo.name}</strong> (${qrInfo.isLeader ? 'Leader' : 'Member'}): Member ID: ${qrInfo.memberId} - QR Code URL available in email attachments (CID: festpass_qr_code_admin_${index})</li>`).join('');

    const detailsHTML = `
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Registration ID:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.id}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Leader Name:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.name}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Email:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.email}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Phone:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.phone_number}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">College:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.college}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Enrollment Type:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.enrollmentType} (${details.numMembers} members)</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Coupon:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.couponCode || 'None'}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Amount:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">₹${details.amount}</p>
        </div>
        <div class="detail-row" style="margin-bottom:0; padding-bottom:0; border-bottom:none; word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Payment ID:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.razorpay_payment_id || 'N/A'}</p>
        </div>
        <div class="detail-row" style="margin-bottom:0; padding-bottom:0; border-bottom:none; word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Leader Member ID:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.leaderMemberId}</p>
        </div>
    `;

    const contentHTML = `<p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">A new Fest Pass registration has been confirmed and paid for:</p>
    <h3 style="color:#ff99ff; font-family:'Exo',sans-serif; margin-top:25px; margin-bottom:12px; border-bottom:2px solid rgba(255,102,255,0.5); padding-bottom:10px; font-size:1.6em; font-weight:700; text-shadow:0 0 8px rgba(255,153,255,0.5);">Participant Details:</h3>
    <div class="details-section" style="background-color:rgba(255,255,255,0.05); border-radius:8px; padding:15px;">
        ${detailsHTML}
    </div>
    ${groupMembersHtml}
    <h4 style="color:#ff99ff; font-family:'Exo',sans-serif; margin-top:25px; margin-bottom:12px; font-size:1.4em; font-weight:700; text-shadow:0 0 8px rgba(255,153,255,0.5);">Generated QR Codes:</h4>
    <ul style="list-style-type:none; padding-left:0; margin:0;">${qrCodeListHtml}</ul>
    `;
    return generateBaseEmailHTML("New Fest Pass Registration", "New Fest Pass - Payment Confirmed", contentHTML);
}

function generateUserEventEmail(details) {
    const detailsHTML = `
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Event Name:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.eventName}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Registration ID:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.id}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Name:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.userName}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Email:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.userEmail}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">College:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.userCollege}</p>
        </div>
        <div class="detail-row" style="margin-bottom:0; padding-bottom:0; border-bottom:none; word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Fee Paid:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.amount > 0 ? `₹${details.amount}`: 'Free'}</p>
        </div>
        ${details.amount > 0 ? `
        <div class="detail-row" style="margin-bottom:0; padding-bottom:0; border-bottom:none; word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Payment ID:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.razorpay_payment_id || 'N/A'}</p>
        </div>` : ''}
    `;
    const contentHTML = `
        <p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">Dear ${details.userName},</p>
        <p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">Your registration for the event <strong>${details.eventName}</strong> is confirmed!</p>
        <h3 style="color:#ff99ff; font-family:'Exo',sans-serif; margin-top:25px; margin-bottom:12px; border-bottom:2px solid rgba(255,102,255,0.5); padding-bottom:10px; font-size:1.6em; font-weight:700; text-shadow:0 0 8px rgba(255,153,255,0.5);">Registration Details:</h3>
        <div class="details-section" style="background-color:rgba(255,255,255,0.05); border-radius:8px; padding:15px;">
            ${detailsHTML}
        </div>
        <p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">Please check the event page on our website for rules and schedule. We are thrilled to have you participate!</p>`;
    return generateBaseEmailHTML(`Event Entry Confirmed: ${details.eventName}`, "Event Registration Confirmed!", contentHTML);
}

function generateAdminEventEmail(details) {
    const detailsHTML = `
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Event:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.eventName}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Reg ID:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.id}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Name:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.userName}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Email:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.userEmail}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Phone:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.userPhone || 'N/A'}</p>
        </div>
        <div class="detail-row" style="margin-bottom:0; padding-bottom:0; border-bottom:none; word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">College:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.userCollege || 'N/A'}</p>
        </div>
        ${details.amount > 0 ? `
        <div class="detail-row" style="margin-bottom:0; padding-bottom:0; border-bottom:none; word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Payment ID:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.razorpay_payment_id || 'N/A'}</p>
        </div>` : ''}
    `;
    const contentHTML = `<p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">A new registration for <strong>${details.eventName}</strong> has been confirmed.</p>
    <p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;"><strong>Status: ${details.paymentStatus.toUpperCase()} ${details.amount > 0 ? `(Paid ₹${details.amount})` : '(Free Entry)'}</strong></p>
    <h3 style="color:#ff99ff; font-family:'Exo',sans-serif; margin-top:25px; margin-bottom:12px; border-bottom:2px solid rgba(255,102,255,0.5); padding-bottom:10px; font-size:1.6em; font-weight:700; text-shadow:0 0 8px rgba(255,153,255,0.5);">Participant Details:</h3>
    <div class="details-section" style="background-color:rgba(255,255,255,0.05); border-radius:8px; padding:15px;">
        ${detailsHTML}
    </div>`;
    return generateBaseEmailHTML(`New Entry: ${details.eventName}`, `New ${details.eventName} Entry`, contentHTML);
}

app.post('/api/register', async (req, res) => {
    console.log('****** HITTING THE /API/REGISTER ROUTE! (Fest Pass Registration) ******');
    console.log('Request Body:', req.body);

    console.log('Checkpoint 1: Body parsed. Starting validation.');

    const { userId, name, email, phone_number, college, enrollmentType, numMembers, groupMembers, couponCode, amount, eventName } = req.body;
    if (!userId || !name || !email || !phone_number || !college || amount === undefined) {
        console.log('Validation Failed: Missing required fields.');
        return res.status(400).json({ message: 'Missing required registration fields.' });
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) {
        console.log('Validation Failed: Invalid amount.');
        return res.status(400).json({ message: 'Invalid registration amount.' });
    }

    console.log('Checkpoint 2: Validation passed. Starting Firestore operations.');

    try {
        const festRegsRef = db.collection('festRegistrations');
        const existingRegQuery = await festRegsRef.where('userId', '==', userId).where('paymentStatus', '==', 'completed').limit(1).get();
        if (!existingRegQuery.empty) {
            console.log('Existing Fest Pass registration found for this user.');
            return res.status(409).json({ message: 'You have already successfully registered for the Fest Pass.' });
        }

        console.log('Checkpoint 3: No existing registration. Processing group members.');

        const processedGroupMembers = [];
        if (enrollmentType === 'group' && groupMembers && groupMembers.length > 0) {
            groupMembers.forEach(member => {
                processedGroupMembers.push({
                    name: member.name,
                    email: member.email,
                    memberId: generateUniqueMemberId(),
                    college: college, // Group members share the leader's college
                    phone_number: member.phone_number
                });
            });
        }

        console.log('Checkpoint 4: Group members processed. Preparing registration data.');

        const registrationData = {
            userId,
            name,
            email,
            phone_number,
            college,
            enrollmentType,
            numMembers,
            groupMembers: processedGroupMembers,
            couponCode,
            amount: numericAmount,
            eventName, // Note: For fest pass, eventName might be generic like 'Fest Pass'
            paymentStatus: 'pending',
            registeredAt: admin.firestore.FieldValue.serverTimestamp(),
            leaderMemberId: userId
        };

        console.log('Checkpoint 5: Registration data prepared. Adding to Firestore.');

        const regDocRef = await db.collection('festRegistrations').add(registrationData);
        const dbRegistrationId = regDocRef.id;

        console.log(`Checkpoint 6: Document added to Firestore. ID: ${dbRegistrationId}.`);

        if (numericAmount <= 0) {
            console.log('Handling free fest pass registration.');

            const allAttendees = [{
                name: name,
                email: email,
                isLeader: true,
                memberId: userId,
                college: college,
                phone_number: phone_number
            }];
            if (registrationData.groupMembers && registrationData.groupMembers.length > 0) {
                registrationData.groupMembers.forEach(member => {
                    allAttendees.push({
                        name: member.name,
                        email: member.email,
                        isLeader: false,
                        memberId: member.memberId,
                        college: member.college,
                        phone_number: member.phone_number
                    });
                });
            }

            const qrCodesForGroup = [];
            for (const attendee of allAttendees) {
                const qrData = JSON.stringify({
                    type: 'FestPass_Member',
                    regId: dbRegistrationId,
                    memberId: attendee.memberId,
                    name: attendee.name,
                    college: attendee.college,
                    isLeader: attendee.isLeader
                });
                const qrCodeUrl = await qrcode.toDataURL(qrData);
                qrCodesForGroup.push({ ...attendee, qrCodeUrl });
            }

            await regDocRef.update({
                paymentStatus: 'completed',
                paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
                qrCodesForGroup: qrCodesForGroup
            });
            console.log(`Free fest pass registration completed for ${email} (ID: ${dbRegistrationId}) with multiple QRs.`);

            const finalDetails = { ...registrationData, id: dbRegistrationId, paymentStatus: 'completed', qrCodesForGroup };

            for (const attendee of qrCodesForGroup) {
                const mailOptions = {
                    from: `"CEREBREXIA'25 Team" <${process.env.EMAIL_SENDER}>`,
                    to: attendee.email,
                    subject: `Your CEREBREXIA'25 Fest Pass - ${attendee.name} (${attendee.isLeader ? 'Leader' : 'Group Member'})`,
                    html: generateUserFestPassEmail(finalDetails, [attendee]),
                    attachments: [{
                        filename: `${attendee.name.replace(/\s/g, '_')}_FestPass_QR.png`,
                        path: attendee.qrCodeUrl,
                        cid: `festpass_qr_code_0`
                    }]
                };

                if(attendee.isLeader) {
                    mailOptions.subject = `Your CEREBREXIA'25 Fest Pass - All Group QRs & Details`;
                    mailOptions.html = generateUserFestPassEmail(finalDetails, qrCodesForGroup);
                    mailOptions.attachments = qrCodesForGroup.map((qrInfo, index) => ({
                        filename: `${qrInfo.name.replace(/\s/g, '_')}_FestPass_QR.png`,
                        path: qrInfo.qrCodeUrl,
                        cid: `festpass_qr_code_${index}`
                    }));
                }
                await sendFestEmail(mailOptions);
                console.log(`Sent Fest Pass QR email to ${attendee.email}`);
            }

            await sendFestEmail({
                from: `"CEREBREXIA'25 Notifier" <${process.env.EMAIL_SENDER}>`,
                to: HEAD_COORDINATOR_EMAIL,
                subject: `[Free Fest Pass] New Registration: ${name} (${enrollmentType === 'group' ? 'Group' : 'Individual'})`,
                html: generateAdminFestPassEmail(registrationData, qrCodesForGroup),
                attachments: qrCodesForGroup.map((qrInfo, index) => ({
                    filename: `${qrInfo.name.replace(/\s/g, '_')}_FestPass_QR.png`,
                    path: qrInfo.qrCodeUrl,
                    cid: `festpass_qr_code_admin_${index}`
                }))
            });

            return res.status(200).json({ status: 'success', message: 'Free registration successful!' });
        } else {
            console.log('Handling paid fest pass registration.');

            console.log('Checkpoint 7b: Preparing Razorpay order.');

            const options = {
                amount: Math.round(numericAmount * 100),
                currency: "INR",
                receipt: `festpass_${dbRegistrationId}`,
                notes: { registrationId: dbRegistrationId, userId: userId, registration_type: 'festPass' }
            };
            const order = await instance.orders.create(options);
            await regDocRef.update({ razorpay_order_id: order.id });

            console.log('Checkpoint 8: Razorpay order created. Sending response.');

            res.status(200).json({
                message: 'Fest Pass registration initiated.',
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                razorpayKey: process.env.RAZORPAY_KEY_ID,
                dbRegistrationId: dbRegistrationId
            });
        }
    } catch (error) {
        console.error('SERVER CRASHING ERROR in /api/register (Fest Pass):', error);
        res.status(500).json({ message: 'Server error during Fest Pass registration process.' });
    }
});

app.post('/api/register-event', async (req, res) => {
    console.log('****** HITTING THE /API/REGISTER-EVENT ROUTE! (Specific Event Registration) ******');
    console.log('Request Body for event registration:', req.body); // Detailed log for event body

    // Corrected: Using eventFeeValue from frontend.
    // Frontend is now sending: userId, eventId, eventName, fullName, email, phone,
    //                          isTeamEvent, teamName, teamMembersCount, teamDetails,
    //                          submissionLink, purpose, eventFeeValue, coordinatorEmail
    const { userId, eventId, eventName, fullName, email, phone, isTeamEvent, teamName, teamMembersCount, teamDetails, submissionLink, purpose, eventFeeValue, coordinatorEmail } = req.body;

    // Basic validation for essential fields from the form directly
    // Removed checks for college and yearOfStudy as they are removed from frontend
    if (!userId || !eventId || !eventName || !fullName || !email || !phone || eventFeeValue === undefined) {
        console.log('Validation Failed: Missing required fields for event registration (frontend-provided).');
        return res.status(400).json({ message: "Missing required event registration fields (Full Name, Email, Phone, Event Name, Event ID, Event Fee)." });
    }
    
    let finalEventFee = parseFloat(eventFeeValue); // Use eventFeeValue here
    if (isNaN(finalEventFee)) {
        console.log('Validation Failed: Invalid event fee value. Received:', eventFeeValue); // Added received value
        return res.status(400).json({ message: 'Invalid event registration fee value.' });
    }

    // Team event specific validation
    if (isTeamEvent === 'true') { // Remember, isTeamEvent comes as a string 'true' or 'false'
        if (!teamName || teamMembersCount === undefined) { // Check teamMembersCount for undefined too
            console.log('Validation Failed: Team name or member count missing for team event.');
            return res.status(400).json({ message: 'Team name and number of team members are required for team events.' });
        }
        const parsedTeamMembersCount = parseInt(teamMembersCount);
        // Check if the number of provided teamDetails matches the count (excluding leader)
        if (parsedTeamMembersCount > 1 && (!teamDetails || teamDetails.length !== (parsedTeamMembersCount - 1))) {
            console.log('Validation Failed: Incomplete team member details for team event. Expected:', (parsedTeamMembersCount - 1), 'Got:', teamDetails ? teamDetails.length : 0);
            return res.status(400).json({ status: 'error', message: 'Please provide details for all additional team members.' });
        }
    }

    console.log('Checkpoint A1: Event registration form validation passed.');

    try {
        // Fetch user profile if you still want to log or use their registered college/year
        // This is not for pre-filling the form anymore, but for internal data enrichment.
        const userDoc = await db.collection('users').doc(userId).get();
        let userCollegeFromProfile = 'N/A'; // Default value
        let userYearOfStudyFromProfile = 'N/A'; // Default value
        if (userDoc.exists) {
            const profile = userDoc.data();
            userCollegeFromProfile = profile.college || 'N/A';
            userYearOfStudyFromProfile = profile.yearOfStudy || 'N/A';
        }

        // Check for IGIMS user with Fest Pass for free events
        // THIS LOGIC IS OPTIONAL. If you always want to charge as per eventFeeValue, remove this block.
        // If you've removed College from the frontend form, this check might rely solely on Firebase profile.
        // So, if profile doesn't have college, this logic won't apply.
        if (userCollegeFromProfile === 'IGIMS, Patna') { // Check college from fetched profile
            const festRegQuery = await db.collection('festRegistrations').where('userId', '==', userId).where('paymentStatus', '==', 'completed').limit(1).get();
            if (!festRegQuery.empty) {
                console.log(`IGIMS user with Fest Pass detected. Making event ${eventName} free.`);
                finalEventFee = 0; // Override fee if IGIMS user has fest pass
            }
        }

        const eventRegistrationData = {
            userId,
            eventId,
            eventName,
            userName: fullName, // Directly from form
            userEmail: email, // Directly from form
            userPhone: phone, // Directly from form
            // Removed direct fields for college and yearOfStudy since frontend removed them.
            // If you still want to store them, you'd need to add them back to the frontend form.
            // For now, these can be pulled from userProfileFromFirebase if available.
            userCollege: userCollegeFromProfile, // Get from Firebase profile if available
            userYearOfStudy: userYearOfStudyFromProfile, // Get from Firebase profile if available
            isTeamEvent: isTeamEvent === 'true', // Convert string to boolean
            teamName: isTeamEvent === 'true' ? teamName : null,
            teamMembersCount: isTeamEvent === 'true' ? parseInt(teamMembersCount) : 1,
            teamDetails: teamDetails || [], // Ensure it's an array, even if empty
            submissionLink: submissionLink || null,
            purpose: purpose || null,
            amount: finalEventFee,
            paymentStatus: 'pending',
            coordinatorEmail: coordinatorEmail || HEAD_COORDINATOR_EMAIL,
            registeredAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const eventRegRef = await db.collection('eventRegistrations').add(eventRegistrationData);
        const dbEventRegId = eventRegRef.id;

        console.log(`Checkpoint A2: Event registration data saved to Firestore with ID: ${dbEventRegId}.`);


        if (finalEventFee <= 0) {
            console.log('Handling free event registration.');
            await eventRegRef.update({ paymentStatus: 'completed', paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp() });
            const finalDetails = { ...eventRegistrationData, id: dbEventRegId, paymentStatus: 'completed' };
            
            // Send user email
            await sendFestEmail({
                from: `"CEREBREXIA'25 Team" <${process.env.EMAIL_SENDER}>`,
                to: finalDetails.userEmail,
                subject: `Your entry for ${eventName} is confirmed!`,
                html: generateUserEventEmail(finalDetails)
            });
            
            // Send admin/coordinator email
            await sendFestEmail({
                from: `"CEREBREXIA'25 Notifier" <${process.env.EMAIL_SENDER}>`,
                to: [HEAD_COORDINATOR_EMAIL, coordinatorEmail].filter(Boolean),
                subject: `[Free Entry] ${eventName} by ${fullName}`,
                html: generateAdminEventEmail(finalDetails)
            });
            
            return res.status(200).json({ status: 'success', message: `Successfully registered for ${eventName}!` });
        }

        console.log('Checkpoint A3: Preparing Razorpay order for paid event.');

        const options = {
            amount: Math.round(finalEventFee * 100),
            currency: "INR",
            receipt: `event_${dbEventRegId}`,
            notes: { registrationId: dbEventRegId, userId: userId, registration_type: 'event' }
        };
        const order = await instance.orders.create(options);
        await eventRegRef.update({ razorpay_order_id: order.id });

        console.log('Checkpoint A4: Razorpay order created. Sending response.');

        res.status(200).json({
            message: 'Event registration initiated.',
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            razorpayKey: process.env.RAZORPAY_KEY_ID,
            dbRegistrationId: dbEventRegId,
            registration_type: 'event'
        });
    } catch (error) {
        console.error(`SERVER CRASHING ERROR in /api/register-event for ${eventName}:`, error);
        res.status(500).json({ message: 'Server error during event registration.' });
    }
});

app.post('/api/payment/callback', async (req, res) => {
    console.log('****** HITTING THE /API/PAYMENT/CALLBACK ROUTE! ******');
    console.log('Callback Body:', req.body); // Detailed log for callback body

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    let registrationId, registration_type;
    try {
        const orderDetails = await instance.orders.fetch(razorpay_order_id);
        if (!orderDetails || !orderDetails.notes || !orderDetails.notes.registrationId) {
            console.error("Error: Registration ID not found in Razorpay order notes for order:", razorpay_order_id);
            return res.status(400).json({ status: 'failed', message: 'Registration ID not found in order notes.' });
        }
        registrationId = orderDetails.notes.registrationId;
        registration_type = orderDetails.notes.registration_type;
        console.log(`Fetched order details. Reg ID: ${registrationId}, Type: ${registration_type}`);
    } catch (error) {
        console.error("Error fetching order from Razorpay for order:", razorpay_order_id, error);
        return res.status(500).json({ status: 'failed', message: 'Could not fetch order details.' });
    }
    if (!registrationId || !registration_type) {
        console.error("Error: Invalid registration ID or type after fetching order details.");
        return res.status(400).json({ status: 'failed', message: 'Invalid registration type or missing ID.' });
    }

    const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest('hex');

    if (digest !== razorpay_signature) {
        console.warn(`Payment verification failed for order ${razorpay_order_id}. Signature mismatch. Frontend signature: ${razorpay_signature}, Backend digest: ${digest}`);
        // Optionally update Firestore with paymentStatus: 'failed'
        return res.status(400).json({ status: 'failed', message: 'Payment verification failed.' });
    }

    console.log('Payment signature verified successfully.');

    const collectionName = (registration_type === 'festPass') ? 'festRegistrations' : 'eventRegistrations';
    const regDocRef = db.collection(collectionName).doc(registrationId);

    try {
        const doc = await regDocRef.get();
        if (!doc.exists) {
            console.error(`Registration record not found in ${collectionName} for ID ${registrationId}.`);
            return res.status(404).json({ status: 'failed', message: 'Registration record not found.' });
        }
        const registration = doc.data();

        if (registration.paymentStatus === 'completed') {
            console.log(`Payment for ${registration_type} ID ${registrationId} was already processed.`);
            return res.status(200).json({ status: 'success', message: 'Payment was already processed.' });
        }

        let qrCodesForGroup = [];
        // If this is a festPass registration, generate QR codes for all attendees (leader + group members)
        if (registration_type === 'festPass') {
            console.log('Generating QR codes for Fest Pass attendees...');
            const allAttendees = [{
                name: registration.name, email: registration.email, isLeader: true,
                memberId: registration.leaderMemberId, college: registration.college, phone_number: registration.phone_number
            }];
            if (registration.groupMembers && registration.groupMembers.length > 0) {
                registration.groupMembers.forEach(member => {
                    allAttendees.push({
                        name: member.name, email: member.email, isLeader: false,
                        memberId: member.memberId, college: member.college, phone_number: member.phone_number
                    });
                });
            }
            for (const attendee of allAttendees) {
                const qrData = JSON.stringify({
                    type: 'FestPass_Member', regId: registrationId, memberId: attendee.memberId,
                    name: attendee.name, college: attendee.college, isLeader: attendee.isLeader, paymentId: razorpay_payment_id
                });
                const qrCodeUrl = await qrcode.toDataURL(qrData);
                qrCodesForGroup.push({ ...attendee, qrCodeUrl });
            }
            console.log(`Generated ${qrCodesForGroup.length} QR codes.`);
        }

        const updatedData = {
            paymentStatus: 'completed',
            razorpay_order_id,
            razorpay_payment_id,
            paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            qrCodesForGroup: qrCodesForGroup, // This will be empty array for event registrations, populated for festPass
            qrCode: qrCodesForGroup.find(m => m.isLeader)?.qrCodeUrl || null // Only for festPass leader, else null
        };
        await regDocRef.update(updatedData);

        console.log(`Payment successful for ${registration_type} ID: ${registrationId}. Document updated.`);
        const finalDetails = { ...registration, ...updatedData, id: registrationId };

        // Send confirmation emails based on registration type
        if (registration_type === 'festPass') {
            for (const attendee of qrCodesForGroup) {
                const mailOptions = {
                    from: `"CEREBREXIA'25 Team" <${process.env.EMAIL_SENDER}>`,
                    to: attendee.email,
                    subject: `Your CEREBREXIA'25 Fest Pass - ${attendee.name} (${attendee.isLeader ? 'Leader' : 'Group Member'})`,
                    html: generateUserFestPassEmail(finalDetails, [attendee]), // Send individual QR in HTML for each
                    attachments: [{
                        filename: `${attendee.name.replace(/\s/g, '_')}_FestPass_QR.png`,
                        path: attendee.qrCodeUrl,
                        cid: `festpass_qr_code_0`
                    }]
                };

                // For the leader, send an email with all group QRs
                if(attendee.isLeader) {
                    mailOptions.subject = `Your CEREBREXIA'25 Fest Pass - All Group QRs & Details`;
                    mailOptions.html = generateUserFestPassEmail(finalDetails, qrCodesForGroup); // Send all QRs in leader's email
                    mailOptions.attachments = qrCodesForGroup.map((qrInfo, index) => ({
                        filename: `${qrInfo.name.replace(/\s/g, '_')}_FestPass_QR.png`,
                        path: qrInfo.qrCodeUrl,
                        cid: `festpass_qr_code_${index}`
                    }));
                }
                await sendFestEmail(mailOptions);
                console.log(`Sent Fest Pass QR email to ${attendee.email}`);
            }

            // Send admin email for Fest Pass
            await sendFestEmail({
                from: `"CEREBREXIA'25 Notifier" <${process.env.EMAIL_SENDER}>`,
                to: HEAD_COORDINATOR_EMAIL,
                subject: `[Fest Pass] Payment Success: ${finalDetails.name} (${finalDetails.enrollmentType === 'group' ? 'Group' : 'Individual'})`,
                html: generateAdminFestPassEmail(finalDetails, qrCodesForGroup),
                attachments: qrCodesForGroup.map((qrInfo, index) => ({
                    filename: `${qrInfo.name.replace(/\s/g, '_')}_FestPass_QR.png`,
                    path: qrInfo.qrCodeUrl,
                    cid: `festpass_qr_code_admin_${index}`
                }))
            });
        } else { // It's an event registration
            console.log('Sending emails for Event Registration...');
            await sendFestEmail({
                from: `"CEREBREXIA'25 Team" <${process.env.EMAIL_SENDER}>`,
                to: finalDetails.userEmail,
                subject: `Your entry for ${finalDetails.eventName} is Confirmed!`,
                html: generateUserEventEmail(finalDetails)
            });
            await sendFestEmail({
                from: `"CEREBREXIA'25 Notifier" <${process.env.EMAIL_SENDER}>`,
                to: [HEAD_COORDINATOR_EMAIL, finalDetails.coordinatorEmail].filter(Boolean),
                subject: `[Paid Entry] ${finalDetails.eventName} by ${finalDetails.userName}`,
                html: generateAdminEventEmail(finalDetails)
            });
        }
        res.status(200).json({ status: 'success', message: 'Payment successful and registration confirmed!' });
    } catch (error) {
        console.error('SERVER CRASHING ERROR in /api/payment/callback:', error);
        res.status(500).json({ status: 'error', message: 'Server error during payment verification.' });
    }
});

app.post('/api/scan-qr', async (req, res) => {
    console.log('--- HITTING THE /API/SCAN-QR ROUTE! ---');
    console.log('Request Body:', req.body);
    const { regId, memberId, isManual } = req.body;
    const volunteerId = req.headers['x-volunteer-id']; // Get volunteer ID from header

    console.log('Checkpoint A: Received scan data:', { regId, memberId, volunteerId });

    if (!regId || !memberId || !volunteerId) {
        console.log('Validation failed for /api/scan-qr: Missing regId, memberId, or volunteerId.');
        return res.status(400).json({ status: 'error', message: 'Missing required scan data (RegID, MemberID, or Volunteer ID).' });
    }

    console.log('Checkpoint B: Validation passed. Starting Firestore lookup.');

    try {
        const regDocRef = db.collection('festRegistrations').doc(regId);
        const doc = await regDocRef.get();

        if (!doc.exists) {
            console.log(`Scan Error: Registration with ID ${regId} not found.`);
            return res.status(404).json({ status: 'error', message: 'Registration not found. Invalid QR Code.' });
        }

        const registrationData = doc.data();
        console.log('Checkpoint C: Registration data fetched:', registrationData.name, registrationData.email);

        const scannedMemberIndex = registrationData.qrCodesForGroup ? 
                                   registrationData.qrCodesForGroup.findIndex(m => m.memberId === memberId) : -1;
        const scannedMember = scannedMemberIndex !== -1 ? registrationData.qrCodesForGroup[scannedMemberIndex] : null;

        if (!scannedMember) {
            console.log(`Scan Error: Member ID ${memberId} not found in registration ${regId}.`);
            return res.status(404).json({ status: 'error', message: 'Member not found for this registration. Invalid QR Code.' });
        }
        console.log('Checkpoint D: Scanned member found:', scannedMember.name);

        if (scannedMember.hasEntered) {
            console.log(`Scan Warning: Member ${scannedMember.name} (ID: ${memberId}) already entered.`);
            console.log('Checkpoint E (Warning): Sending already scanned response.');
            return res.status(200).json({
                status: 'warning',
                message: 'Already Scanned!',
                data: {
                    name: scannedMember.name,
                    college: scannedMember.college,
                    enrollmentType: registrationData.enrollmentType,
                    numMembers: registrationData.numMembers,
                    memberId: scannedMember.memberId,
                    passNumber: scannedMember.passNumber,
                    lastScanTime: scannedMember.entryTime, // Use existing entryTime for lastScanTime
                    lastScannedBy: scannedMember.enteredBy
                }
            });
        }

        console.log('Checkpoint F: Processing new entry.');
        const passNumber = await generatePassNumber();
        const entryTime = admin.firestore.Timestamp.now();

        const updatedQrCodesForGroup = [...registrationData.qrCodesForGroup];
        updatedQrCodesForGroup[scannedMemberIndex] = {
            ...scannedMember,
            hasEntered: true,
            entryTime: entryTime,
            enteredBy: volunteerId,
            passNumber: passNumber
        };

        await regDocRef.update({ qrCodesForGroup: updatedQrCodesForGroup });
        console.log('Checkpoint G: Firestore updated for new entry.');

        console.log(`Scan Success: Member ${scannedMember.name} (ID: ${memberId}) entered. Pass: ${passNumber}`);

        await sendFestEmail({
            from: `"CEREBREXIA'25 Entry" <${process.env.EMAIL_SENDER}>`,
            to: scannedMember.email,
            subject: `Your CEREBREXIA'25 Fest Entry Confirmation - ${scannedMember.name}`,
            html: generateUserEntryConfirmationEmail({
                name: scannedMember.name,
                eventName: "CEREBREXIA'25 Fest",
                passNumber: passNumber,
                entryTime: entryTime.toDate().toLocaleString(), // Convert for email display
                volunteerId: volunteerId
            })
        });
        console.log('Checkpoint H: Sending entry confirmation email.');


        res.status(200).json({
            status: 'success',
            message: 'Entry Successful!',
            data: {
                name: scannedMember.name,
                college: scannedMember.college,
                enrollmentType: registrationData.enrollmentType,
                numMembers: registrationData.numMembers,
                memberId: scannedMember.memberId,
                passNumber: passNumber,
                lastScanTime: entryTime,
                lastScannedBy: volunteerId
            }
        });

    } catch (error) {
        console.error('SERVER CRASHING ERROR in /api/scan-qr:', error);
        res.status(500).json({ status: 'error', message: 'Server error during scan processing.' });
    }
});

// --- NEW Email Template for Entry Confirmation ---
function generateUserEntryConfirmationEmail(details) {
    const detailsHTML = `
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Event:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.eventName}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Entry Time:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.entryTime}</p>
        </div>
        <div class="detail-row" style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid rgba(204,153,255,0.15); word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Your Pass No.:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">${details.passNumber}</p>
        </div>
        <div class="detail-row" style="margin-bottom:0; padding-bottom:0; border-bottom:none; word-wrap:break-word; overflow-wrap:break-word;">
            <p class="detail-label" style="font-weight:600; color:#00ffff; font-size:0.95em; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Scanned By:</p>
            <p class="detail-value" style="font-size:1em; color:#d8d8d8; display:block;">Volunteer ID: ${details.volunteerId}</p>
        </div>
    `;
    const contentHTML = `
        <p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">Dear ${details.name},</p>
        <p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">This is to confirm your successful entry into <strong>${details.eventName}</strong>.</p>
        <h3 style="color:#ff99ff; font-family:'Exo',sans-serif; margin-top:25px; margin-bottom:12px; border-bottom:2px solid rgba(255,102,255,0.5); padding-bottom:10px; font-size:1.6em; font-weight:700; text-shadow:0 0 8px rgba(255,153,255,0.5);">Your Entry Details:</h3>
        <div class="details-section" style="background-color:rgba(255,255,255,0.05); border-radius:8px; padding:15px;">
            ${detailsHTML}
        </div>
        <p style="color:#d8d8d8; font-size:1.05em; line-height:1.7;">We hope you have a fantastic time at CEREBREXIA'25! Enjoy the fest.</p>
    `;
    return generateBaseEmailHTML(`CEREBREXIA'25 Entry Confirmed!`, "Your Entry is Confirmed!", contentHTML);
}

