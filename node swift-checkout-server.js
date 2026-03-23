/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   SWIFT STORE — CHECKOUT BACKEND SERVER                          ║
 * ║   File: swift-checkout-server.js                                 ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  WHAT THIS DOES                                                  ║
 * ║  • Receives order form + SadaPay screenshot                     ║
 * ║  • Creates a real Shopify Draft Order (appears in Admin)        ║
 * ║  • Uploads screenshot to Shopify Files (attached to order)      ║
 * ║  • Sends email to swiftstorellc.pk@gmail.com WITH screenshot    ║
 * ║  • Confirms order back to customer                              ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  DEPLOY OPTIONS (free)                                          ║
 * ║  → Railway.app (easiest) → railway.app                         ║
 * ║  → Render.com → render.com                                     ║
 * ║  → Fly.io → fly.io                                             ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  SETUP STEPS                                                    ║
 * ║  1. npm init -y                                                 ║
 * ║  2. npm install express multer nodemailer cors                  ║
 * ║  3. Fill in the ENV VARIABLES below                             ║
 * ║  4. node swift-checkout-server.js                              ║
 * ║  5. Copy your server URL into Shopify section settings         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
const express  = require('express');
const multer   = require('multer');
const nodemailer = require('nodemailer');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

/* ═══════════════════════════════════════════
   ⚙  ENV VARIABLES
═══════════════════════════════════════════ */

const CONFIG = {
  SHOPIFY_STORE:    process.env.SHOPIFY_STORE,
  SHOPIFY_TOKEN:    process.env.SHOPIFY_TOKEN,
  GMAIL_USER:       process.env.GMAIL_USER,
  GMAIL_APP_PASS:   process.env.GMAIL_APP_PASS,
  STORE_NAME:       'Swift Store LLC',
  SADAPAY_NUM:      '0336-2547633',
  PORT:             process.env.PORT || 3000,
};

// ... Rest of your logic (Multer, Nodemailer, Shopify Helpers) remains the same as your original file ...

app.listen(CONFIG.PORT, () => {
  console.log(`Server running on port ${CONFIG.PORT}`);
});
const express  = require('express');
const multer   = require('multer');
const nodemailer = require('nodemailer');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

/* ═══════════════════════════════════════════
   ⚙  ENV VARIABLES — FILL THESE IN
   (use environment variables in production,
    never hardcode secrets in files)
═══════════════════════════════════════════ */
const CONFIG = {
  // Your Shopify store
  SHOPIFY_STORE:    process.env.SHOPIFY_STORE    || 'your-store.myshopify.com',
  SHOPIFY_TOKEN:    process.env.SHOPIFY_TOKEN    || 'shpat_XXXXXXXXXXXXXXXXXXXX', // Admin API token

  // Gmail — use an App Password (not your main password)
  // Google Account → Security → 2FA → App Passwords → Generate
  GMAIL_USER:       process.env.GMAIL_USER       || 'swiftstorellc.pk@gmail.com',
  GMAIL_APP_PASS:   process.env.GMAIL_APP_PASS   || 'xxxx xxxx xxxx xxxx', // 16-char app password

  // Store info
  STORE_NAME:       'Swift Store LLC',
  SADAPAY_NUM:      '0336-2547633',

  PORT: process.env.PORT || 3000,
};

/* ═══════════════════════════════════════════
   MULTER — handle file upload in memory
═══════════════════════════════════════════ */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|gif|webp)|application\/pdf/.test(file.mimetype);
    cb(ok ? null : new Error('Invalid file type'), ok);
  }
});

/* ═══════════════════════════════════════════
   NODEMAILER SETUP
═══════════════════════════════════════════ */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: CONFIG.GMAIL_USER,
    pass: CONFIG.GMAIL_APP_PASS,
  }
});

