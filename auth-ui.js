export const $ = id => document.getElementById(id);

export function showNotice(element, type, title, body) {
  if (!element) return;
  element.className = `inline-notice show ${type}`;
  element.replaceChildren();
  if (title) {
    const strong = document.createElement("strong");
    strong.textContent = title;
    element.appendChild(strong);
  }
  if (body) {
    const text = document.createElement("span");
    text.textContent = body;
    element.appendChild(text);
  }
  element.setAttribute("role", type === "error" ? "alert" : "status");
}

export function clearNotice(element) {
  if (!element) return;
  element.className = "inline-notice";
  element.replaceChildren();
  element.removeAttribute("role");
}

export function setButtonBusy(button, busy, label = "Please wait…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.innerHTML;
    button.innerHTML = `<span class="mini-spinner" aria-hidden="true"></span>${label}`;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  } else {
    if (button.dataset.originalLabel) button.innerHTML = button.dataset.originalLabel;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    delete button.dataset.originalLabel;
  }
}

export function wirePasswordToggles() {
  document.querySelectorAll("[data-toggle-password]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(reveal));
      button.textContent = reveal ? "Hide" : "Show";
    });
  });
}

export function renderPasswordRules(container, rules) {
  if (!container) return;
  container.replaceChildren();
  rules.forEach(rule => {
    const item = document.createElement("div");
    item.className = `rule${rule.met ? " met" : ""}`;
    const check = document.createElement("span");
    check.className = "rule-check";
    check.textContent = rule.met ? "✓" : "·";
    const label = document.createElement("span");
    label.textContent = rule.label;
    item.append(check, label);
    container.appendChild(item);
  });
}

export function strengthPercent(rules) {
  return Math.round((rules.filter(rule => rule.met).length / Math.max(1, rules.length)) * 100);
}

export function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
