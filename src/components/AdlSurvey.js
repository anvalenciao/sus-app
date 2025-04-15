class AdlSurvey extends HTMLElement {
  // Define observed attributes
  static get observedAttributes() {
    return ['theme', 'questions-per-page'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // --- State and Properties ---
    this.data = null; // Last event data (consider if needed globally)
    this.answers = {}; // Store answers { questionId: value }
    this.currentPage = 0; // Current page index (0-based), -1 for custom path
    this.questionsPerPage = 1; // Default, overridden by attribute
    this.isSurveyCompleted = false;
    this.questions = []; // Array of CLONED question elements in shadow DOM
    this.questionMap = {}; // Map question IDs to their CLONED elements
    this.originalHTML = null; // Store original light DOM content
    this._config = null; // Store configuration object if using .configure()

    // --- DOM Ready / Connection State ---
    this._isReadyToRender = false; // Flag: True when DOMContentLoaded has fired
    this._isConnected = false; // Flag: True when component is in the DOM

    // --- Bound Methods for Listeners ---
    // Bind methods ONCE to ensure correct 'this' and allow removal
    this.boundHandleSurveyQuestion = this.handleSurveyQuestion.bind(this);
    this.boundDomReadyCallback = this._domReadyCallback.bind(this);
    this.boundCloseSurvey = this.closeSurvey.bind(this);
    this.boundGoToNextPage = this.goToNextPage.bind(this); // Or use arrow fn property

    // --- Adopt Stylesheet ---
    this._adoptStyles();

    // --- Add DOMContentLoaded listener early ---
    // Check if DOM already loaded (if script ran late)
    if (document.readyState === "interactive" || document.readyState === "complete") {
      this._isReadyToRender = true;
      // No need to add listener if already ready
    } else {
      document.addEventListener("DOMContentLoaded", this.boundDomReadyCallback);
    }
    console.log(`AdlSurvey Constructor: Initial ready state: ${this._isReadyToRender}`);
  }

  // --- Stylesheet Adoption ---
  _adoptStyles() {
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
      [hidden], .hidden {display:none !important;} /* Ensure .hidden works */

      /* General Styles */
      :host { display: none; /* Initially hidden until defined and rendered */ }
      :host(:defined) { display: block; /* Show when defined */ }

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
      :host([theme="modal"]) main{min-height:110px;padding:0 1em;} /* Ensure main has padding */
      :host([theme="modal"]) .thanks{font-size:1.375em;font-weight:600;text-align:center;padding:2em 1em;}
      /* :host([theme="modal"]) .count{padding:0 1em;} */ /* .count class not used? */

      @keyframes adl-survey-ani-position-scale-up{0%{transform:scale(.65);opacity:0}100%{transform:scale(1);opacity:1}}

      /* Animation for question transitions */
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      :host .question-container likert-scale:not(.hidden) { /* Apply animation to visible scales */
        animation: fadeIn 0.3s ease-out forwards;
      }
      /* Ensure likert-scale itself is block */
      :host likert-scale { display: block; }
    `;
    const css = new CSSStyleSheet();
    css.replaceSync(styles); // Use replaceSync
    this.shadowRoot.adoptedStyleSheets.push(css);
  }

  // --- Lifecycle Callbacks ---
  connectedCallback() {
    this._isConnected = true;
    console.log("AdlSurvey connectedCallback");

    // Add component-specific listeners
    document.addEventListener("survey:question", this.boundHandleSurveyQuestion);

    // Parse attributes that might affect rendering
    this._parseAttributes();

    // Attempt initial render if conditions are met
    this.tryInitialRender();
  }

  disconnectedCallback() {
    this._isConnected = false;
    console.log("AdlSurvey disconnectedCallback");

    // Clean up global/document listeners
    document.removeEventListener("DOMContentLoaded", this.boundDomReadyCallback);
    document.removeEventListener("survey:question", this.boundHandleSurveyQuestion);
    // Note: Shadow DOM listeners (like button clicks) are removed automatically when shadow DOM is cleared or element destroyed.
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`AdlSurvey attributeChangedCallback: ${name} changed from ${oldValue} to ${newValue}`);
    if (oldValue !== newValue) {
      this._parseAttributes(); // Re-parse attributes

      // Re-render if necessary (e.g., questionsPerPage changes visibility logic)
      // Only re-render if already initialized to avoid errors
      if (this.originalHTML !== null) { // Check if initialized
         this.render(); // Re-render might be needed if questionsPerPage changes
      }
    }
  }

  // --- Initialization Logic ---
  _domReadyCallback() {
    console.log("AdlSurvey _domReadyCallback: DOMContentLoaded fired");
    this._isReadyToRender = true;
    // Clean up listener - it only fires once
    document.removeEventListener("DOMContentLoaded", this.boundDomReadyCallback);
    // Attempt render now that DOM is ready
    this.tryInitialRender();
  }

  tryInitialRender() {
    // Only render if connected AND the DOM is ready
    if (this._isConnected && this._isReadyToRender) {
      // Prevent re-initialization if already done
      if (this.originalHTML !== null) {
          console.log("AdlSurvey tryInitialRender: Already initialized, skipping.");
          return;
      }

      console.log("AdlSurvey tryInitialRender: Conditions met, performing initial render.");

      // Capture innerHTML NOW - it should be ready
      this.originalHTML = this.innerHTML;
      if (!this.originalHTML) {
          console.warn("AdlSurvey tryInitialRender: Captured innerHTML is empty!");
          // Optionally provide default structure or error out
      }

      // Proceed with rendering
      this.render();

      // Apply config/colors if they were set before rendering
      if (this._config) {
          this.applyColors();
      }
    } else {
      console.log(`AdlSurvey tryInitialRender: Conditions not met. Connected: ${this._isConnected}, Ready: ${this._isReadyToRender}`);
    }
  }

  _parseAttributes() {
    // Parse questions-per-page attribute
    if (this.hasAttribute('questions-per-page')) {
      const value = parseInt(this.getAttribute('questions-per-page'), 10);
      // Use default of 1 if parsing fails or value is invalid
      this.questionsPerPage = (!isNaN(value) && value > 0) ? value : 1;
    } else {
      this.questionsPerPage = 1; // Default if attribute not present
    }
    console.log(`AdlSurvey _parseAttributes: questionsPerPage set to ${this.questionsPerPage}`);
    // Note: 'theme' attribute is handled by CSS selector :host([theme="modal"])
  }

  // --- Public Configuration Method ---
  configure(config) {
    this._config = config;
    // Apply config that might affect rendering immediately if possible,
    // or wait for render if DOM isn't ready yet.
    if (this.originalHTML !== null) { // Check if already initialized/rendered
        this.applyColors();
        // Potentially re-render if config affects structure/questions
        // this.render();
    }
    return this;
  }

  applyColors() {
    if (!this._config?.color) return;
    console.log("AdlSurvey applyColors: Applying custom colors");

    const colors = this._config.color;
    // Create a new stylesheet for custom properties
    const colorStyles = /* CSS */`
      :host {
        --adl-survey-z-index: ${this._config.zIndex || 9999}; /* Allow z-index config */
        --adl-survey-color: ${colors.color || '#000'};
        --adl-survey-background-color: ${colors.backgroundColor || '#fff'};
        --adl-survey-button-color: ${colors.buttonColor || '#fff'};
        --adl-survey-button-background-color: ${colors.buttonBackgroundColor || '#6225F0'};
        --adl-survey-button-scale-color: ${colors.buttonScaleColor || '#000'};
        --adl-survey-button-scale-background-color: ${colors.buttonScaleBackgroundColor || '#fff'};
        --adl-survey-button-scale-border-color: ${colors.buttonScaleBorderColor || '#8c9394'};
      }
    `;
    // Check if color styles already exist and replace, otherwise add
    const existingSheet = this.shadowRoot.adoptedStyleSheets.find(sheet => sheet.cssRules.length > 0 && sheet.cssRules[0].cssText.includes('--adl-survey-color'));
    if (existingSheet) {
        existingSheet.replaceSync(colorStyles);
    } else {
        const css = new CSSStyleSheet();
        css.replaceSync(colorStyles);
        this.shadowRoot.adoptedStyleSheets.push(css);
    }
  }

  // --- Core Rendering Function ---
  render() {
    console.log("AdlSurvey render: Starting render process.");
    // Ensure we have the original HTML blueprint
    if (this.originalHTML === null) {
        console.error("AdlSurvey render: Cannot render, originalHTML not captured yet.");
        // This should not happen if tryInitialRender logic is correct
        return;
    }

    // 1. Clear previous shadow DOM content for idempotency
    this.shadowRoot.innerHTML = '';

    // 2. Parse the original HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(this.originalHTML, 'text/html');

    // 3. Create main container
    const container = document.createElement('div');
    container.className = 'container';

    // 4. Clone/Create structural elements
    const header = doc.querySelector('header');
    const main = doc.querySelector('main.questions-container');
    const footer = doc.querySelector('footer');
    let questionsContainer; // Define here for broader scope

    if (header) {
        container.appendChild(header.cloneNode(true));
    } else {
        console.warn("AdlSurvey render: Original HTML missing <header>, adding default.");
        const defaultHeader = document.createElement('header');
        defaultHeader.innerHTML = `<h2>Survey</h2><button class="close"></button>`;
        container.appendChild(defaultHeader);
    }

    if (main) {
        questionsContainer = main.cloneNode(true);
        questionsContainer.querySelectorAll('likert-scale').forEach(el => el.remove()); // Remove placeholders
        container.appendChild(questionsContainer);
    } else {
        console.warn("AdlSurvey render: Original HTML missing <main class='questions-container'>, adding default.");
        questionsContainer = document.createElement('main');
        questionsContainer.className = 'questions-container';
        container.appendChild(questionsContainer);
    }

    // Ensure 'thanks' div exists within questionsContainer
    let thanksDiv = questionsContainer.querySelector('.thanks');
    if (!thanksDiv) {
        thanksDiv = document.createElement('div');
        thanksDiv.className = 'thanks hidden';
        thanksDiv.innerHTML = '<p>¡Gracias por completar la encuesta!</p><p>Tu opinión es muy importante para nosotros.</p>';
        questionsContainer.appendChild(thanksDiv); // Append to the actual container
    } else {
        thanksDiv.classList.add('hidden'); // Ensure it starts hidden
    }


    if (footer) {
        container.appendChild(footer.cloneNode(true));
    } else {
        console.warn("AdlSurvey render: Original HTML missing <footer>, adding default.");
        const defaultFooter = document.createElement('footer');
        defaultFooter.innerHTML = `
            <div class="navigation-controls"><button class="btn btn-primary btn-next" type="button" disabled>Siguiente</button></div>
            <div class="pagination"><span class="pagination-info"></span></div>`;
        container.appendChild(defaultFooter);
    }

    // Append the fully constructed container to the shadow DOM
    this.shadowRoot.appendChild(container);

    // --- Question Cloning ---
    const originalScales = doc.querySelectorAll('likert-scale');
    console.log(`AdlSurvey render: Found ${originalScales.length} original likert-scale elements.`);

    this.questions = []; // Reset internal state
    this.questionMap = {};

    originalScales.forEach(originalScale => {
        const clonedScale = originalScale.cloneNode(true);
        const questionId = clonedScale.getAttribute('question-id');

        // Insert before the 'thanks' div
        questionsContainer.insertBefore(clonedScale, thanksDiv);

        this.questions.push(clonedScale);
        if (questionId) {
            this.questionMap[questionId] = clonedScale;
        } else {
            console.warn("AdlSurvey render: LikertScale in original HTML missing 'question-id'.", originalScale);
        }
    });
    console.log(`AdlSurvey render: Cloned ${this.questions.length} questions.`);

    // --- Add Shadow DOM Event Listeners ---
    const closeBtn = this.shadowRoot.querySelector('.close');
    closeBtn?.addEventListener('click', this.boundCloseSurvey);

    const nextBtn = this.shadowRoot.querySelector('.btn-next');
    nextBtn?.addEventListener('click', this.boundGoToNextPage);
    console.log("AdlSurvey render: Attached listeners to shadow DOM buttons (if found).");


    // --- Initialize Visibility & State ---
    this.updateQuestionVisibility();
    this.updatePaginationInfo();
    this.updateNextButtonState(); // Initial check

    console.log("AdlSurvey render: Render process complete.");
  }


  // --- Event Handlers ---
  // Renamed from handleEvent to be more specific
  handleSurveyQuestion(event) {
    // Ensure it's the event we expect (optional check)
    if (event.type === "survey:question" && event.detail) {
      console.log(`AdlSurvey handleSurveyQuestion: Received answer for ${event.detail.questionId}`, event.detail);
      this.data = event.detail; // Store last event data
      this.answers[event.detail.questionId] = event.detail.value;
      // Update button state whenever an answer changes
      this.updateNextButtonState();
    }
  }

  // --- Navigation and State Updates ---

  // Use arrow function or ensure boundGoToNextPage is used in listener
  goToNextPage = () => {
    console.log("AdlSurvey goToNextPage: Clicked. Completed:", this.isSurveyCompleted);

    if (this.isSurveyCompleted) {
      this.closeSurvey();
      return;
    }

    const visibleQuestions = this.getVisibleQuestions();
    let hasConditionalJumpHappened = false;

    for (const question of visibleQuestions) {
      const questionId = question.getAttribute('question-id');
      const selectedValue = this.answers[questionId];

      if (selectedValue !== undefined && selectedValue !== null) {
        const nextQuestionId = question.getNextQuestionId?.(); // Assumes LikertScale has this method
        console.log(`AdlSurvey goToNextPage: Checking Q${questionId}. Answer=${selectedValue}. LogicNextID=${nextQuestionId}`);

        if (nextQuestionId) {
          const targetQuestion = this.questionMap[nextQuestionId];
          console.log(`AdlSurvey goToNextPage: Conditional jump target ${nextQuestionId}. Found:`, !!targetQuestion);

          if (targetQuestion) {
            console.log(`AdlSurvey goToNextPage: Jumping to Q${nextQuestionId}`);
            this.questions.forEach(q => q.classList.add('hidden')); // Hide all
            targetQuestion.classList.remove('hidden'); // Show target
            console.log(`AdlSurvey goToNextPage: Made target Q${nextQuestionId} visible.`);

            this.currentPage = -1; // Signal custom path state
            this.updatePaginationInfo();
            this.updateNextButtonState(); // Check requirements for the NEWLY visible question
            hasConditionalJumpHappened = true;
            return; // Exit after handling jump
          } else {
            console.warn(`AdlSurvey goToNextPage: Conditional target QID ${nextQuestionId} not found in map.`);
          }
        }
      }
    } // End loop

    // --- Standard Pagination ---
    if (!hasConditionalJumpHappened) {
      console.log("AdlSurvey goToNextPage: No jump, using standard pagination.");

      // Determine current page index based on first visible question before advancing
      let currentVisibleIndex = -1;
      if (visibleQuestions.length > 0) {
          currentVisibleIndex = this.questions.findIndex(q => q === visibleQuestions[0]);
      }
      if (currentVisibleIndex !== -1) {
          // Calculate page number based on index and items per page
          this.currentPage = Math.floor(currentVisibleIndex / this.questionsPerPage);
      } else if (this.currentPage === -1) {
          // If we were in custom nav, need a way to determine the 'next' page.
          // This is complex. Simplest might be to find the *last* question in the sequence?
          // Or just default back to page 0? Let's default for now.
          console.warn("AdlSurvey goToNextPage: Exiting custom nav, defaulting to page 0 for next step.");
          this.currentPage = -1; // Will become 0 after increment below
      }
      // else: Keep existing this.currentPage if index not found and not -1

      this.currentPage++; // Advance page index
      console.log(`AdlSurvey goToNextPage: Calculated next page index: ${this.currentPage}`);

      const totalPages = Math.ceil(this.questions.length / this.questionsPerPage);
      console.log(`AdlSurvey goToNextPage: Total pages: ${totalPages}`);

      if (this.currentPage < totalPages) {
         console.log(`AdlSurvey goToNextPage: Advancing to page ${this.currentPage}`);
         this.updateQuestionVisibility(); // Show the new standard page
         this.updatePaginationInfo();
         this.updateNextButtonState();
      } else {
         console.log("AdlSurvey goToNextPage: Reached end of survey.");
         this.isSurveyCompleted = true;
         this.updateQuestionVisibility(); // Show 'thanks'
         this.updatePaginationInfo();
         this.updateNextButtonState(); // Update button text/state
      }
    }
  }

  updateQuestionVisibility() {
    console.log(`AdlSurvey UpdateVisibility: Updating. CurrentPage=${this.currentPage}, Completed=${this.isSurveyCompleted}, TotalQuestions=${this.questions.length}`);
    const thanksElement = this.shadowRoot.querySelector('.thanks');

    // Always hide all questions first (unless handled directly in goToNextPage jump)
    // It's safer to always hide all here before showing the correct ones.
    this.questions.forEach(question => question.classList.add('hidden'));

    if (this.isSurveyCompleted) {
      if (thanksElement) thanksElement.classList.remove('hidden');
      console.log("AdlSurvey UpdateVisibility: Showing 'thanks'.");
      // Button state handled by goToNextPage completion logic
      return;
    } else {
      if (thanksElement) thanksElement.classList.add('hidden'); // Ensure thanks is hidden
    }

    // Handle standard pagination visibility (currentPage >= 0)
    if (this.currentPage >= 0) {
        const startIdx = this.currentPage * this.questionsPerPage;
        // Ensure endIdx doesn't exceed array bounds
        const endIdx = Math.min(startIdx + this.questionsPerPage, this.questions.length);

        console.log(`AdlSurvey UpdateVisibility: Standard page. Showing indices ${startIdx} to ${endIdx - 1}`);

        if (startIdx < this.questions.length) { // Check if start index is valid
            for (let i = startIdx; i < endIdx; i++) {
                if (this.questions[i]) {
                    this.questions[i].classList.remove('hidden');
                    console.log(`AdlSurvey UpdateVisibility: Making question index ${i} visible.`);
                } else {
                    console.warn(`AdlSurvey UpdateVisibility: Question at index ${i} is undefined.`);
                }
            }
        } else {
             console.warn(`AdlSurvey UpdateVisibility: Calculated start index (${startIdx}) is out of bounds.`);
             // Maybe show page 0 or handle completion? This state indicates an issue.
        }
    } else {
        // currentPage is -1 (Custom Path)
        // Visibility for custom path jumps is now handled directly in goToNextPage.
        // This function might be called unnecessarily after a jump, but hiding all
        // questions at the start prevents duplicates if logic changes.
        console.log("AdlSurvey UpdateVisibility: In custom nav state (-1), visibility handled by goToNextPage.");
    }
    // Update button state based on newly visible questions
    // this.updateNextButtonState(); // Called by goToNextPage after visibility update
  }

  updatePaginationInfo() {
    const paginationInfo = this.shadowRoot.querySelector('.pagination-info');
    if (!paginationInfo) return; // Exit if element not found

    let text = '';
    if (this.isSurveyCompleted) {
      text = 'Encuesta completada';
    } else if (this.currentPage === -1) {
      // Find the currently visible question (should be only one after a jump)
      const visibleQ = this.questions.find(q => !q.classList.contains('hidden'));
      if (visibleQ) {
          const qId = visibleQ.getAttribute('question-id');
          const index = this.questions.findIndex(q => q === visibleQ);
          text = `Pregunta ${index + 1} de ${this.questions.length} (ID: ${qId})`;
      } else {
          text = `Navegación personalizada`; // Fallback
      }
    } else {
      const totalPages = Math.ceil(this.questions.length / this.questionsPerPage);
      const pageNum = this.currentPage + 1;
      // Ensure pageNum doesn't exceed totalPages visually
      text = `Página ${Math.min(pageNum, totalPages)} de ${totalPages}`;
    }
    console.log("AdlSurvey updatePaginationInfo: Setting text to:", text);
    paginationInfo.textContent = text;
  }

  updateNextButtonState() {
    const nextButton = this.shadowRoot.querySelector('.btn-next');
    if (!nextButton) return;

    if (this.isSurveyCompleted) {
        nextButton.textContent = 'Cerrar';
        nextButton.removeAttribute('disabled');
        return;
    } else {
        // Ensure text is 'Siguiente' if not completed
        nextButton.textContent = 'Siguiente';
    }

    const visibleQuestions = this.getVisibleQuestions();
    const requiredQuestions = visibleQuestions.filter(q => q.hasAttribute('required'));
    const allRequiredAnswered = requiredQuestions.every(question => {
      const questionId = question.getAttribute('question-id');
      // Check if an answer exists and is not null/undefined (adjust if empty string is valid)
      return this.answers.hasOwnProperty(questionId) && this.answers[questionId] !== null && this.answers[questionId] !== undefined;
    });

    console.log(`AdlSurvey updateNextButtonState: VisibleRequired=${requiredQuestions.length}, AllAnswered=${allRequiredAnswered}`);

    if (allRequiredAnswered) {
      nextButton.removeAttribute('disabled');
    } else {
      nextButton.setAttribute('disabled', '');
    }
  }

  getVisibleQuestions() {
    // Ensure query runs on shadowRoot
    return Array.from(this.shadowRoot.querySelectorAll('likert-scale:not(.hidden)'));
  }

  closeSurvey() {
    console.log("AdlSurvey closeSurvey: Closing survey.");
    // Dispatch event before removing/hiding
    this.dispatchEvent(new CustomEvent('adl-survey:closed', {
      detail: {
        answers: this.answers,
        completed: this.isSurveyCompleted
      },
      bubbles: true,
      composed: true
    }));

    if (this.getAttribute('theme') === 'modal') {
      this.remove(); // Remove from DOM
    } else {
      this.style.display = 'none'; // Hide inline
    }
  }
}

// Define custom elements (ensure LikertScale is defined before AdlSurvey if in separate files)
// Assuming LikertScale is already defined or imported
customElements.define("adl-survey", AdlSurvey);
/*
customElements.whenDefined('adl-survey').then(function() { 
  console.log('adl-survey is defined');
  // Additional logic here if needed
});*/