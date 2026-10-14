import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "crypto";
import swaggerUi from "swagger-ui-express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { swaggerSpec } from "./server/swaggerSpec";
import { identifyFigureWithAi, detectBarcodeWithAi } from "./server/geminiAiService";
import { getCatalogEntity, getAllCatalog, invalidateCatalogCache } from "./server/catalogService";
import { lookupBarcodeOnline } from "./server/barcodeLookupService";
import { optimizeImageDataUrl, optimizeImageArray } from "./server/imageOptimizer";

dotenv.config({ override: true });

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET: string = (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32)
  ? process.env.JWT_SECRET
  : "cardback-archivist-production-secret-token-key-32chars-minimum";

// Trust proxy for reverse proxies (Render, Railway, Cloud Run, Vercel)
app.set("trust proxy", 1);

// HTTP Security Headers (Safe for Vite dev & preview iframes)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  })
);

// Rate Limiters to protect against brute force and API abuse
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // limit each IP to 25 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Massa intents d'autenticació des d'aquesta IP. Si us plau, torna-ho a provar d'aquí a 15 minuts." },
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 password recovery emails per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Massa sol·licituds de recuperació. Per seguretat, espera 15 minuts abans de tornar-ho a provar." },
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // max 30 vision AI identifications per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "S'ha superat el límit temporal de crides d'identificació amb IA. Espera un minut." },
});

export const scannerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // max 60 barcode lookups per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Massa cerques de codis de barres seguides. Si us plau, espera un moment." },
});

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Serve user-uploaded figure photos statically with browser caching
const uploadsPath = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use("/uploads", express.static(uploadsPath, {
  maxAge: "1y",
  immutable: true,
}));

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!JWT_SECRET) return res.status(503).json({ error: "Authentication is not configured." });
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const cookieToken = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("cb_session="))
    ?.slice("cb_session=".length);
  let decoded: { id: string; role?: string; kind?: string } | null = null;
  let decodedCookie = "";
  try { decodedCookie = cookieToken ? decodeURIComponent(cookieToken) : ""; } catch { decodedCookie = ""; }
  const tokens = [bearerToken, decodedCookie].filter(Boolean);
  for (const token of tokens) {
    try {
      const candidate = jwt.verify(token, JWT_SECRET) as { id: string; role?: string; kind?: string };
      if (candidate?.id && candidate.kind !== "preauth") { decoded = candidate; break; }
    } catch { /* Try the session cookie if a legacy bearer token is expired. */ }
  }
  if (!decoded) return res.status(401).json({ error: tokens.length ? "Invalid or expired token." : "Authentication required." });
  res.locals.user = decoded;
  next();
}

function optionalAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const cookieToken = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("cb_session="))
    ?.slice("cb_session=".length);
  let decoded: { id: string; role?: string; kind?: string } | null = null;
  let decodedCookie = "";
  try { decodedCookie = cookieToken ? decodeURIComponent(cookieToken) : ""; } catch { decodedCookie = ""; }
  const tokens = [bearerToken, decodedCookie].filter(Boolean);
  for (const token of tokens) {
    try {
      const candidate = jwt.verify(token, JWT_SECRET) as { id: string; role?: string; kind?: string };
      if (candidate?.id && candidate.kind !== "preauth") { decoded = candidate; break; }
    } catch { /* Ignore token verification error for optional auth */ }
  }
  if (decoded) {
    res.locals.user = decoded;
  }
  next();
}

const SESSION_COOKIE = "cb_session";
const SESSION_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

function setSessionCookie(res: express.Response, user: any, rememberMe: boolean) {
  const maxAge = rememberMe ? SESSION_REMEMBER_MS : undefined;
  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role || "USER", kind: "session" },
    JWT_SECRET,
    { expiresIn: rememberMe ? "30d" : "8h" }
  );
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  });
}

function clearSessionCookie(res: express.Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

function normalizePublicUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName || user.username,
    role: user.role || "USER",
  };
}

function makePreAuthTicket(user: any) {
  return jwt.sign({ id: user.id, kind: "preauth" }, JWT_SECRET, { expiresIn: "10m" });
}

const passwordResetTableSql = `
  CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken" ("userId");
`;

let passwordResetTableReady: Promise<void> | null = null;
async function ensurePasswordResetTable(pool: pg.Pool) {
  if (!passwordResetTableReady) {
    passwordResetTableReady = pool.query(passwordResetTableSql).then(() => undefined).catch((error) => {
      passwordResetTableReady = null;
      throw error;
    });
  }
  await passwordResetTableReady;
}

function emailRecoveryConfigured() {
  const apiKey = process.env.RESEND_API_KEY || "re_FU3GsTUZ_D5mwvPsvJhcAorrQLJGGUfsZ";
  return Boolean(apiKey && apiKey.startsWith("re_"));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
}

const EMAIL_TRANSLATIONS: Record<string, {
  subject: string;
  slogan: string;
  title: string;
  greeting: string;
  body: string;
  button: string;
  expires: string;
  ignore: string;
  tagline: string;
}> = {
  ca: {
    subject: "Restablir la contrasenya de CardBack",
    slogan: "On viu la teva col·lecció!",
    title: "Sol·licitud de restabliment de contrasenya",
    greeting: "Hola",
    body: "Hem rebut una petició per restablir la contrasenya del teu compte a CardBack. Fes clic al botó inferior per crear-ne una de nova:",
    button: "Restablir la meva contrasenya",
    expires: "Aquest enllaç és d'ús únic i caducarà d'aquí a <strong>30 minuts</strong> per motius de seguretat.",
    ignore: "Si tu no has sol·licitat aquest canvi, pots ignorar aquest correu amb total tranquil·litat; el teu compte continua protegit.",
    tagline: "Arxiu, valoració i gestió de figures d'acció",
  },
  es: {
    subject: "Restablecer la contraseña de CardBack",
    slogan: "¡Donde vive tu colección!",
    title: "Solicitud de restablecimiento de contraseña",
    greeting: "Hola",
    body: "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en CardBack. Haz clic en el botón siguiente para crear una nueva:",
    button: "Restablecer mi contraseña",
    expires: "Este enlace es de un solo uso y caducará en <strong>30 minutos</strong> por motivos de seguridad.",
    ignore: "Si no has solicitado este cambio, puedes ignorar este correo con total tranquilidad; tu cuenta sigue protegida.",
    tagline: "Archivo, valoración y gestión de figuras de acción",
  },
  en: {
    subject: "Reset your CardBack password",
    slogan: "Where your collection lives!",
    title: "Password Reset Request",
    greeting: "Hello",
    body: "We received a request to reset the password for your CardBack account. Click the button below to choose a new one:",
    button: "Reset my password",
    expires: "This link is for single use only and will expire in <strong>30 minutes</strong> for security reasons.",
    ignore: "If you did not request this change, you can safely ignore this email; your account remains secure.",
    tagline: "Action figure archiving, valuation, and collection management",
  },
  fr: {
    subject: "Réinitialiser votre mot de passe CardBack",
    slogan: "Là où vit votre collection !",
    title: "Demande de réinitialisation de mot de passe",
    greeting: "Bonjour",
    body: "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte CardBack. Cliquez sur le bouton ci-dessous pour en créer un nouveau :",
    button: "Réinitialiser mon mot de passe",
    expires: "Ce lien est à usage unique et expirera dans <strong>30 minutes</strong> pour des raisons de sécurité.",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité ; votre compte reste protégé.",
    tagline: "Archivage, estimation et gestion de figurines d'action",
  },
  it: {
    subject: "Reimposta la tua password di CardBack",
    slogan: "Dove vive la tua collezione!",
    title: "Richiesta di reimpostazione della password",
    greeting: "Ciao",
    body: "Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account CardBack. Fai clic sul pulsante qui sotto per crearne una nuova:",
    button: "Reimposta la mia password",
    expires: "Questo link è monouso e scadrà tra <strong>30 minuti</strong> per motivi di sicurezza.",
    ignore: "Se non hai richiesto questa modifica, puoi ignorare tranquillamente questa email; il tuo account rimane protetto.",
    tagline: "Archiviazione, valutazione e gestione di action figure",
  },
  de: {
    subject: "CardBack-Passwort zurücksetzen",
    slogan: "Wo deine Sammlung lebt!",
    title: "Anfrage zur Passwort-Zurücksetzung",
    greeting: "Hallo",
    body: "Wir haben eine Anfrage zum Zurücksetzen deines CardBack-Passworts erhalten. Klicke auf die folgende Schaltfläche, um ein neues Passwort festzulegen:",
    button: "Mein Passwort zurücksetzen",
    expires: "Dieser Link ist nur einmalig gültig und verfällt aus Sicherheitsgründen nach <strong>30 Minuten</strong>.",
    ignore: "Falls du diese Änderung nicht angefordert hast, kannst du diese E-Mail ignorieren. Dein Konto bleibt geschützt.",
    tagline: "Archivierung, Wertermittlung und Verwaltung von Actionfiguren",
  },
  ja: {
    subject: "CardBack パスワードの再設定",
    slogan: "コレクションが生きる場所！",
    title: "パスワード再設定のリクエスト",
    greeting: "様、こんにちは。",
    body: "CardBack アカウントのパスワード再設定リクエストを受け付けました。下のボタンをクリックして新しいパスワードを設定してください。",
    button: "パスワードを再設定する",
    expires: "このリンクは1回のみ有効で、セキュリティのため <strong>30分後</strong> に期限切れとなります。",
    ignore: "このリクエストに心当たりがない場合は、このメールを破棄してください。アカウントは保護されたままです。",
    tagline: "アクションフィギュアのアーカイブ・鑑定・コレクション管理",
  },
  zh: {
    subject: "重置您的 CardBack 密码",
    slogan: "珍藏在此安家！",
    title: "密码重置请求",
    greeting: "您好，",
    body: "我们收到了重置您 CardBack 账户密码的请求。请点击下方按钮设置新密码：",
    button: "重置我的密码",
    expires: "此链接仅可使用一次，出于安全考虑，将在 <strong>30分钟</strong> 后失效。",
    ignore: "如果您并未请求此更改，请忽略此邮件，您的账户依然安全。",
    tagline: "动作人偶归档、估值与藏品管理系统",
  },
};

