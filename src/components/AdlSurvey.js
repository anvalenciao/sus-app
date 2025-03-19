/**
 * 
 */
class AdlSurvey extends HTMLElement {
  static get observedAttributes() { 
    return ['theme', 'questions-per-page']; 
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this.data = null;
    this.answers = {};
    this.currentPage = 0;
    this.questionsPerPage = 2; // Default value
    this.isSurveyCompleted = false;
    this.questions = [];

    // Create a CSS stylesheet once
    const styles = /* CSS */`
      /* Reset Styles */
      *, *::before, *::after{box-sizing:border-box;}
      *{-webkit-text-size-adjust:100%;font-family:Arial,sans-serif,Tahoma;font-size:16px;font-weight:400;letter-spacing:normal;line-height:1.5;margin:0;text-transform:initial;}
      input, button, select, optgroup, textarea{font-family:inherit;font-size:inherit;line-height:inherit;margin:0;}
      textarea{white-space:revert;}
      span{color:inherit;border:0;margin:0;padding:0;float:none;}
      button, select{text-transform:none;}
      button:focus:not(:focus-visible){outline:0;}
      button{-webkit-appearance:button;appearance:button;}
      button:not(:disabled){cursor:pointer;}
      [hidden]{display:none;}

      /* General Styles */
      :host {
        display: none;
      }
      :host(:defined) {display: block;}
      
      :host header h2{font-size:1.375em;font-weight:500;line-height:1;margin-right:1em;color:var(--adl-survey-color, #000);}
      :host .container{background:var(--adl-survey-background-color, #fff);border-radius:5px 5px 0 0;box-shadow:0 0 7px 0 rgba(0,0,0,.3);font-size:.75em;margin:0 auto;min-width:300px;}
      :host .btn{background-color:var(--adl-survey-button-background-color, #626a84);border:0;border-radius:8px;box-shadow:none;color:var(--adl-survey-button-color, #fff);float:none;font-size:14px;font-weight:600;height:40px;margin:0;min-height:initial;min-width:initial;outline:0;padding:8px 24px;text-decoration:none;transition:opacity .15s ease-in-out;vertical-align:top;width:auto;zoom:1;}
      :host .btn-primary:hover{opacity: 0.77;}
      :host .btn-primary[disabled]{pointer-events:none;opacity:.33;}
      
      :host header{padding:1.5em 1.5em 0 1.5em;display:flex;flex-shrink:0;align-items:center;justify-content:space-between;}
      :host footer{align-items:center;border-top:1px solid rgba(224, 226, 232, 0.6);display:flex;flex-direction:row-reverse;gap:12px;justify-content:space-between;padding:0.75em;width:100%;}

      :host .close{position:absolute;top:0;right:0;display:block;width:32px;height:32px;font-size:0;transition:transform 150ms;margin:1rem;border:0;padding:0;background:0 0}
      :host .close:after,.close:before{position:absolute;top:50%;left:50%;width:2px;height:18px;transform:rotate(45deg) translate(-50%,-50%);transform-origin:top left;content:'';background:var(--adl-survey-color,#000);opacity:0.5;}
      :host .close:after{transform:rotate(-45deg) translate(-50%,-50%)}
      :host .close:hover{opacity:.65;transform:rotateZ(90deg)}

      :host .pagination{display:flex;align-items:center;gap:12px;}
      :host .pagination-info{font-size:0.9em;color:#666;}
      
      :host([theme="modal"]) {z-index:var(--adl-survey-z-index, 999);position:fixed;left:0;top:0;width:100%;height:100%;overflow:auto;background-color:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;}
      :host([theme="modal"]) .container{border-radius:8px;width:384px;animation:adl-survey-ani-position-scale-up .5s cubic-bezier(.165,.84,.44,1) forwards;}
      :host([theme="modal"]) main{min-height:110px;padding:0 1em;}

      :host([theme="modal"]) .thanks{font-size:1.375em;font-weight:600;text-align:center;padding:2em 1em;}
      :host([theme="modal"]) .count{padding:0 1em;}
      
      @keyframes adl-survey-ani-position-scale-up{0%{transform:scale(.65);opacity:0}100%{transform:scale(1);opacity:1}}
      
      /* Animation for question transitions */
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      :host .question-container {
        animation: fadeIn 0.3s ease-out forwards;
      }
      
      :host .hidden {
        display: none;
      }
    `;
    const css = new CSSStyleSheet();
    css.replace(styles);
    this.shadowRoot.adoptedStyleSheets.push(css);
  }

  configure(config) {
    this._config = config;
    this.render();
    this.applyColors();
    return this;
  }

  handleEvent(event) {
    if (event.type === "survey:question") {
      this.data = event.detail;
      
      // Lookup object (also called map or hash table)
      this.answers[this.data.questionId] = this.data.value;

      // Check if required fields are filled for current page
      this.updateNextButtonState();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'questions-per-page' && oldValue !== newValue) {
      const value = parseInt(newValue, 10);
      if (!isNaN(value) && value > 0) {
        this.questionsPerPage = value;
        if (this.isConnected) {
          this.updateQuestionVisibility();
        }
      } else {
        console.warn('questions-per-page must be a positive integer');
      }
    }
  }

  updateNextButtonState() {
    // Get all visible required likert scales
    const visibleQuestions = Array.from(this.shadowRoot.querySelectorAll('likert-scale:not(.hidden)'));
    const requiredQuestions = visibleQuestions.filter(q => q.hasAttribute('required'));
    
    // Check if all required questions have answers
    const allRequiredAnswered = requiredQuestions.every(question => {
      const questionId = question.getAttribute('question-id');
      return this.answers[questionId] !== undefined;
    });
    
    // Update button state
    const nextButton = this.shadowRoot.querySelector('.btn-next');
    if (nextButton) {
      if (allRequiredAnswered) {
        nextButton.removeAttribute('disabled');
      } else {
        nextButton.setAttribute('disabled', '');
      }
    }
  }

