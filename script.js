document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelectorAll(".site-nav a[href^='#']");
  const body = document.body;
  const form = document.getElementById("order-form");
  const formMessage = document.getElementById("form-message");

  if (navToggle) {
    navToggle.addEventListener("click", () => {
      const isOpen = body.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  if (navLinks.length > 0) {
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (body.classList.contains("nav-open")) {
          body.classList.remove("nav-open");
          if (navToggle) {
            navToggle.setAttribute("aria-expanded", "false");
          }
        }
      });
    });
  }

  const yearSpan = document.getElementById("current-year");
  if (yearSpan) {
    yearSpan.textContent = String(new Date().getFullYear());
  }

  loadProductsFromApi();

  if (form && formMessage) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      clearFieldErrors(form);
      resetFormMessage(formMessage);

      const { isValid, firstInvalidField } = validateForm(form);

      if (!isValid) {
        setFormMessage(
          formMessage,
          "Please check the highlighted fields and try again.",
          false
        );
        if (firstInvalidField && typeof firstInvalidField.focus === "function") {
          firstInvalidField.focus();
        }
        return;
      }

      submitOrder(form, formMessage);
    });
  }
});

async function loadProductsFromApi() {
  const cardsGrid = document.querySelector(".cards-grid");
  if (!cardsGrid) return;

  try {
    const response = await fetch("/api/products", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return;
    }

    const products = await response.json();
    if (!Array.isArray(products) || products.length === 0) {
      return;
    }

    const fragment = document.createDocumentFragment();

    products.forEach((product) => {
      const article = document.createElement("article");
      article.className = "card-item";

      const body = document.createElement("div");
      body.className = "card-body";

      const title = document.createElement("h3");
      title.textContent = product.name || "Card design";

      const desc = document.createElement("p");
      desc.textContent =
        product.description || "A beautiful handcrafted card design.";

      const meta = document.createElement("p");
      meta.className = "card-meta";
      if (typeof product.price === "number") {
        meta.textContent = `From ₹${product.price} per card`;
      } else {
        meta.textContent = "Price on request";
      }

      body.appendChild(title);
      body.appendChild(desc);
      body.appendChild(meta);

      article.appendChild(body);
      fragment.appendChild(article);
    });

    cardsGrid.innerHTML = "";
    cardsGrid.appendChild(fragment);
  } catch (error) {
    console.warn("Could not load products from API, using static content.", error);
  }
}

async function submitOrder(form, formMessage) {
  const payload = {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    phone: form.elements.phone.value.trim(),
    cardType: form.elements.cardType.value,
    quantity: form.elements.quantity.value
      ? Number(form.elements.quantity.value)
      : null,
    message: form.elements.message.value.trim(),
  };

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Request failed");
    }

    form.reset();
    setFormMessage(
      formMessage,
      "Thank you! Your order request has been sent. You and the admin will receive an email copy shortly.",
      true
    );
  } catch (error) {
    console.error("Error submitting order:", error);
    setFormMessage(
      formMessage,
      "We could not send your order automatically. Please email or message us directly using the contact details on this page.",
      false
    );
  }
}

function validateForm(form) {
  const requiredFields = ["name", "email", "message"];
  let isValid = true;
  let firstInvalidField = null;

  requiredFields.forEach((fieldName) => {
    const field = form.elements[fieldName];
    if (!field) return;

    if (!field.value.trim()) {
      isValid = false;
      if (!firstInvalidField) firstInvalidField = field;
      showFieldError(field, "This field is required.");
    }
  });

  const emailField = form.elements.email;
  if (emailField && emailField.value.trim()) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailField.value.trim())) {
      isValid = false;
      if (!firstInvalidField) firstInvalidField = emailField;
      showFieldError(emailField, "Please enter a valid email address.");
    }
  }

  const quantityField = form.elements.quantity;
  if (quantityField && quantityField.value) {
    const value = Number(quantityField.value);
    if (!Number.isFinite(value) || value < 1) {
      isValid = false;
      if (!firstInvalidField) firstInvalidField = quantityField;
      showFieldError(quantityField, "Quantity must be at least 1.");
    }
  }

  return { isValid, firstInvalidField };
}

function showFieldError(field, message) {
  const name = field.getAttribute("name");
  if (!name) return;
  const errorElement = document.querySelector(`[data-error-for="${name}"]`);
  if (!errorElement) return;
  errorElement.textContent = message;
}

function clearFieldErrors(form) {
  const errorElements = form.querySelectorAll(".field-error");
  errorElements.forEach((el) => {
    el.textContent = "";
  });
}

function setFormMessage(target, message, isSuccess) {
  target.textContent = message;
  target.classList.toggle("form-message--success", isSuccess);
  target.classList.toggle("form-message--error", !isSuccess);
}

function resetFormMessage(target) {
  target.textContent = "";
  target.classList.remove("form-message--success", "form-message--error");
}