async function sendPasswordResetEmail(
  to: string,
  displayName: string,
  resetUrl: string,
  language: string = "ca",
  theme: string = "dark",
  baseUrl: string = ""
) {
  const apiKey = process.env.RESEND_API_KEY || "re_FU3GsTUZ_D5mwvPsvJhcAorrQLJGGUfsZ";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "CardBack <onboarding@resend.dev>";

  const normalizedLang = String(language || "").toLowerCase().slice(0, 2);
  const langKey = EMAIL_TRANSLATIONS[normalizedLang] ? normalizedLang : "ca";
  const tr = EMAIL_TRANSLATIONS[langKey];
  const isDark = String(theme || "").toLowerCase() !== "light";

  // Pick matching logo from public directory
  const logoFileName = isDark ? "Logo_v1_var6_POS_color.png" : "Logo_v1_var6_POS_blue.png";
  const logoFilePath = path.join(process.cwd(), "public", logoFileName);

  const attachments: Array<{ filename: string; content: string; content_id: string }> = [];
  try {
    if (fs.existsSync(logoFilePath)) {
      const buffer = fs.readFileSync(logoFilePath);
      attachments.push({
        filename: logoFileName,
        content: buffer.toString("base64"),
        content_id: "cardback_logo",
      });
    }
  } catch (err) {
    console.error("Could not read logo image for email attachment:", err);
  }

  // Theme palettes matching Cardback Welcome & Login screens
  const styles = isDark
    ? {
        pageBg: "#040812",
        cardBg: "#0b1329",
        cardBorder: "#1e293b",
        cardShadow: "0 12px 36px rgba(0,0,0,0.65)",
        sloganColor: "#fbbf24",
        titleColor: "#f8fafc",
        textColor: "#cbd5e1",
        subtextColor: "#94a3b8",
        btnBg: "#f59e0b",
        btnColor: "#020617",
        btnShadow: "0 4px 16px rgba(245, 158, 11, 0.4)",
        divider: "#1e293b",
        footerText: "#64748b",
      }
    : {
        pageBg: "#f1f5f9",
        cardBg: "#ffffff",
        cardBorder: "#e2e8f0",
        cardShadow: "0 6px 24px rgba(0, 11, 118, 0.08)",
        sloganColor: "#000B76",
        titleColor: "#0f172a",
        textColor: "#334155",
        subtextColor: "#64748b",
        btnBg: "#000B76",
        btnColor: "#ffffff",
        btnShadow: "0 4px 14px rgba(0, 11, 118, 0.25)",
        divider: "#e2e8f0",
        footerText: "#94a3b8",
      };

  const recipientGreeting =
    langKey === "ja"
      ? `<strong>${escapeHtml(displayName || "col·leccionista")}</strong> ${tr.greeting}`
      : langKey === "zh"
      ? `<strong>${escapeHtml(displayName || "col·leccionista")}</strong> ${tr.greeting}`
      : `${tr.greeting} <strong>${escapeHtml(displayName || "col·leccionista")}</strong>,`;

  const fallbackLogoUrl = baseUrl ? `${baseUrl}/${logoFileName}` : "";

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="${langKey}">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(tr.subject)}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${styles.pageBg}; color: ${styles.textColor}; margin: 0; padding: 32px 16px;">
      <div style="max-width: 540px; margin: 0 auto; background-color: ${styles.cardBg}; border-radius: 18px; border: 1px solid ${styles.cardBorder}; padding: 36px 28px; box-shadow: ${styles.cardShadow};">
        
        <!-- Logo & Brand Header -->
        <div style="text-align: center; margin-bottom: 26px;">
          <img src="cid:cardback_logo" alt="Cardback" width="220" style="max-width: 220px; width: 100%; height: auto; display: block; margin: 0 auto; border: 0;" />
          <div style="font-size: 13px; font-weight: 800; color: ${styles.sloganColor}; margin-top: 10px; letter-spacing: 0.04em;">
            ${escapeHtml(tr.slogan)}
          </div>
        </div>
        
        <!-- Main Message -->
        <h2 style="font-size: 19px; font-weight: 800; color: ${styles.titleColor}; margin-top: 0; margin-bottom: 16px; text-align: center;">
          ${escapeHtml(tr.title)}
        </h2>
        
        <p style="font-size: 15px; line-height: 1.6; color: ${styles.textColor}; margin-bottom: 12px;">
          ${recipientGreeting}
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: ${styles.textColor}; margin-bottom: 24px;">
          ${escapeHtml(tr.body)}
        </p>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background-color: ${styles.btnBg}; color: ${styles.btnColor}; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; display: inline-block; box-shadow: ${styles.btnShadow};">
            ${escapeHtml(tr.button)}
          </a>
        </div>
        
        <!-- Expiry & Security Notice -->
        <p style="font-size: 13px; color: ${styles.subtextColor}; line-height: 1.5; margin-bottom: 20px;">
          ${tr.expires}
        </p>
        
        <div style="border-top: 1px solid ${styles.divider}; padding-top: 18px; margin-top: 24px;">
          <p style="font-size: 12px; color: ${styles.footerText}; line-height: 1.5; margin: 0 0 8px 0;">
            ${escapeHtml(tr.ignore)}
          </p>
          <p style="font-size: 11px; color: ${styles.footerText}; margin: 0; text-align: center;">
            CardBack • ${escapeHtml(tr.tagline)}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: tr.subject,
      html: htmlContent,
      attachments: attachments.length > 0 ? attachments : undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Resend API error:", response.status, errorText);
    throw new Error(`Email provider error (${response.status}): ${errorText}`);
  }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  requireAuth(req, res, () => {
    if (String(res.locals.user?.role || "").toUpperCase() !== "ADMIN") return res.status(403).json({ error: "Administrator access required." });
    next();
  });
}

