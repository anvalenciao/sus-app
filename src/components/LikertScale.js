class LikertScale extends HTMLElement {
  static get observedAttributes() {
    return ['question', 'min', 'max', 'low-score-label', 'high-score-label', 'required', 'question-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedOption = null; // Store the selected option
    this.logicRules = []; // Store logic rules

    // Create styles once
    const styles = /* CSS */`
      :host {display:block;}
      :host h3{font-weight:700;line-height:1.5em;font-size:1em;margin:0 0 0.5rem 0;overflow-wrap:break-word;color:var(--adl-survey-color)}
      :host .scale{display:flex;flex-direction:column;}
      :host .options{align-items:center;display:flex;flex-direction:row;gap:5px;height:45px;justify-content:space-between}
      :host label{color:var(--adl-survey-question-button-color);display:inline-block;flex:1;font-size:15px;height:40px;margin:0;padding:8px 0;width:auto;}
      :host input:checked+label span{background-color:var(--adl-survey-button-background-color);color:var(--adl-survey-button-color);border:1px solid var(--adl-survey-button-background-color);}
      :host label span:hover{border:1px solid var(--adl-survey-button-background-color);box-shadow: 0 0 3px var(--adl-survey-question-button-background-color);}
      :host input{height:0;opacity:0;position:absolute;width:0;}
      :host label span{background-color:var(--adl-survey-question-button-background-color);border:1px solid var(--adl-survey-question-button-border-color);border-radius:12px;clear:none;color:inherit;cursor:pointer;display:block;float:left;font-size:inherit;list-style-image:none;list-style-type:none;padding:4px 0 5px 0;transition:background-color .15s ease-in-out, box-shadow .2s;text-align:center;text-indent:0;width:100%;}
      :host .labels{display:flex;justify-content:space-between;opacity:.7}
      :host .labels span{font-size:.875em;color:var(--adl-survey-color)}
      :host([required]) h3::after {content: " *";color: red;}
    `;
    const css = new CSSStyleSheet();
    css.replace(styles);
    this.shadowRoot.adoptedStyleSheets.push(css);
  }

  handleEvent(event) {
    if (event.type === "change") {
      this.selectedOption = event.target.value;

      // Get next question ID based on logic rules
      const nextQuestionId = this.getNextQuestionId();
      console.log(nextQuestionId);

      const messageEvent = new CustomEvent("adl-survey:question", {
        detail: {
          value: event.target.value,
          required: this.isRequired(),
          questionId: this.getAttribute('question-id'),
          nextQuestionId // Add the next question ID to the event
        },
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(messageEvent);
    }
  }

  connectedCallback() {
    // Parse logic rules from child elements
    this.parseLogicRules();
    this.render();
    this.attachListeners();
  }

  disconnectedCallback() {
    // Clean up any listeners when removed from the DOM
    const radioButtons = this.shadowRoot.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radioButton => {
      radioButton.removeEventListener("change", this);
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
      this.attachListeners();

      // Restore selected value if it exists
      if (this.selectedOption !== null) {
        const input = this.shadowRoot.querySelector(`input[value="${this.selectedOption}"]`);
        if (input) {
          input.checked = true;
        }
      }
    }
  }

  parseLogicRules() {
    this.logicRules = [];
    // Look for all child logic elements
    const logicElements = this.querySelectorAll('logic');


    logicElements.forEach(logic => {
      const type = logic.getAttribute('type');
      const target = logic.getAttribute('target');
      const range = logic.getAttribute('range');

      if (type && target) {
        const rule = {
          type,
          target
        };

        // Parse range if it exists
        if (range) {
          const rangeParts = range.split('-');
          if (rangeParts.length === 2) {
            const min = parseInt(rangeParts[0], 10); // Use temporary vars
            const max = parseInt(rangeParts[1], 10);
            // Check if parsing was successful
            if (!isNaN(min) && !isNaN(max)) {
              rule.rangeMin = min;
              rule.rangeMax = max;
            } else {
              console.warn(`LikertScale (${this.getAttribute('question-id')}): Invalid range attribute value: ${range}`);
            }
          } else {
            console.warn(`LikertScale (${this.getAttribute('question-id')}): Invalid range format: ${range}. Expected format 'min-max'.`);
          }
        }

        this.logicRules.push(rule);
      }
    });
    console.log(this.logicRules);

  }

  // Method to get the next question based on current selection
  getNextQuestionId() {
    if (!this.selectedOption || this.logicRules.length === 0) {
      return null; // No logic rules or no selection
    }

    const selection = parseInt(this.selectedOption, 10);

    // Find matching rule based on the selection
    for (const rule of this.logicRules) {
      if (rule.type === 'conditional') {
        // Check if selection is within range
        if (rule.rangeMin <= selection && selection <= rule.rangeMax) {
          return rule.target;
        }
      } else if (rule.type === 'next') {
        // Simple next rule
        return rule.target;
      }
    }

    return null; // No matching rule found
  }

  getMin() {
    const minAttr = this.getAttribute('min');
    return minAttr ? parseInt(minAttr, 10) : 1; // Default to 1 if not provided
  }

  getMax() {
    const maxAttr = this.getAttribute('max');
    return maxAttr ? parseInt(maxAttr, 10) : 5; // Default to 5 if not provided
  }

  getLowScoreLabel() {
    return this.getAttribute('low-score-label') || 'Low'; // Default label
  }

  getHighScoreLabel() {
    return this.getAttribute('high-score-label') || 'High'; // Default label
  }

  isRequired() {
    return this.hasAttribute('required'); // Check if the attribute exists
  }

  render() {
    const question = this.getAttribute('question') || 'Pregunta sin especificar';
    const min = this.getMin();
    const max = this.getMax();
    const lowScoreLabel = this.getLowScoreLabel();
    const highScoreLabel = this.getHighScoreLabel();
    const questionId = this.getAttribute('question-id');

    let scaleHTML = /* HTML */`
      <h3>${question}</h3>
      <div class="scale">
        <div class="options">
    `;

    for (let i = min; i <= max; i++) {
      const id = `likert-${questionId}-${i}`;
      const isSelected = this.selectedOption == i;

      scaleHTML += /* HTML */`
          <input type="radio" name="likert-${questionId}" id="${id}" value="${i}" data-value="${i}" ${isSelected ? 'checked' : ''} />
          <label for="${id}"> <span>${i}</span> </label>
        `;
    }

    scaleHTML += /* HTML */`</div>
      <div class="labels">
        <span>${lowScoreLabel}</span>
        <span>${highScoreLabel}</span>
      </div>
    </div>`;

    this.shadowRoot.innerHTML = scaleHTML;
  }

  attachListeners() {
    const radioButtons = this.shadowRoot.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radioButton => {
      radioButton.addEventListener("change", this);
    });
  }
}

customElements.define('likert-scale', LikertScale);