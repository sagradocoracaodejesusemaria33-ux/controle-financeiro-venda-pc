const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session_id") || "";
const statusText = document.getElementById("statusText");
const registrationCodeText = document.getElementById("registrationCodeText");
const licenseKeyText = document.getElementById("licenseKeyText");
const supportText = document.getElementById("supportText");
const copyLicenseButton = document.getElementById("copyLicenseButton");
const refreshButton = document.getElementById("refreshButton");

copyLicenseButton.addEventListener("click", async () => {
  const licenseKey = licenseKeyText.textContent.trim();
  if (!licenseKey || licenseKey === "-") {
    setSupport("A chave ainda nao esta pronta.", false);
    return;
  }

  try {
    await navigator.clipboard.writeText(licenseKey);
    setSupport("Chave copiada. Agora cole no programa.", true);
  } catch (_error) {
    setSupport("Nao foi possivel copiar automaticamente.", false);
  }
});

refreshButton.addEventListener("click", () => {
  loadLicense();
});

loadLicense();

async function loadLicense() {
  if (!sessionId) {
    statusText.textContent = "Sessao de pagamento nao encontrada.";
    return;
  }

  statusText.textContent = "Conferindo o pagamento e preparando sua chave...";

  try {
    const response = await fetch(`/api/session-license?session_id=${encodeURIComponent(sessionId)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel consultar sua compra.");
    }

    registrationCodeText.textContent = data.registrationCode || "-";
    licenseKeyText.textContent = data.licenseKey || "-";
    statusText.textContent = data.message;

    if (data.supportEmail) {
      setSupport(`Se precisar de ajuda: ${data.supportEmail}`, true);
    } else {
      setSupport("Copie a chave e cole no programa para liberar o acesso.", true);
    }
  } catch (error) {
    statusText.textContent = error.message || "Falha ao consultar o pagamento.";
    setSupport("", false);
  }
}

function setSupport(text, ok) {
  supportText.textContent = text || "";
  supportText.classList.toggle("ok", !!ok);
}
