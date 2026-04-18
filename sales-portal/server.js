import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import Stripe from "stripe";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 10000);
const PUBLIC_DIR = path.join(__dirname, "public");
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PRICE_ID = (process.env.STRIPE_PRICE_ID || "").trim();
const LICENSE_AMOUNT = Number(process.env.LICENSE_AMOUNT || 4990);
const LICENSE_CURRENCY = String(process.env.LICENSE_CURRENCY || "brl").toLowerCase();
const LICENSE_PRODUCT_NAME = process.env.LICENSE_PRODUCT_NAME || "Controle Financeiro Familiar";
const LICENSE_PRODUCT_DESCRIPTION =
  process.env.LICENSE_PRODUCT_DESCRIPTION || "Licenca definitiva do programa";
const LICENSE_SECRET = String(process.env.LICENSE_SECRET || "").trim();
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "";
const PAYMENT_METHOD_TYPES = String(process.env.CHECKOUT_PAYMENT_METHOD_TYPES || "card")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const transporter = buildMailer();

if (!LICENSE_SECRET) {
  console.warn("LICENSE_SECRET nao configurado. Defina a variavel no servidor antes de vender.");
}

app.set("trust proxy", true);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(400).json({ error: "Webhook nao configurado." });
    }

    const signature = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
          await deliverLicenseByEmail(event.data.object);
          break;
        default:
          break;
      }
      return res.json({ received: true });
    } catch (error) {
      console.error("Erro ao processar webhook:", error);
      return res.status(500).json({ error: "Falha ao processar webhook." });
    }
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(PUBLIC_DIR));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/public-config", (req, res) => {
  res.json({
    productName: LICENSE_PRODUCT_NAME,
    description: LICENSE_PRODUCT_DESCRIPTION,
    amount: LICENSE_AMOUNT,
    currency: LICENSE_CURRENCY,
    supportEmail: SUPPORT_EMAIL,
    publicBaseUrl: getPublicBaseUrl(req),
    checkoutReady: !!stripe
  });
});

app.post("/api/create-checkout-session", async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe nao configurado no servidor." });
  }

  const registrationCode = normalizeRegistrationCode(req.body.registrationCode);
  const customerEmail = String(req.body.email || "").trim().toLowerCase();
  const customerName = String(req.body.name || "").trim();

  if (!registrationCode) {
    return res.status(400).json({ error: "Informe o codigo de registro." });
  }

  if (!customerEmail || !customerEmail.includes("@")) {
    return res.status(400).json({ error: "Informe um email valido." });
  }

  try {
    const baseUrl = getPublicBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel.html`,
      customer_email: customerEmail,
      payment_method_types: PAYMENT_METHOD_TYPES,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        customerEmail,
        customerName,
        registrationCode
      },
      line_items: [buildLineItem()]
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Erro ao criar Checkout Session:", error);
    return res.status(500).json({ error: "Nao foi possivel iniciar a compra." });
  }
});

app.get("/api/session-license", async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe nao configurado no servidor." });
  }

  const sessionId = String(req.query.session_id || "").trim();
  if (!sessionId) {
    return res.status(400).json({ error: "session_id obrigatorio." });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return res.json(buildSessionPayload(session));
  } catch (error) {
    console.error("Erro ao consultar sessao:", error);
    return res.status(500).json({ error: "Nao foi possivel consultar a compra." });
  }
});


app.post("/api/validate-license", (req, res) => {
  const registrationCode = normalizeRegistrationCode(req.body.registrationCode);
  const licenseKey = normalizeLicense(req.body.licenseKey);

  if (!registrationCode || !licenseKey) {
    return res.status(400).json({ valid: false, error: "Informe o codigo de registro e a chave." });
  }

  if (!LICENSE_SECRET) {
    return res.status(500).json({ valid: false, error: "Servidor de licencas nao configurado." });
  }

  const expected = normalizeLicense(generateActivationKey(registrationCode));
  if (licenseKey !== expected) {
    return res.status(400).json({ valid: false, error: "Chave de ativacao invalida para este computador." });
  }

  return res.json({ valid: true, registrationCode });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sales portal running on http://0.0.0.0:${PORT}`);
});

function buildMailer() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

function getPublicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return trimTrailingSlash(process.env.PUBLIC_BASE_URL);
  }

  if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    return `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  }

  if (req) {
    return `${req.protocol}://${req.get("host")}`;
  }

  return `http://localhost:${PORT}`;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeRegistrationCode(value) {
  const cleaned = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

  return cleaned;
}

function normalizeLicense(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function licenseNumber(text, seed) {
  let total = seed;
  const raw = String(text || "");
  const mod = 4294967291;

  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    total = (total + code * (index + 17)) % mod;
    total = ((total * 131) + code) % mod;
  }

  return total;
}

function generateActivationKey(registrationCode) {
  if (!LICENSE_SECRET) {
    throw new Error("LICENSE_SECRET nao configurado.");
  }

  const cleaned = normalizeLicense(registrationCode);
  const part1 = licenseNumber(`${LICENSE_SECRET}|${cleaned}`, 7)
    .toString(36)
    .toUpperCase()
    .padStart(8, "0")
    .slice(-8);
  const part2 = licenseNumber(`${cleaned}|${LICENSE_SECRET}`, 11)
    .toString(36)
    .toUpperCase()
    .padStart(8, "0")
    .slice(-8);

  return `${part1}${part2}`.match(/.{1,4}/g).join("-");
}

function buildLineItem() {
  if (STRIPE_PRICE_ID) {
    return {
      price: STRIPE_PRICE_ID,
      quantity: 1
    };
  }

  return {
    quantity: 1,
    price_data: {
      currency: LICENSE_CURRENCY,
      unit_amount: LICENSE_AMOUNT,
      product_data: {
        name: LICENSE_PRODUCT_NAME,
        description: LICENSE_PRODUCT_DESCRIPTION
      }
    }
  };
}

function buildSessionPayload(session) {
  const registrationCode = normalizeRegistrationCode(session.metadata?.registrationCode || "");
  const paymentStatus = session.payment_status || "unpaid";
  const paid = paymentStatus === "paid";

  return {
    id: session.id,
    status: paid ? "paid" : paymentStatus,
    paymentStatus,
    customerEmail:
      session.customer_details?.email || session.customer_email || session.metadata?.customerEmail || "",
    customerName:
      session.customer_details?.name || session.metadata?.customerName || "",
    registrationCode,
    licenseKey: paid && registrationCode ? generateActivationKey(registrationCode) : "",
    supportEmail: SUPPORT_EMAIL,
    message: paid
      ? "Pagamento confirmado. Sua chave de ativacao ja esta pronta."
      : "Pagamento ainda nao foi confirmado. Atualize esta pagina em instantes."
  };
}

async function deliverLicenseByEmail(session) {
  if (!transporter) return;

  const payload = buildSessionPayload(session);
  if (!payload.licenseKey || !payload.customerEmail) return;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const supportLine = SUPPORT_EMAIL
    ? `Se precisar de ajuda, responda este email ou fale com ${SUPPORT_EMAIL}.`
    : "Se precisar de ajuda, responda este email.";

  await transporter.sendMail({
    from,
    to: payload.customerEmail,
    subject: "Sua chave - Controle Financeiro Familiar",
    text: [
      "Pagamento confirmado.",
      "",
      `Codigo de registro: ${payload.registrationCode}`,
      `Chave de ativacao: ${payload.licenseKey}`,
      "",
      "Abra o programa, cole a chave e clique em Liberar acesso.",
      supportLine
    ].join("\n")
  });
}