  connectedCallback() {
    // Parse questions-per-page attribute
    if (this.hasAttribute('questions-per-page')) {
      const value = parseInt(this.getAttribute('questions-per-page'), 10);
      if (!isNaN(value) && value > 0) {
        this.questionsPerPage = value;
      }
    }
    
    document.addEventListener("survey:question", this);
    //this.render();
    
    // Initial button state check
    this.updateNextButtonState();
  }

  disconnectedCallback() {
    document.removeEventListener("survey:question", this);
  }

  applyColors() {
    // Asegurarse de que tenemos colores definidos
    if (!this._config?.color) return;
    
    const colors = this._config.color;
    const styles = /* CSS */`
      :host {
        --adl-survey-z-index: 9999;
        --adl-survey-color: ${colors.color || '#000'};
        --adl-survey-background-color: ${colors.backgroundColor || '#fff'};

        --adl-survey-button-color: ${colors.buttonColor || '#fff'};
        --adl-survey-button-background-color: ${colors.buttonBackgroundColor || '#6225F0'};

        --adl-survey-button-scale-color: ${colors.buttonScaleColor || '#000'};
        --adl-survey-button-scale-background-color: ${colors.buttonScaleBackgroundColor || '#fff'};
        --adl-survey-button-scale-border-color: ${colors.buttonScaleBorderColor || '#8c9394'};
      }
    `;
    const css = new CSSStyleSheet();
    css.replace(styles);
    this.shadowRoot.adoptedStyleSheets.push(css);
  }

  render() {
    // Asegurarse de que tenemos una configuración
    if (!this._config) return;

    // Accediendo a los valores de configuración
    const { theme, questionsPerPage, questions = [] } = this._config;

    //this.shadowRoot.innerHTML = /* HTML */``;
    // Move all child elements to the shadow DOM
    const container = document.createElement('div');
    container.classList.add('container');
    container.innerHTML = this.innerHTML;
    this.innerHTML = ''; // Clear original content

    this.shadowRoot.appendChild(container);

    // Get all question components
    this.questions = Array.from(this.shadowRoot.querySelectorAll('likert-scale'));
    
    // Set up event listeners
    const closeBtn = this.shadowRoot.querySelector('.close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeSurvey();
      });
    }
    
    const nextBtn = this.shadowRoot.querySelector('.btn-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.goToNextPage();
      });
    }
    
    // Initialize question visibility
    this.updateQuestionVisibility();
    this.updatePaginationInfo();
  }
  
  updateQuestionVisibility() {
    // Hide all questions
    this.questions.forEach(question => {
      question.classList.add('hidden');
    });
    
    if (this.isSurveyCompleted) {
      // Show thank you message
      const thanksElement = this.shadowRoot.querySelector('.thanks');
      if (thanksElement) {
        thanksElement.classList.remove('hidden');
      }
      
      // Update button text
      const nextButton = this.shadowRoot.querySelector('.btn-next');
      if (nextButton) {
        nextButton.textContent = 'Cerrar';
        nextButton.removeAttribute('disabled');
      }
      return;
    }
    
    // Calculate start and end indices for current page
    const startIdx = this.currentPage * this.questionsPerPage;
    const endIdx = Math.min(startIdx + this.questionsPerPage, this.questions.length);
    
    // Show questions for current page
    for (let i = startIdx; i < endIdx; i++) {
      this.questions[i].classList.remove('hidden');
    }
    
    // Update next button state
    this.updateNextButtonState();
  }
  
  updatePaginationInfo() {
    if (this.isSurveyCompleted) {
      const paginationInfo = this.shadowRoot.querySelector('.pagination-info');
      if (paginationInfo) {
        paginationInfo.textContent = 'Encuesta completada';
      }
      return;
    }
    
    const totalPages = Math.ceil(this.questions.length / this.questionsPerPage);
    const paginationInfo = this.shadowRoot.querySelector('.pagination-info');
    
    if (paginationInfo) {
      paginationInfo.textContent = `Página ${this.currentPage + 1} de ${totalPages}`;
    }
  }
  
  goToNextPage() {
    const totalPages = Math.ceil(this.questions.length / this.questionsPerPage);
    
    if (this.isSurveyCompleted) {
      // If survey is completed and "Cerrar" button is clicked
      this.closeSurvey();
      return;
    }
    
    if (this.currentPage < totalPages - 1) {
      // Go to next page
      this.currentPage++;
      this.updateQuestionVisibility();
      this.updatePaginationInfo();
    } else {
      // Show completion screen
      this.isSurveyCompleted = true;
      this.updateQuestionVisibility();
      this.updatePaginationInfo();
    }
  }
  
  closeSurvey() {
    // Hide the survey
    if (this.hasAttribute('theme') && this.getAttribute('theme') === 'modal') {
      // If it's a modal, remove it from the DOM
      this.remove();
    } else {
      // Otherwise just hide it
      this.style.display = 'none';
    }
    
    // Dispatch event that survey was closed
    this.dispatchEvent(new CustomEvent('survey:closed', {
      detail: {
        answers: this.answers,
        completed: this.isSurveyCompleted
      },
      bubbles: true,
      composed: true
    }));
  }
}

// Define custom elements
customElements.define("adl-survey", AdlSurvey);

/*
if (!window.customElements.get('adl-survey')) {
  window.AdlSurvey = AdlSurvey;
  window.customElements.define('adl-survey', AdlSurvey);
}
*/