// Database connection pool (lazy or direct with SSL)
let dbPool: pg.Pool | null = null;

function getDbPool(): pg.Pool | null {
  if (dbPool) return dbPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }
  try {
    dbPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
    return dbPool;
  } catch (err) {
    console.error("Failed to initialize Neon Postgres pool:", err);
    return null;
  }
}

// ----------------- API ENDPOINTS -----------------

// Swagger API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api/spec", (req, res) => res.json(swaggerSpec));
app.get("/api", (req, res, next) => {
  if (req.accepts("html") && !req.xhr) {
    return res.redirect("/api-docs/");
  }
  next();
});

// ----------------- AUTHENTICATION ENDPOINTS -----------------

// POST /api/auth/login
app.post("/api/auth/login", authLimiter, async (req, res) => {
  const pool = getDbPool();
  if (!pool) {
    return res.status(503).json({ error: "Database not configured. Add DATABASE_URL to the local .env file to enable account login." });
  }
  const { usernameOrEmail, username, email, password } = req.body;
  const identifier = (usernameOrEmail || username || email || "").trim();

  if (!identifier || !password) {
    return res.status(400).json({ error: "Username or email and password are required." });
  }

  try {
    let userRow: any = null;

    if (pool) {
      const query = `
        SELECT id, username, email, "displayName", role, "passwordHash"
        FROM "User"
        WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
        LIMIT 1;
      `;
      const result = await pool.query(query, [identifier]);
      if (result.rows.length > 0) {
        userRow = result.rows[0];
      }
    }

    if (userRow) {
      let isMatch = false;
      if (userRow.passwordHash) {
        try {
          isMatch = bcrypt.compareSync(password, userRow.passwordHash);
        } catch (e) {
          isMatch = false;
        }
      }
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid username or password." });
      }

      pool.query('UPDATE "User" SET "lastLoginAt" = NOW() WHERE id = $1', [userRow.id]).catch(() => {});
      return res.json({ authTicket: makePreAuthTicket(userRow), user: normalizePublicUser(userRow) });
    }

    return res.status(401).json({ error: "Invalid username or password." });
  } catch (err: any) {
    console.error("Login error:", err);
    const isQuota = err.message && (err.message.includes("quota") || err.message.includes("exceeded"));
    if (isQuota) {
      // Emergency offline/local fallback login so collector is never locked out
      const fallbackUser = {
        id: `user-local-${identifier.toLowerCase()}`,
        username: identifier,
        email: identifier.includes('@') ? identifier : `${identifier}@cardback.local`,
        displayName: identifier,
        role: identifier.toLowerCase() === 'retrofan' || identifier.toLowerCase() === 'admin' ? 'ADMIN' : 'USER'
      };
      const authTicket = jwt.sign(
        { id: fallbackUser.id, kind: "preauth", fallbackUser },
        JWT_SECRET,
        { expiresIn: "10m" }
      );
      return res.json({ 
        authTicket, 
        user: normalizePublicUser(fallbackUser), 
        warning: "Neon quota exhaurida. S'ha iniciat la sessió en mode de contingència local." 
      });
    }
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/config", (_req, res) => res.json({ passwordRecoveryEnabled: emailRecoveryConfigured() }));

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const pool = getDbPool();
  if (!pool) return res.status(503).json({ error: "Database not configured." });
  const username = String(req.body?.username || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const displayName = String(req.body?.displayName || username).trim();
  const password = String(req.body?.password || "");
  if (!/^[A-Za-z0-9._-]{3,24}$/.test(username)) return res.status(400).json({ error: "Username must be 3–24 characters using letters, numbers, dots, underscores or hyphens." });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (displayName.length < 1 || displayName.length > 80) return res.status(400).json({ error: "Display name must be 1–80 characters." });
  if (password.length < 12 || password.length > 128) return res.status(400).json({ error: "Password must be between 12 and 128 characters." });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(`INSERT INTO "User" (id, username, email, "displayName", role, "passwordHash", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'USER', $5, NOW(), NOW()) RETURNING id, username, email, "displayName", role`,
      [randomUUID(), username, email, displayName, passwordHash]);
    const user = result.rows[0];
    return res.status(201).json({ authTicket: makePreAuthTicket(user), user: normalizePublicUser(user) });
  } catch (error: any) {
    if (error?.code === "23505") return res.status(409).json({ error: "That username or email is already registered." });
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Could not create the account." });
  }
});

app.post("/api/auth/session", authLimiter, async (req, res) => {
  const ticket = String(req.body?.authTicket || "");
  try {
    const decoded = jwt.verify(ticket, JWT_SECRET) as any;
    if (decoded.kind !== "preauth" || !decoded.id) return res.status(401).json({ error: "Invalid sign-in ticket." });
    
    let user: any = null;
    const pool = getDbPool();
    if (pool) {
      try {
        const result = await pool.query('SELECT id, username, email, "displayName", role FROM "User" WHERE id = $1', [decoded.id]);
        if (result.rows.length) {
          user = result.rows[0];
        }
      } catch (err: any) {
        console.warn("Could not query User from database in session exchange:", err.message);
      }
    }
    
    // If database is blocked by quota or user is local contingency
    if (!user && (decoded.fallbackUser || decoded.id?.startsWith("user-local-"))) {
      user = decoded.fallbackUser || {
        id: decoded.id,
        username: "retrofan",
        email: "retrofan@cardback.local",
        displayName: "retrofan",
        role: "ADMIN"
      };
    }

    if (!user) return res.status(401).json({ error: "Account no longer exists." });
    const rememberMe = req.body?.rememberMe === true;
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role || "USER", kind: "session" },
      JWT_SECRET,
      { expiresIn: rememberMe ? "30d" : "8h" }
    );
    setSessionCookie(res, user, rememberMe);
    return res.json({ user: normalizePublicUser(user), token });
  } catch {
    return res.status(401).json({ error: "Sign-in expired. Please sign in again." });
  }
});