/* ═══════════════════════════════════════════
   SHOPIFY HELPERS
═══════════════════════════════════════════ */
async function shopifyRequest(endpoint, method = 'GET', body = null) {
  const url = `https://${CONFIG.SHOPIFY_STORE}/admin/api/2024-04/${endpoint}`;
  const opts = {
    method,
    headers: {
      'X-Shopify-Access-Token': CONFIG.SHOPIFY_TOKEN,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Create a Shopify Draft Order
 * This appears in Admin → Orders as a real order
 */
async function createShopifyOrder(data) {
  const { customerName, customerEmail, customerPhone, address, totalAmount, orderNote, payMethod, screenshotUrl } = data;
  const [firstName, ...rest] = customerName.split(' ');
  const lastName = rest.join(' ') || '-';

  // Parse address (simple)
  const addrParts = address.split(',').map(s => s.trim());

  const payload = {
    draft_order: {
      note: [orderNote, screenshotUrl ? `Payment Screenshot: ${screenshotUrl}` : ''].filter(Boolean).join('\n'),
      email: customerEmail,
      phone: customerPhone,
      tags: payMethod === 'sadapay' ? 'SadaPay, Pending Verification' : 'COD',
      note_attributes: [
        { name: 'Payment Method', value: payMethod === 'sadapay' ? 'SadaPay Transfer' : 'Cash on Delivery' },
        { name: 'SadaPay Verified', value: payMethod === 'sadapay' ? 'Pending' : 'N/A' },
        { name: 'Screenshot URL',  value: screenshotUrl || 'N/A' },
        { name: 'Total Amount',    value: totalAmount },
      ],
      shipping_address: {
        first_name: firstName,
        last_name:  lastName,
        phone:      customerPhone,
        address1:   addrParts[0] || address,
        city:       addrParts[addrParts.length - 3] || 'Karachi',
        province:   addrParts[addrParts.length - 2] || 'Sindh',
        country:    'PK',
        zip:        '',
      },
      billing_address: {
        first_name: firstName,
        last_name:  lastName,
        phone:      customerPhone,
        address1:   addrParts[0] || address,
        city:       addrParts[addrParts.length - 3] || 'Karachi',
        country:    'PK',
      },
      // Use cart line items from Shopify session
      // In production you'd pass line items from cart.js
      line_items: [
        {
          title:    'Order via Swift Checkout',
          price:    (parseFloat(totalAmount.replace(/[^0-9.]/g, '')) || 0).toFixed(2),
          quantity: 1,
          requires_shipping: true,
        }
      ],
    }
  };

  const result = await shopifyRequest('draft_orders.json', 'POST', payload);
  return result.draft_order;
}

/**
 * Upload screenshot to Shopify Files API
 * Returns public URL of uploaded file
 */
async function uploadScreenshotToShopify(fileBuffer, fileName, mimeType) {
  // Shopify Files API (GraphQL)
  const base64 = fileBuffer.toString('base64');
  const mutation = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          ... on MediaImage {
            image { url }
          }
          ... on GenericFile {
            url
          }
        }
        userErrors { field message }
      }
    }
  `;
  const variables = {
    files: [{
      filename:    fileName,
      mimeType:    mimeType,
      originalSource: `data:${mimeType};base64,${base64}`,
      contentType: 'IMAGE',
    }]
  };

  const res = await fetch(`https://${CONFIG.SHOPIFY_STORE}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': CONFIG.SHOPIFY_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: mutation, variables })
  });

  const data = await res.json();
  const files = data?.data?.fileCreate?.files || [];
  if (files[0]) {
    return files[0].image?.url || files[0].url || null;
  }
  return null;
}

