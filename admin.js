document.addEventListener("DOMContentLoaded", () => {
  const loginSection = document.getElementById("admin-login-section");
  const panelSection = document.getElementById("admin-panel-section");
  const loginForm = document.getElementById("admin-login-form");
  const loginMessage = document.getElementById("admin-login-message");
  const productsList = document.getElementById("products-list");
  const productForm = document.getElementById("product-form");
  const productFormMessage = document.getElementById("product-form-message");
  const productFormResetBtn = document.getElementById("product-form-reset");

  const token = getToken();
  if (token) {
    showAdminPanel(loginSection, panelSection);
    loadProducts(productsList, token);
  }

  if (loginForm && loginMessage) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAdminFieldErrors(loginForm);
      setAdminMessage(loginMessage, "");

      const usernameInput = loginForm.elements.username;
      const passwordInput = loginForm.elements.password;

      if (!usernameInput.value.trim() || !passwordInput.value.trim()) {
        if (!usernameInput.value.trim()) {
          showAdminFieldError(
            "admin-username",
            "Username is required."
          );
        }
        if (!passwordInput.value.trim()) {
          showAdminFieldError(
            "admin-password",
            "Password is required."
          );
        }
        setAdminMessage(loginMessage, "Please fill in username and password.", false);
        return;
      }

      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            username: usernameInput.value.trim(),
            password: passwordInput.value.trim(),
          }),
        });

        if (!response.ok) {
          throw new Error("Login failed");
        }

        const data = await response.json();
        if (!data.token) {
          throw new Error("Missing token");
        }

        saveToken(data.token);
        setAdminMessage(loginMessage, "Login successful.", true);
        showAdminPanel(loginSection, panelSection);
        loadProducts(productsList, data.token);
      } catch (error) {
        console.error("Admin login error:", error);
        setAdminMessage(
          loginMessage,
          "Login failed. Please check your username/password.",
          false
        );
      }
    });
  }

  if (productForm && productFormMessage && productsList) {
    productForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAdminFieldErrors(productForm);
      setAdminMessage(productFormMessage, "");

      const tokenForRequest = getToken();
      if (!tokenForRequest) {
        setAdminMessage(
          productFormMessage,
          "You are not logged in. Please refresh the page and log in again.",
          false
        );
        return;
      }

      const id = productForm.elements.id.value || null;
      const name = productForm.elements.name.value.trim();
      const description = productForm.elements.description.value.trim();
      const priceRaw = productForm.elements.price.value;
      const category = productForm.elements.category.value.trim() || null;

      if (!name) {
        showAdminFieldError("product-name", "Name is required.");
      }
      if (!description) {
        showAdminFieldError(
          "product-description",
          "Description is required."
        );
      }
      if (!name || !description) {
        setAdminMessage(
          productFormMessage,
          "Please fill in the required fields.",
          false
        );
        return;
      }

      const price =
        priceRaw !== "" && !Number.isNaN(Number(priceRaw))
          ? Number(priceRaw)
          : null;

      const payload = {
        name,
        description,
        price,
        category,
      };

      const url = id ? `/api/products/${encodeURIComponent(id)}` : "/api/products";
      const method = id ? "PUT" : "POST";

      try {
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${tokenForRequest}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Product save failed");
        }

        await response.json();
        setAdminMessage(
          productFormMessage,
          id ? "Product updated." : "Product added.",
          true
        );
        productForm.reset();
        loadProducts(productsList, tokenForRequest);
      } catch (error) {
        console.error("Product save error:", error);
        setAdminMessage(
          productFormMessage,
          "Could not save the product. Please try again.",
          false
        );
      }
    });

    if (productFormResetBtn) {
      productFormResetBtn.addEventListener("click", () => {
        productForm.reset();
        productForm.elements.id.value = "";
        clearAdminFieldErrors(productForm);
        setAdminMessage(productFormMessage, "");
      });
    }
  }
});

function showAdminPanel(loginSection, panelSection) {
  if (loginSection) {
    loginSection.style.display = "none";
  }
  if (panelSection) {
    panelSection.style.display = "";
  }
}

function getToken() {
  try {
    return window.localStorage.getItem("adminToken");
  } catch {
    return null;
  }
}

function saveToken(token) {
  try {
    window.localStorage.setItem("adminToken", token);
  } catch (err) {
    console.warn("Could not save admin token to localStorage.", err);
  }
}

async function loadProducts(listElement, token) {
  if (!listElement) return;
  listElement.innerHTML = "<li>Loading products…</li>";

  try {
    const response = await fetch("/api/products", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error("Failed to load products");
    }
    const products = await response.json();
    renderProductsList(listElement, products, token);
  } catch (error) {
    console.error("Error loading products in admin:", error);
    listElement.innerHTML =
      "<li>Could not load products. Try refreshing the page.</li>";
  }
}

function renderProductsList(listElement, products, token) {
  if (!Array.isArray(products) || products.length === 0) {
    listElement.innerHTML = "<li>No products yet. Add your first card above.</li>";
    return;
  }

  listElement.innerHTML = "";

  products.forEach((product) => {
    const li = document.createElement("li");
    li.className = "admin-product-row";

    const main = document.createElement("div");
    main.className = "admin-product-main";

    const title = document.createElement("div");
    title.className = "admin-product-title";
    title.textContent = product.name || "(No name)";

    const meta = document.createElement("div");
    meta.className = "admin-product-meta";
    const priceText =
      typeof product.price === "number"
        ? `₹${product.price}`
        : "Price on request";
    const categoryText = product.category ? ` • ${product.category}` : "";
    meta.textContent = `${priceText}${categoryText}`;

    main.appendChild(title);
    main.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "admin-product-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.className = "btn btn-outline";
    editBtn.addEventListener("click", () => {
      loadProductIntoForm(product);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "btn btn-outline";
    deleteBtn.addEventListener("click", () => {
      if (!window.confirm("Delete this product?")) return;
      deleteProduct(product.id, token, listElement);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(main);
    li.appendChild(actions);
    listElement.appendChild(li);
  });
}

async function deleteProduct(id, token, listElement) {
  if (!id || !token) return;

  try {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Delete failed");
    }

    loadProducts(listElement, token);
  } catch (error) {
    console.error("Delete product error:", error);
    alert("Could not delete the product. Please try again.");
  }
}

function loadProductIntoForm(product) {
  const form = document.getElementById("product-form");
  if (!form) return;

  form.elements.id.value = product.id || "";
  form.elements.name.value = product.name || "";
  form.elements.description.value = product.description || "";
  form.elements.price.value =
    typeof product.price === "number" ? String(product.price) : "";
  form.elements.category.value = product.category || "";
}

function showAdminFieldError(id, message) {
  const errorElement = document.querySelector(`[data-error-for="${id}"]`);
  if (!errorElement) return;
  errorElement.textContent = message;
}

function clearAdminFieldErrors(root) {
  const errors = root.querySelectorAll(".field-error");
  errors.forEach((el) => {
    el.textContent = "";
  });
}

function setAdminMessage(target, message, isSuccess) {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("form-message--success", !!isSuccess && !!message);
  target.classList.toggle(
    "form-message--error",
    !isSuccess && !!message
  );
}

