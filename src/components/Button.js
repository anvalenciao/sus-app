class ButtonComponent extends HTMLElement {
  static get observedAttributes() {
    return ["size", "color", "text"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const size = this.getAttribute("size") || "medium";
    const color = this.getAttribute("color") || "blue";
    const text = this.getAttribute("text") || "send";

    const sizeStyles = {
      small: "padding: 4px 8px; font-size: 12px;",
      medium: "padding: 8px 16px; font-size: 16px;",
      large: "padding: 12px 24px; font-size: 20px;"
    }; 

    this.shadowRoot.innerHTML = `
      <style>
        button {
          background-color: ${color};
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          ${sizeStyles[size] || sizeStyles["medium"]}
        }
      </style>
      <button>${text}</button>
    `;
  }
}

customElements.define("button-component", ButtonComponent);