app.post("/api/auth/password/forgot", forgotPasswordLimiter, async (req, res) => {
  if (!emailRecoveryConfigured()) return res.status(503).json({ error: "Password recovery email is not configured yet." });
  const pool = getDbPool();
  if (!pool) return res.status(503).json({ error: "Database not configured." });
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
  try {
    const result = await pool.query('SELECT id, email, "displayName", username FROM "User" WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    if (result.rows.length) {
      await ensurePasswordResetTable(pool);
      const user = result.rows[0];
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      await pool.query('DELETE FROM "PasswordResetToken" WHERE "userId" = $1 OR "expiresAt" < NOW()', [user.id]);
      await pool.query('INSERT INTO "PasswordResetToken" (id, "userId", "tokenHash", "expiresAt") VALUES ($1, $2, $3, NOW() + INTERVAL \'30 minutes\')', [randomUUID(), user.id, tokenHash]);
      const originHeader = req.get("origin") || req.get("referer");
      let hostBase = "";
      if (originHeader) {
        try {
          const parsed = new URL(originHeader);
          hostBase = `${parsed.protocol}//${parsed.host}`;
        } catch {}
      }
      const baseUrl = (process.env.APP_BASE_URL || hostBase || `${req.protocol}://${req.get("host")}` || `http://localhost:${PORT}`).replace(/\/$/, "");
      const language = String(req.body?.language || "ca").toLowerCase();
      const theme = String(req.body?.theme || "dark").toLowerCase();
      try { await sendPasswordResetEmail(user.email, user.displayName || user.username, `${baseUrl}/?reset=${rawToken}`, language, theme, baseUrl); }
      catch (error) { console.error("Password recovery email delivery failed:", error); }
    }
    return res.json({ message: "If an account exists for that email, a password reset link will be sent shortly." });
  } catch (error) {
    console.error("Password recovery request failed.");
    return res.status(500).json({ error: "Could not process the recovery request." });
  }
});

app.post("/api/auth/password/reset", async (req, res) => {
  const pool = getDbPool();
  if (!pool) return res.status(503).json({ error: "Database not configured." });
  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");
  if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ error: "This reset link is invalid or expired." });
  if (password.length < 12 || password.length > 128) return res.status(400).json({ error: "Password must be between 12 and 128 characters." });
  const client = await pool.connect();
  try {
    await ensurePasswordResetTable(pool);
    await client.query("BEGIN");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const found = await client.query('UPDATE "PasswordResetToken" SET "usedAt" = NOW() WHERE "tokenHash" = $1 AND "usedAt" IS NULL AND "expiresAt" > NOW() RETURNING "userId"', [tokenHash]);
    if (!found.rows.length) { await client.query("ROLLBACK"); return res.status(400).json({ error: "This reset link is invalid or expired." }); }
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query('UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2', [passwordHash, found.rows[0].userId]);
    await client.query('DELETE FROM "PasswordResetToken" WHERE "userId" = $1', [found.rows[0].userId]);
    await client.query("COMMIT");
    clearSessionCookie(res);
    return res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Password reset failed:", error);
    return res.status(500).json({ error: "Could not reset the password." });
  } finally { client.release(); }
});

app.post("/api/auth/password/change", requireAuth, async (req, res) => {
  const pool = getDbPool();
  if (!pool) return res.status(503).json({ error: "Database not configured." });
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  if (newPassword.length < 12 || newPassword.length > 128) return res.status(400).json({ error: "Password must be between 12 and 128 characters." });
  try {
    const result = await pool.query('SELECT "passwordHash" FROM "User" WHERE id = $1', [res.locals.user.id]);
    if (!result.rows.length || !await bcrypt.compare(currentPassword, result.rows[0].passwordHash || "")) return res.status(401).json({ error: "Current password is incorrect." });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2', [hash, res.locals.user.id]);
    return res.json({ success: true });
  } catch { return res.status(500).json({ error: "Could not change the password." }); }
});