/* ═══════════════════════════════════════════
   EMAIL TEMPLATE
═══════════════════════════════════════════ */
function buildEmailHTML(data, orderNum, screenshotUrl) {
  const { customerName, customerEmail, customerPhone, address, totalAmount, payMethod, orderNote } = data;
  const isSwift = payMethod === 'sadapay';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f9;font-family:'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f9;padding:32px 0;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,51,102,0.12);">

      <!-- Header -->
      <tr><td style="background:#003366;padding:28px 36px;">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:.02em;">Swift Store LLC</h1>
        <p style="color:rgba(255,255,255,.6);margin:4px 0 0;font-size:13px;">New Order Notification</p>
      </td></tr>

      <!-- Status bar -->
      <tr><td style="background:${isSwift ? '#6c3de0' : '#d97706'};padding:10px 36px;">
        <p style="color:#fff;margin:0;font-size:13px;font-weight:600;">
          ${isSwift ? '💜 SadaPay Transfer — Verify Screenshot Below' : '📦 Cash on Delivery Order'}
        </p>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px 36px;">

        <!-- Order number -->
        <div style="background:#f0f4f9;border:1.5px solid #dde5ef;border-radius:10px;padding:14px 20px;display:flex;justify-content:space-between;margin-bottom:24px;">
          <span style="font-size:13px;color:#64748b;font-weight:600;">Order Number</span>
          <span style="font-size:16px;font-weight:800;color:#003366;">${orderNum}</span>
        </div>

        <!-- Customer info -->
        <h2 style="font-size:15px;font-weight:700;color:#003366;margin:0 0 14px;border-bottom:1px solid #dde5ef;padding-bottom:10px;">Customer Details</h2>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#64748b;width:140px;font-weight:600;">Name</td>
            <td style="padding:5px 0;font-size:13px;color:#0c1524;font-weight:700;">${customerName}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#64748b;font-weight:600;">Email</td>
            <td style="padding:5px 0;font-size:13px;color:#0c1524;">${customerEmail}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#64748b;font-weight:600;">Phone</td>
            <td style="padding:5px 0;font-size:13px;color:#0c1524;">${customerPhone}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#64748b;font-weight:600;">Address</td>
            <td style="padding:5px 0;font-size:13px;color:#0c1524;">${address}</td>
          </tr>
        </table>

        <!-- Payment info -->
        <div style="background:${isSwift ? '#f8f5ff' : '#fffbeb'};border:1.5px solid ${isSwift ? '#c4b5fd' : '#fde68a'};border-radius:12px;padding:18px 20px;margin:24px 0;">
          <h3 style="font-size:14px;font-weight:700;color:${isSwift ? '#6c3de0' : '#d97706'};margin:0 0 10px;">
            ${isSwift ? '💜 SadaPay Payment' : '💵 Cash on Delivery'}
          </h3>
          <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;">
            <strong>Total Amount:</strong> ${totalAmount}<br>
            ${isSwift ? '<strong>SadaPay Account:</strong> 0336-2547633 (Swift Store LLC)<br>' : ''}
            ${isSwift ? '<strong>Status:</strong> <span style="color:#6c3de0">Pending Verification</span>' : '<strong>Status:</strong> Collect on delivery'}
          </p>
        </div>

        <!-- Order note -->
        <div style="background:#f6f8fb;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.8;">${orderNote.replace(/\|/g, '<br>')}</p>
        </div>

        <!-- Total -->
        <div style="background:#003366;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <span style="color:rgba(255,255,255,.7);font-size:14px;font-weight:600;">Order Total</span>
          <span style="color:#fff;font-size:22px;font-weight:800;">${totalAmount}</span>
        </div>

        ${isSwift && screenshotUrl ? `
        <!-- Screenshot -->
        <h2 style="font-size:15px;font-weight:700;color:#003366;margin:0 0 14px;border-bottom:1px solid #dde5ef;padding-bottom:10px;">📸 Payment Screenshot</h2>
        <div style="border:2px solid #c4b5fd;border-radius:12px;overflow:hidden;margin-bottom:24px;">
          <img src="${screenshotUrl}" alt="Payment Screenshot" style="width:100%;display:block;max-height:400px;object-fit:contain;background:#f8f5ff;">
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
          <p style="margin:0;font-size:12.5px;color:#15803d;font-weight:600;">✓ Screenshot uploaded by customer. Please verify the transfer amount and account matches before dispatching.</p>
        </div>
        ` : ''}

        ${isSwift && !screenshotUrl ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
          <p style="margin:0;font-size:12.5px;color:#dc2626;font-weight:600;">⚠ No screenshot attached. Contact customer before dispatching.</p>
        </div>
        ` : ''}

        <!-- Action buttons -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right:8px;width:50%;">
              <a href="https://${CONFIG.SHOPIFY_STORE}/admin/orders" style="display:block;background:#003366;color:#fff;text-align:center;padding:12px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">View in Shopify</a>
            </td>
            <td style="padding-left:8px;">
              <a href="mailto:${customerEmail}" style="display:block;background:#f0f4f9;color:#003366;text-align:center;padding:12px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;border:1.5px solid #dde5ef;">Email Customer</a>
            </td>
          </tr>
        </table>

      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f6f8fb;padding:18px 36px;border-top:1px solid #dde5ef;">
        <p style="margin:0;font-size:11.5px;color:#94a3b8;text-align:center;">
          Swift Store LLC · swiftstorellc.pk@gmail.com · SadaPay: 0336-2547633
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>
  `;
}

/* ═══════════════════════════════════════════
   MAIN ROUTE — POST /submit-order
═══════════════════════════════════════════ */
app.post('/submit-order', upload.single('screenshot'), async (req, res) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] New order received`);

  try {
    const {
      customerName, customerEmail, customerPhone,
      address, totalAmount, orderNote, payMethod
    } = req.body;

    // Validate required fields
    if (!customerName || !customerEmail || !totalAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate screenshot for SadaPay orders
    if (payMethod === 'sadapay' && !req.file) {
      return res.status(400).json({ error: 'Screenshot is required for SadaPay orders' });
    }

    const orderNum = '#SW' + Math.floor(10000 + Math.random() * 90000);
    let screenshotUrl = null;

    /* ── 1. Upload screenshot to Shopify ── */
    if (req.file) {
      console.log(`Uploading screenshot (${req.file.size} bytes) to Shopify...`);
      try {
        screenshotUrl = await uploadScreenshotToShopify(
          req.file.buffer,
          `${orderNum}-${req.file.originalname}`,
          req.file.mimetype
        );
        console.log('Screenshot uploaded:', screenshotUrl);
      } catch(e) {
        console.warn('Screenshot upload failed (continuing):', e.message);
      }
    }

    /* ── 2. Create Shopify Draft Order ── */
    let shopifyOrder = null;
    console.log('Creating Shopify draft order...');
    try {
      shopifyOrder = await createShopifyOrder({
        customerName, customerEmail, customerPhone,
        address, totalAmount, orderNote, payMethod, screenshotUrl
      });
      console.log('Shopify order created:', shopifyOrder.id);
    } catch(e) {
      console.warn('Shopify order creation failed (continuing):', e.message);
    }

    /* ── 3. Send email to store owner ── */
    const emailHTML = buildEmailHTML(
      { customerName, customerEmail, customerPhone, address, totalAmount, payMethod, orderNote },
      orderNum,
      screenshotUrl
    );

    const attachments = [];
    if (req.file) {
      attachments.push({
        filename:    req.file.originalname || 'payment-screenshot.jpg',
        content:     req.file.buffer,
        contentType: req.file.mimetype,
      });
    }

    try {
      await transporter.sendMail({
        from:    `"${CONFIG.STORE_NAME}" <${CONFIG.GMAIL_USER}>`,
        to:      CONFIG.GMAIL_USER, // → swiftstorellc.pk@gmail.com
        subject: `🛍 New Order ${orderNum} — ${payMethod === 'sadapay' ? 'SadaPay [VERIFY]' : 'COD'} — ${totalAmount} — ${customerName}`,
        html:    emailHTML,
        attachments,
      });
      console.log('Email sent to', CONFIG.GMAIL_USER);
    } catch(e) {
      console.warn('Email send failed:', e.message);
    }

    /* ── 4. Send confirmation email to customer ── */
    try {
      await transporter.sendMail({
        from:    `"${CONFIG.STORE_NAME}" <${CONFIG.GMAIL_USER}>`,
        to:      customerEmail,
        subject: `✅ Order Confirmed ${orderNum} — ${CONFIG.STORE_NAME}`,
        html: `
          <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f0f4f9;">
            <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,51,102,.1);">
              <div style="background:#003366;padding:24px 32px;"><h1 style="color:#fff;margin:0;font-size:20px;">Order Confirmed!</h1></div>
              <div style="padding:28px 32px;">
                <p style="font-size:15px;color:#334155;margin-bottom:20px;">Hi <strong>${customerName}</strong>, thank you for your order!</p>
                <div style="background:#f0f4f9;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;">
                  <span style="color:#64748b;font-size:13px;">Order Number</span>
                  <strong style="color:#003366;font-size:15px;">${orderNum}</strong>
                </div>
                <div style="background:#f0f4f9;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
                  <span style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Total Paid</span>
                  <div style="color:#003366;font-size:22px;font-weight:800;margin-top:4px;">${totalAmount}</div>
                </div>
                ${payMethod === 'sadapay' ? '<p style="background:#f8f5ff;border:1px solid #c4b5fd;border-radius:8px;padding:12px 16px;font-size:13px;color:#5530b8;margin-bottom:16px;">⏱ We will verify your SadaPay payment screenshot and confirm dispatch within 1–2 hours.</p>' : '<p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;color:#b45309;margin-bottom:16px;">📦 Our courier will call before delivery. Please have exact cash ready.</p>'}
                <p style="font-size:13px;color:#64748b;margin:0;">For any questions, reply to this email or contact us at <strong>${CONFIG.GMAIL_USER}</strong></p>
              </div>
              <div style="background:#f6f8fb;padding:14px 32px;border-top:1px solid #dde5ef;text-align:center;">
                <p style="margin:0;font-size:11.5px;color:#94a3b8;">${CONFIG.STORE_NAME}</p>
              </div>
            </div>
          </div>
        `,
      });
      console.log('Confirmation email sent to', customerEmail);
    } catch(e) {
      console.warn('Customer email failed:', e.message);
    }

    const elapsed = Date.now() - startTime;
    console.log(`Order processed in ${elapsed}ms`);

    return res.json({
      success:    true,
      orderNum,
      shopifyId:  shopifyOrder?.id || null,
      screenshot: screenshotUrl,
      message:    'Order placed successfully',
    });

  } catch(error) {
    console.error('Order processing failed:', error);
    return res.status(500).json({ error: 'Order processing failed', message: error.message });
  }
});

/* ═══════════════════════════════════════════
   HEALTH CHECK
═══════════════════════════════════════════ */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', store: CONFIG.SHOPIFY_STORE, timestamp: new Date().toISOString() });
});

/* ═══════════════════════════════════════════
   START SERVER
═══════════════════════════════════════════ */
app.listen(CONFIG.PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   Swift Checkout Server Running          ║
║   Port: ${CONFIG.PORT}                            ║
║   Store: ${CONFIG.SHOPIFY_STORE.substring(0, 28)}  ║
║   Email: ${CONFIG.GMAIL_USER.substring(0, 28)}  ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
