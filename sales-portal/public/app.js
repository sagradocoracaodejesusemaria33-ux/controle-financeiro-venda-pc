const form = document.getElementById("checkoutForm");
const formMessage = document.getElementById("formMessage");
const priceText = document.getElementById("priceText");
const productDescription = document.getElementById("productDescription");
const registrationCodeInput = document.getElementById("registrationCode");
const params = new URLSearchParams(window.location.search);

if (params.get("registrationCode")) {
  registrationCodeInput.value = params.get("registrationCode");
}

loadConfig();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Abrindo pagamento seguro...", true);

  const payload = {
    email: document.getElementById("email").value.trim(),
    name: document.getElementById("name").value.trim(),
    registrationCode: registrationCodeInput.value.trim()
  };

  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Não foi possível iniciar a compra.");
    }

    window.location.href = data.url;
  } catch (error) {
    setMessage(error.message || "Falha ao iniciar o pagamento.", false);
  }
});

async function loadConfig() {
  try {
    const response = await fetch("/api/public-config");
    const data = await response.json();

    productDescription.textContent = data.description || "Licença definitiva do programa.";
    priceText.textContent = formatMoney(data.amount, data.currency);

    if (!data.checkoutReady) {
      setMessage("Pagamento ainda não configurado no servidor.", false);
    }
  } catch (_error) {
    priceText.textContent = "Consulte o suporte";
    productDescription.textContent = "Licença definitiva do programa.";
  }
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: String(currency || "BRL").toUpperCase()
  }).format(Number(amount || 0) / 100);
}

function setMessage(text, ok) {
  formMessage.textContent = text || "";
  formMessage.classList.toggle("ok", !!ok);
}
