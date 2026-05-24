interface AuthViewElements {
  fields: HTMLElement;
  help: HTMLElement;
  result: HTMLElement;
  resultText: HTMLElement;
  status: HTMLElement;
  title: HTMLElement;
  emailInput: HTMLInputElement;
  sendLinkButton: HTMLButtonElement;
  sendLinkLabel: HTMLElement;
}

export class AuthView {
  constructor(private readonly elements: AuthViewElements) {}

  setMagicLinkPending(pending: boolean): void {
    this.elements.emailInput.disabled = pending;
    this.elements.sendLinkButton.disabled = pending;
    this.elements.sendLinkButton.setAttribute("aria-busy", String(pending));
    this.elements.sendLinkLabel.textContent = pending ? "Sending..." : "Request sign-in link";
  }

  showForm(message = "", error = false): void {
    this.elements.title.textContent = "Sign in";
    this.elements.help.textContent = "Enter your email to request a sign-in link.";
    this.elements.help.hidden = false;
    this.elements.fields.hidden = false;
    this.elements.result.hidden = true;
    this.elements.resultText.textContent = "";
    this.setStatus(message, error);
    this.setMagicLinkPending(false);
    this.elements.emailInput.focus();
  }

  showResult(message: string, error = false): void {
    this.elements.title.textContent = error ? "Sign in" : "Request received";
    this.elements.help.hidden = true;
    this.elements.fields.hidden = true;
    this.elements.result.hidden = false;
    this.elements.status.textContent = "";
    this.elements.status.hidden = true;
    this.elements.resultText.textContent = message;
    this.elements.resultText.style.color = error ? "#b42318" : "";
  }

  setStatus(message: string, error = false): void {
    this.elements.status.textContent = message;
    this.elements.status.hidden = !message;
    this.elements.status.style.color = error ? "#b42318" : "";
  }
}