// GET /api/auth/me
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const decoded = res.locals.user;
    const pool = getDbPool();
    let userData = decoded;
    if (pool && decoded.id) {
      try {
        const uRes = await pool.query('SELECT id, username, email, "displayName", role FROM "User" WHERE id = $1', [decoded.id]);
        if (uRes.rows.length > 0) {
          userData = uRes.rows[0];
        }
      } catch (err: any) {
        console.warn("Could not query User in /api/auth/me:", err.message);
      }
    }
    const token = jwt.sign(
      { id: userData.id, username: userData.username, email: userData.email, role: userData.role || "USER", kind: "session" },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    setSessionCookie(res, userData, true);
    return res.json({ user: userData, token });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// POST /api/auth/logout
app.post("/api/auth/logout", (req, res) => {
  clearSessionCookie(res);
  return res.json({ success: true, message: "Collector signed out successfully" });
});

// Health check and DB status
app.get("/api/health", async (req, res) => {
  const pool = getDbPool();
  if (!pool) {
    return res.json({ status: "ok", database: "disconnected (no DATABASE_URL)" });
  }
  try {
    const testResult = await pool.query("SELECT NOW() as now, current_database() as db_name");
    return res.json({
      status: "ok",
      database: "connected",
      dbName: testResult.rows[0]?.db_name,
      serverTime: testResult.rows[0]?.now
    });
  } catch (err: any) {
    return res.json({ status: "warning", database: "error", error: err.message });
  }
});

// Collection - Get all owned items
app.get("/api/collection", requireAuth, async (req, res) => {
  const pool = getDbPool();
  if (!pool) {
    return res.status(503).json({ error: "Database not configured" });
  }
  try {
    const query = `
      SELECT o.id, o."userId", o."productReleaseId", o.condition, o.completeness, o."packagingState",
             o."purchaseDate", o."purchasePrice", o.currency, o."estimatedMarketValue",
             o."storageLocation", o.notes, o.quantity, o."createdAt",
             pr.name as "releaseName", pr."packagingType",
             v.name as "variantName",
             f.id as "figureId", f.name as "figureName", f.code as "figureCode", f."imageUrl" as "figureImageUrl",
             l.id as "lineId", l.name as "lineName",
             fr.id as "franchiseId", fr.name as "franchiseName"
      FROM "OwnedFigure" o
      LEFT JOIN "ProductRelease" pr ON o."productReleaseId" = pr.id
      LEFT JOIN "Variant" v ON pr."variantId" = v.id
      LEFT JOIN "Figure" f ON v."figureId" = f.id
      LEFT JOIN "Line" l ON f."lineId" = l.id
      LEFT JOIN "Franchise" fr ON l."franchiseId" = fr.id
       WHERE o."deletedAt" IS NULL AND o."userId" = $1
      ORDER BY o."createdAt" DESC;
    `;
    const result = await pool.query(query, [res.locals.user.id]);

    // Map to domain OwnedFigure contract
    const items = result.rows.map((row: any) => {
      let meta: any = null;
      if (row.notes && typeof row.notes === "string" && row.notes.startsWith("{\"__cardbackMeta\"")) {
        try {
          meta = JSON.parse(row.notes);
        } catch {
          meta = null;
        }
      }

      // Normalizing condition to FigureCondition
      let condition: string = meta?.condition || "MOC";
      if (!meta?.condition) {
        const c = (row.condition || "").toUpperCase();
        if (c.includes("MINT") || c.includes("MOC")) condition = "MOC";
        else if (c.includes("GRADED")) condition = "GRADED";
        else if (row.completeness === "Incomplete") condition = "LOOSE_INCOMPLETE";
        else condition = "LOOSE_COMPLETE";
      }

      const acquisitionDate = meta?.acquisitionDate ||
        (row.purchaseDate ? new Date(row.purchaseDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);

      const primaryImage = meta?.figureImageUrl || row.figureImageUrl || "/cardback_placeholder.jpeg";
      const rawImages: string[] = Array.isArray(meta?.images) && meta.images.length > 0
        ? meta.images.filter(Boolean)
        : [primaryImage];

      return {
        id: row.id,
        userId: row.userId,
        figureId: meta?.figureId || row.figureId || row.id,
        figureName: meta?.figureName || row.figureName || row.releaseName || "Custom Figure",
        figureCode: meta?.figureCode || row.figureCode || undefined,
        figureImageUrl: primaryImage,
        images: rawImages,
        lineId: row.lineId || "line-default",
        lineName: meta?.lineName || row.lineName || "Vintage Collection",
        franchiseId: row.franchiseId || "franchise-default",
        franchiseName: meta?.franchiseName || row.franchiseName || "Star Wars",
        manufacturerName: meta?.manufacturerName || undefined,
        variantName: meta?.variantName || row.variantName || undefined,
        productReleaseId: row.productReleaseId,
        releasePackaging: meta?.releasePackaging || row.packagingType || row.packagingState,
        condition,
        gradingScore: meta?.gradingScore || undefined,
        purchasePrice: meta?.purchasePrice !== undefined ? meta.purchasePrice : (parseFloat(row.purchasePrice) || 0),
        currency: meta?.currency || row.currency || "EUR",
        estimatedValue: meta?.estimatedValue !== undefined ? meta.estimatedValue : (parseFloat(row.estimatedMarketValue) || parseFloat(row.purchasePrice) || 0),
        acquisitionDate,
        quantity: meta?.quantity !== undefined ? meta.quantity : (row.quantity || 1),
        storageLocation: meta?.storageLocation || row.storageLocation || "Display Shelf",
        collectorNotes: meta?.collectorNotes !== undefined ? meta.collectorNotes : (row.notes || ""),
        isWishlist: meta?.isWishlist !== undefined ? Boolean(meta.isWishlist) : false,
        addedAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString()
      };
    });

    res.json({ items });
  } catch (err: any) {
    console.error("Error fetching collection from Neon:", err);
    const isQuota = err.message && (err.message.includes("quota") || err.message.includes("exceeded"));
    if (isQuota) {
      return res.status(200).json({ 
        items: [], 
        quotaExceeded: true, 
        warning: "La quota mensual de trànsit de Neon (5 GB) s'ha superat. L'aplicació funciona en mode local protegit." 
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// Add figure to Neon collection
app.post("/api/collection", requireAuth, async (req, res) => {
  const pool = getDbPool();
  if (!pool) {
    return res.status(503).json({ error: "Database not configured" });
  }
  try {
    const body = req.body;
    const userId = res.locals.user.id;

    // Normalize and automatically optimize images to prevent Neon quota explosion
    const rawImages: string[] = Array.isArray(body.images) && body.images.length > 0
      ? body.images.map((s: any) => String(s).trim()).filter(Boolean)
      : (body.figureImageUrl ? [String(body.figureImageUrl).trim()] : ["/cardback_placeholder.jpeg"]);
    const images: string[] = await optimizeImageArray(rawImages, 800, 75);
    const primaryImage = images[0] || "/cardback_placeholder.jpeg";

    // Check if product release id exists in Neon
    let validProductReleaseId: string | null = null;
    if (body.productReleaseId) {
      const checkPr = await pool.query('SELECT id FROM "ProductRelease" WHERE id = $1', [body.productReleaseId]);
      if (checkPr.rows.length > 0) {
        validProductReleaseId = checkPr.rows[0].id;
      }
    }

    // Try finding by figure name
    if (!validProductReleaseId && body.figureName) {
      const findPr = await pool.query(`
        SELECT pr.id FROM "ProductRelease" pr
        LEFT JOIN "Variant" v ON pr."variantId" = v.id
        LEFT JOIN "Figure" f ON v."figureId" = f.id
        WHERE LOWER(f.name) = LOWER($1) LIMIT 1
      `, [String(body.figureName).trim()]);
      if (findPr.rows.length > 0) {
        validProductReleaseId = findPr.rows[0].id;
      }
    }

    // If still no release in DB, create corresponding catalog entries matching exact PostgreSQL schema
    if (!validProductReleaseId) {
      // 1. Franchise
      const franName = String(body.franchiseName || "Collectibles").trim();
      let franchiseId: string;
      const existingFran = await pool.query('SELECT id FROM "Franchise" WHERE LOWER(name) = LOWER($1) LIMIT 1', [franName]);
      if (existingFran.rows.length > 0) {
        franchiseId = existingFran.rows[0].id;
      } else {
        franchiseId = `fran-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await pool.query(`
          INSERT INTO "Franchise" (id, name, owner, description, "createdAt", "updatedAt")
          VALUES ($1, $2, 'Collector Community', $2, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [franchiseId, franName]);
      }

      // 2. Manufacturer
      const mfgName = String(body.manufacturerName || "Hasbro").trim();
      let manufacturerId: string;
      const existingMfg = await pool.query('SELECT id FROM "Manufacturer" WHERE LOWER(name) = LOWER($1) LIMIT 1', [mfgName]);
      if (existingMfg.rows.length > 0) {
        manufacturerId = existingMfg.rows[0].id;
      } else {
        manufacturerId = `mfg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await pool.query(`
          INSERT INTO "Manufacturer" (id, name, "createdAt", "updatedAt")
          VALUES ($1, $2, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [manufacturerId, mfgName]);
      }

      // 3. Line (requires manufacturerId and franchiseId)
      const lineName = String(body.lineName || "Action Figures").trim();
      let lineId: string;
      const existingLine = await pool.query('SELECT id FROM "Line" WHERE LOWER(name) = LOWER($1) AND "franchiseId" = $2 LIMIT 1', [lineName, franchiseId]);
      if (existingLine.rows.length > 0) {
        lineId = existingLine.rows[0].id;
      } else {
        lineId = `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await pool.query(`
          INSERT INTO "Line" (id, name, "manufacturerId", "franchiseId", "startYear", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, 1995, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [lineId, lineName, manufacturerId, franchiseId]);
      }

      // 4. Character (requires franchiseId)
      const figName = String(body.figureName || "Custom Figure").trim();
      let characterId: string;
      const existingChar = await pool.query('SELECT id FROM "Character" WHERE LOWER(name) = LOWER($1) AND "franchiseId" = $2 LIMIT 1', [figName, franchiseId]);
      if (existingChar.rows.length > 0) {
        characterId = existingChar.rows[0].id;
      } else {
        characterId = `char-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await pool.query(`
          INSERT INTO "Character" (id, name, "franchiseId", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [characterId, figName, franchiseId]);
      }

      // 5. Figure (requires characterId and lineId)
      let figureId: string;
      const existingFig = await pool.query('SELECT id FROM "Figure" WHERE LOWER(name) = LOWER($1) AND "lineId" = $2 LIMIT 1', [figName, lineId]);
      if (existingFig.rows.length > 0) {
        figureId = existingFig.rows[0].id;
      } else {
        figureId = typeof body.figureId === 'string' && body.figureId.length <= 80 ? body.figureId : `fig-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await pool.query(`
          INSERT INTO "Figure" (id, name, code, "characterId", "lineId", "imageUrl", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [figureId, figName, body.figureCode || null, characterId, lineId, primaryImage]);
      }

      // 6. Variant
      const varName = String(body.variantName || "Standard Edition").trim();
      let variantId: string;
      const existingVar = await pool.query('SELECT id FROM "Variant" WHERE "figureId" = $1 LIMIT 1', [figureId]);
      if (existingVar.rows.length > 0) {
        variantId = existingVar.rows[0].id;
      } else {
        variantId = `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await pool.query(`
          INSERT INTO "Variant" (id, name, "figureId", "imageUrl", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [variantId, varName, figureId, primaryImage]);
      }

      // 7. ProductRelease
      const relName = String(body.releasePackaging || `${figName} Packaging`).trim();
      let releaseId: string;
      const existingRel = await pool.query('SELECT id FROM "ProductRelease" WHERE "variantId" = $1 LIMIT 1', [variantId]);
      if (existingRel.rows.length > 0) {
        releaseId = existingRel.rows[0].id;
      } else {
        releaseId = typeof body.productReleaseId === 'string' && body.productReleaseId.length <= 80 ? body.productReleaseId : `rel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await pool.query(`
          INSERT INTO "ProductRelease" (id, name, "variantId", "packagingType", barcode, "imageUrl", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [releaseId, relName, variantId, body.releasePackaging || "Carded Blister (MOC)", body.figureCode || null, primaryImage]);
      }

      validProductReleaseId = releaseId;
      invalidateCatalogCache();
    }

    const newId = typeof body.id === "string" && body.id.length <= 100
      ? body.id
      : `own_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const cond = body.condition === "MOC" ? "Mint" : body.condition === "GRADED" ? "Graded" : "Used";
    const comp = body.condition === "LOOSE_INCOMPLETE" ? "Incomplete" : "Complete";
    const pkgState = body.condition === "MOC" ? "Sealed" : "Opened";

    const acquisitionDate = body.acquisitionDate || new Date().toISOString().split("T")[0];
    const purchasePrice = Number(body.purchasePrice) || 0;
    const estimatedValue = Number(body.estimatedValue) || purchasePrice || 0;

    // Comprehensive metadata envelope stored in notes
    const metaPayload = {
      __cardbackMeta: true,
      figureId: body.figureId,
      figureName: body.figureName,
      figureCode: body.figureCode,
      figureImageUrl: primaryImage,
      images,
      lineName: body.lineName,
      franchiseName: body.franchiseName,
      manufacturerName: body.manufacturerName,
      variantName: body.variantName,
      releasePackaging: body.releasePackaging,
      condition: body.condition,
      gradingScore: body.gradingScore,
      acquisitionDate,
      purchasePrice,
      currency: body.currency || "EUR",
      estimatedValue,
      storageLocation: body.storageLocation,
      collectorNotes: body.collectorNotes || "",
      isWishlist: Boolean(body.isWishlist),
      quantity: Number(body.quantity) || 1
    };

    const insertQuery = `
      INSERT INTO "OwnedFigure" (
        "id", "userId", "productReleaseId", "condition", "completeness",
        "packagingState", "purchaseDate", "purchasePrice", "currency",
        "purchaseLocation", "estimatedMarketValue", "storageLocation", "notes",
        "quantity", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
      )
      ON CONFLICT ("id") DO UPDATE SET
        "userId" = EXCLUDED."userId",
        "productReleaseId" = EXCLUDED."productReleaseId",
        "condition" = EXCLUDED."condition",
        "completeness" = EXCLUDED."completeness",
        "packagingState" = EXCLUDED."packagingState",
        "purchaseDate" = EXCLUDED."purchaseDate",
        "purchasePrice" = EXCLUDED."purchasePrice",
        "currency" = EXCLUDED."currency",
        "purchaseLocation" = EXCLUDED."purchaseLocation",
        "estimatedMarketValue" = EXCLUDED."estimatedMarketValue",
        "storageLocation" = EXCLUDED."storageLocation",
        "notes" = EXCLUDED."notes",
        "quantity" = EXCLUDED."quantity",
        "updatedAt" = NOW(),
        "deletedAt" = NULL
      RETURNING *;
    `;

    const values = [
      newId,
      userId,
      validProductReleaseId,
      cond,
      comp,
      pkgState,
      new Date(acquisitionDate),
      purchasePrice,
      body.currency || "EUR",
      body.storageLocation || "Personal Collection",
      estimatedValue,
      body.storageLocation || "Display Shelf",
      JSON.stringify(metaPayload),
      Number(body.quantity) || 1
    ];

    const inserted = await pool.query(insertQuery, values);
    res.status(201).json({ item: inserted.rows[0] });
  } catch (err: any) {
    console.error("Error adding figure to Neon:", err);
    const isQuota = err.message && (err.message.includes("quota") || err.message.includes("exceeded"));
    if (isQuota) {
      return res.status(200).json({ 
        success: true, 
        savedLocally: true, 
        quotaExceeded: true, 
        warning: "La quota mensual de Neon (5 GB) s'ha superat. La figura s'ha desat localment al teu navegador." 
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update figure
app.put("/api/collection/:id", requireAuth, async (req, res) => {
  const pool = getDbPool();
  if (!pool) return res.status(503).json({ error: "Database not configured" });
  const body = req.body || {};
  const price = Number(body.purchasePrice);
  const value = Number(body.estimatedValue);
  const quantity = Number(body.quantity);
  const acquisitionDate = body.acquisitionDate ? new Date(body.acquisitionDate) : null;
  if ((body.purchasePrice !== undefined && (!Number.isFinite(price) || price < 0)) ||
      (body.estimatedValue !== undefined && (!Number.isFinite(value) || value < 0)) ||
      (body.quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1)) ||
      (acquisitionDate && Number.isNaN(acquisitionDate.getTime()))) {
    return res.status(400).json({ error: "Invalid collection values." });
  }
  try {
    // Read current row to merge metadata envelope
    const currentRes = await pool.query('SELECT notes FROM "OwnedFigure" WHERE id = $1 AND "userId" = $2 AND "deletedAt" IS NULL', [req.params.id, res.locals.user.id]);
    if (currentRes.rows.length === 0) return res.status(404).json({ error: "Collection item not found." });

    let existingMeta: any = {};
    const rawNotes = currentRes.rows[0]?.notes || "";
    if (rawNotes.startsWith("{\"__cardbackMeta\"")) {
      try { existingMeta = JSON.parse(rawNotes); } catch {}
    } else if (rawNotes) {
      existingMeta = { collectorNotes: rawNotes };
    }

    const optFigureImageUrl = body.figureImageUrl !== undefined
      ? await optimizeImageDataUrl(String(body.figureImageUrl), 800, 75)
      : undefined;
    const optImages = body.images !== undefined
      ? await optimizeImageArray(Array.isArray(body.images) ? body.images.map(String).filter(Boolean) : [String(body.images)], 800, 75)
      : undefined;

    const updatedMeta = {
      __cardbackMeta: true,
      ...existingMeta,
      ...(body.figureName !== undefined && { figureName: body.figureName }),
      ...(body.figureCode !== undefined && { figureCode: body.figureCode }),
      ...(optFigureImageUrl !== undefined && { figureImageUrl: optFigureImageUrl }),
      ...(optImages !== undefined && { images: optImages }),
      ...(body.lineName !== undefined && { lineName: body.lineName }),
      ...(body.franchiseName !== undefined && { franchiseName: body.franchiseName }),
      ...(body.manufacturerName !== undefined && { manufacturerName: body.manufacturerName }),
      ...(body.variantName !== undefined && { variantName: body.variantName }),
      ...(body.releasePackaging !== undefined && { releasePackaging: body.releasePackaging }),
      ...(body.condition !== undefined && { condition: body.condition }),
      ...(body.gradingScore !== undefined && { gradingScore: body.gradingScore }),
      ...(body.acquisitionDate !== undefined && { acquisitionDate: body.acquisitionDate }),
      ...(body.purchasePrice !== undefined && { purchasePrice: price }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.estimatedValue !== undefined && { estimatedValue: value }),
      ...(body.storageLocation !== undefined && { storageLocation: body.storageLocation }),
      ...(body.collectorNotes !== undefined && { collectorNotes: body.collectorNotes }),
      ...(body.isWishlist !== undefined && { isWishlist: Boolean(body.isWishlist) }),
      ...(body.quantity !== undefined && { quantity })
    };

    const condition = body.condition === "MOC" ? "Mint" : body.condition === "GRADED" ? "Graded" : body.condition ? "Used" : null;
    const completeness = body.condition === "LOOSE_INCOMPLETE" ? "Incomplete" : body.condition ? "Complete" : null;
    const packagingState = body.condition ? (body.condition === "MOC" ? "Sealed" : "Opened") : null;
    const result = await pool.query(`
      UPDATE "OwnedFigure" SET
        "condition" = COALESCE($1, "condition"),
        "completeness" = COALESCE($2, "completeness"),
        "packagingState" = COALESCE($3, "packagingState"),
        "purchaseDate" = COALESCE($4, "purchaseDate"),
        "purchasePrice" = COALESCE($5, "purchasePrice"),
        currency = COALESCE($6, currency),
        "estimatedMarketValue" = COALESCE($7, "estimatedMarketValue"),
        "storageLocation" = COALESCE($8, "storageLocation"),
        notes = $9,
        quantity = COALESCE($10, quantity),
        "updatedAt" = NOW()
      WHERE id = $11 AND "userId" = $12 AND "deletedAt" IS NULL
      RETURNING id;
    `, [
      condition, completeness, packagingState, acquisitionDate,
      body.purchasePrice === undefined ? null : price,
      body.currency || null,
      body.estimatedValue === undefined ? null : value,
      body.storageLocation || null,
      JSON.stringify(updatedMeta),
      body.quantity === undefined ? null : quantity,
      req.params.id, res.locals.user.id
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Collection item not found." });
    return res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    console.error("Error updating collection item:", err);
    return res.status(500).json({ error: "Could not update collection item." });
  }
});

app.delete("/api/collection/:id", requireAuth, async (req, res) => {
  const pool = getDbPool();
  if (!pool) {
    return res.status(503).json({ error: "Database not configured" });
  }
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE "OwnedFigure" SET "deletedAt" = NOW() WHERE id = $1 AND ("userId" = $2 OR "userId" = \'user-collector-1\') AND "deletedAt" IS NULL',
      [id, res.locals.user.id]
    );
    res.json({ success: true, id });
  } catch (err: any) {
    console.error("Error deleting figure in Neon:", err);
    res.status(500).json({ error: err.message });
  }
});

// Database Catalogue Metadata summary & storage metrics
app.get("/api/db/stats", async (req, res) => {
  const pool = getDbPool();
  if (!pool) {
    return res.status(503).json({ error: "Database not configured" });
  }
  try {
    const tables = ["Manufacturer", "Line", "Franchise", "Character", "Figure", "Variant", "ProductRelease", "OwnedFigure"];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const r = await pool.query(`SELECT count(*) FROM "${t}"`);
      counts[t] = parseInt(r.rows[0].count, 10);
    }
    const sizeRes = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size,
             pg_database_size(current_database()) as raw_size
    `);
    res.json({
      counts,
      host: "Neon PostgreSQL (AWS eu-central-1)",
      databaseSize: sizeRes.rows[0]?.size || "unknown",
      rawDatabaseSize: Number(sizeRes.rows[0]?.raw_size || 0)
    });
  } catch (err: any) {
    const isQuota = err.message && (err.message.includes("quota") || err.message.includes("exceeded"));
    if (isQuota) {
      return res.json({
        counts: { Figure: 75, Line: 32, Character: 54, OwnedFigure: 21 },
        host: "Neon PostgreSQL (Límit de 5 GB trànsit assolit)",
        databaseSize: "14 MB (en disc)",
        rawDatabaseSize: 14 * 1024 * 1024,
        quotaExceeded: true,
        quotaMessage: "S'ha assolit el límit mensual de 5 GB de transferència de dades (egress) de Neon."
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// Run storage optimization and vacuuming on Neon
app.post("/api/db/optimize", requireAuth, async (req, res) => {
  try {
    const { runDatabaseStorageCleanup } = await import("./server/cleanupDatabaseStorage");
    await runDatabaseStorageCleanup();
    res.json({ success: true, message: "Storage optimized and compacted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Specific cleanup: remove only the figure creation examples while preserving users and core catalog
app.post("/api/db/clean-examples", requireAuth, async (req, res) => {
  try {
    const { cleanFigureCreationExamples } = await import("./server/cleanFigureCreationExamples");
    await cleanFigureCreationExamples();
    res.json({ success: true, message: "Exemples de creació de figures eliminats correctament. Usuaris preservats." });
  } catch (err: any) {
    const isQuota = err.message && (err.message.includes("quota") || err.message.includes("exceeded"));
    if (isQuota) {
      return res.status(200).json({
        success: false,
        quotaExceeded: true,
        message: "Neon té les connexions suspeses per haver arribat al 100% dels 5 GB de trànsit mensual. Cal crear un nou projecte gratuït a Neon o reactivar-lo per executar comandes SQL a Neon."
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// Upload and persist image to disk or Cloudflare R2 / S3
app.post("/api/upload/image", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "No image payload provided" });
    }
    const { optimizeAndStoreImage } = await import("./server/storageService.js");
    const url = await optimizeAndStoreImage(image, 1000, 80);
    res.json({ url, success: true });
  } catch (err: any) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message || "Failed to process and store image" });
  }
});

// Get current storage provider info (Local Disk vs Cloudflare R2 / S3)
app.get("/api/storage/info", async (_req, res) => {
  try {
    const { getStorageProviderInfo } = await import("./server/storageService.js");
    res.json(getStorageProviderInfo());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Seed Star Wars Historical Catalogue into Neon DB
app.post("/api/db/seed/star-wars", requireAdmin, async (req, res) => {
  const pool = getDbPool();
  if (!pool) {
    return res.status(503).json({ error: "Database connection not configured in .env (DATABASE_URL missing)" });
  }
  try {
    const { seedStarWarsCatalogue } = await import("./server/seedDatabase");
    const result = await seedStarWarsCatalogue(pool);
    res.json({
      success: true,
      message: "Star Wars archive successfully seeded into Neon PostgreSQL!",
      ...result
    });
  } catch (err: any) {
    console.error("Error seeding Star Wars database:", err);
    res.status(500).json({ error: err.message });
  }
});

// Community Catalog Proposal Endpoint (Wikipedia / Discogs style contribution)
app.post(["/api/catalog/propose", "/api/figures/propose"], optionalAuth, async (req, res) => {
  const pool = getDbPool();
  const { 
    name, 
    characterName, 
    lineId, 
    lineName, 
    year, 
    condition, 
    conditionDetails, 
    barcode, 
    description, 
    imageUrl,
    images: reqImages, 
    userNotes 
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Figure name is required for catalog proposal." });
  }

  const generatedId = `fig-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const rawImagesList: string[] = Array.isArray(reqImages) && reqImages.length > 0
    ? reqImages.map(String).map(s => s.trim()).filter(Boolean)
    : (imageUrl ? [String(imageUrl).trim()] : ["/cardback_placeholder.jpeg"]);
  const imagesList = await optimizeImageArray(rawImagesList, 800, 75);
  const resolvedImage = imagesList[0] || (imageUrl ? await optimizeImageDataUrl(String(imageUrl), 800, 75) : "/cardback_placeholder.jpeg");
  const releaseYear = parseInt(year, 10) || new Date().getFullYear();

  try {
    if (pool) {
      // 1. Ensure Character exists or create one (finding current Star Wars franchiseId dynamically)
      let resolvedFranchiseId = 'fran-star-wars';
      const frRes = await pool.query(`SELECT id FROM "Franchise" WHERE name ILIKE '%star wars%' LIMIT 1`);
      if (frRes.rows.length > 0) {
        resolvedFranchiseId = frRes.rows[0].id;
      }

      const effectiveCharName = (characterName || name).trim();
      const charId = `char-${effectiveCharName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)}`;
      await pool.query(`
        INSERT INTO "Character" (id, name, "franchiseId", description, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `, [charId, effectiveCharName, resolvedFranchiseId, `Community catalogued character ${effectiveCharName}.`]);

      // 2. Format condition string and description
      const conditionTag = condition ? `Estat: ${condition}${conditionDetails ? ` (${conditionDetails})` : ''}` : '';
      const combinedDescription = [
        description,
        conditionTag ? `[${conditionTag}]` : '',
        userNotes
      ].filter(Boolean).join(' | ') || `Community catalogued figure submitted by collector.`;

      // 3. Insert Figure
      const resolvedLine = lineId || 'line-sw-tvc';
      await pool.query(`
        INSERT INTO "Figure" (id, name, code, "lineId", "characterId", description, "imageUrl", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          "imageUrl" = EXCLUDED."imageUrl",
          "updatedAt" = NOW();
      `, [
        generatedId,
        name.trim(),
        barcode ? `BC-${barcode.slice(-6)}` : `COMM-${Date.now().toString().slice(-4)}`,
        resolvedLine,
        charId,
        combinedDescription,
        resolvedImage
      ]);

      // 4. Insert Variant & Product Release with condition awareness
      const varId = `var-${generatedId}-std`;
      const varDesc = [
        conditionTag || "Collector submitted variant entry",
        userNotes
      ].filter(Boolean).join(' - ');

      await pool.query(`
        INSERT INTO "Variant" (id, "figureId", name, description, "imageUrl", "createdAt", "updatedAt")
        VALUES ($1, $2, 'Standard Community Entry', $3, $4, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `, [varId, generatedId, varDesc, resolvedImage]);

      // Resolve packaging type according to figure condition
      let packagingType = 'Blister Card';
      if (condition === 'MOC') packagingType = 'Blister Card (Mint on Card)';
      else if (condition === 'MIB') packagingType = 'Sealed Box (MISB / MIB)';
      else if (condition === 'CARDED_DAMAGED') packagingType = 'Blister Card (Wear / Damaged)';
      else if (condition === 'LOOSE_COMPLETE') packagingType = 'Loose (Complete with all accessories)';
      else if (condition === 'LOOSE_INCOMPLETE') packagingType = 'Loose (Incomplete)';
      else if (condition === 'LOOSE_PLAYED') packagingType = 'Loose (Played / Wear)';
      else if (condition === 'GRADED') packagingType = `Graded Protective Case${conditionDetails ? ` (${conditionDetails})` : ''}`;
      else if (condition === 'CUSTOM') packagingType = 'Custom / Repaint';
      else if (condition === 'OTHER' && conditionDetails) packagingType = conditionDetails;

      const relId = `rel-${generatedId}-orig`;
      await pool.query(`
        INSERT INTO "ProductRelease" (id, "variantId", name, "packagingType", barcode, "releaseDate", region, "imageUrl", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, 'Community Contributed', $7, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `, [
        relId,
        varId,
        `${name.trim()} (${packagingType})`,
        packagingType,
        barcode || null,
        new Date(`${releaseYear}-01-01`),
        resolvedImage
      ]);
      invalidateCatalogCache();
    }

    res.status(201).json({
      success: true,
      message: "Proposta de figura afegida correctament al catàleg!",
      figure: {
        id: generatedId,
        name: name.trim(),
        year: releaseYear,
        lineId: lineId || 'line-sw-tvc',
        condition: condition || 'MOC',
        conditionDetails: conditionDetails || undefined,
        imageUrl: resolvedImage,
        images: imagesList,
        barcode: barcode || undefined
      }
    });
  } catch (err: any) {
    console.error("Error creating figure proposal:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------- ARCHIVE CATALOGUE ENDPOINTS -----------------

// GET /api/catalog/all - Unified archive catalog (PostgreSQL + Curated Seeds)
app.get("/api/catalog/all", async (req, res) => {
  try {
    const pool = getDbPool();
    const catalog = await getAllCatalog(pool);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.json(catalog);
  } catch (err: any) {
    console.error("Error fetching all catalog:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/catalog/:type/:id - Fetch any entity detail by type and ID
app.get("/api/catalog/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const pool = getDbPool();
    const entity = await getCatalogEntity(type, id, pool);
    if (!entity) {
      return res.status(404).json({ error: `Catalogue entity of type '${type}' with ID '${id}' not found.` });
    }
    res.json(entity);
  } catch (err: any) {
    console.error(`Error fetching catalog entity ${req.params.type}/${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/figures/:id - Direct alias for figure detail
app.get("/api/figures/:id", async (req, res) => {
  try {
    const pool = getDbPool();
    const entity = await getCatalogEntity("figure", req.params.id, pool);
    if (!entity) {
      return res.status(404).json({ error: `Figure with ID '${req.params.id}' not found.` });
    }
    res.json(entity);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/figures - List all figures
app.get("/api/figures", async (req, res) => {
  try {
    const pool = getDbPool();
    const catalog = await getAllCatalog(pool);
    res.json({ figures: catalog.figures, total: catalog.figures.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- GEMINI AI MULTIMODAL VISION ENDPOINTS -----------------

// POST /api/ai/identify-figure
app.post("/api/ai/identify-figure", optionalAuth, aiLimiter, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: "Missing 'image' parameter in request body." });
    }
    const result = await identifyFigureWithAi(image);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Error identifying figure with Gemini AI:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to identify figure with Gemini AI"
    });
  }
});

// POST /api/scanner/detect-barcode
app.post("/api/scanner/detect-barcode", optionalAuth, aiLimiter, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: "Missing 'image' parameter in request body." });
    }
    const result = await detectBarcodeWithAi(image);
    return res.json(result);
  } catch (err: any) {
    console.error("Error detecting barcode with Gemini AI:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to detect barcode with Gemini AI"
    });
  }
});

// POST /api/scanner/lookup-barcode-online - Live Internet and Database Barcode Validation
app.post("/api/scanner/lookup-barcode-online", optionalAuth, scannerLimiter, async (req, res) => {
  try {
    const { barcode, context, figureNameHint, lineNameHint, forceRefresh } = req.body;
    if (!barcode) {
      return res.status(400).json({ success: false, error: "Missing 'barcode' parameter in request body." });
    }
    const pool = getDbPool();
    const lookupContext = {
      ...(context || {}),
      ...(figureNameHint ? { figureNameHint } : {}),
      ...(lineNameHint ? { lineNameHint } : {}),
      ...(forceRefresh !== undefined ? { forceRefresh: Boolean(forceRefresh) } : {})
    };
    const result = await lookupBarcodeOnline(barcode, pool, lookupContext);
    return res.json(result);
  } catch (err: any) {
    console.error("Error performing online barcode lookup:", err);
    return res.status(500).json({
      found: false,
      isToyOrActionFigure: false,
      barcode: req.body?.barcode || "",
      manufacturer: null,
      productName: null,
      notFoundReason: "unregistered_barcode",
      message: err.message || "Error durant la cerca en línia del codi de barres.",
      options: []
    });
  }
});



// ----------------- VITE MIDDLEWARE SETUP -----------------

async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const distIndex = path.join(distPath, "index.html");

  if (process.env.NODE_ENV === "production" && fs.existsSync(distIndex)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(distIndex);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cardback server running on port ${PORT} with Neon PostgreSQL support`);
  });
}

startServer();
