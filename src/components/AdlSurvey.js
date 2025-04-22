class AdlSurvey extends HTMLElement {
  static get observedAttributes() {
    return [
      'theme', 'questions-per-page', 'z-index', 'position', 
      'color-text', 'color-background', 'color-button-text',
      'color-button-background', 'color-scale-text',
      'color-scale-background', 'color-scale-border',
      'color-progress-track', 'color-progress-bar'
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // --- State and Properties ---
    this.answers = {}; // Store answers { questionId: value }
    this.currentPage = 0; // Current page index (0-based), -1 for custom path
    this.questionsPerPage = 1; // Default, overridden by attribute
    this.isSurveyCompleted = false;
    this.questions = []; // Array of CLONED question elements in shadow DOM
    this.questionMap = {}; // Map question IDs to their CLONED elements
    this.originalHTML = null; // Store original light DOM content

    // --- DOM Ready / Connection State ---
    this.isReadyToRender = false; // Flag: True when DOMContentLoaded has fired
    this._isConnected = false; // Flag: True when component is in the DOM

    this.colors = this.getDefaultColors(); // Initialize with defaults
    this.zIndex = 9999; // Default z-index
    this.position = 'center'; // Default position
    this.isPopupCollapsed = false; // Add state for popup collapse

    // --- Adopt Stylesheet ---
    this.adoptStyles();

    // --- Add DOMContentLoaded listener early ---
    // Check if DOM already loaded (if script ran late)
    if (document.readyState === "interactive" || document.readyState === "complete") {
      this.isReadyToRender = true;
      // No need to add listener if already ready
    } else {
      document.addEventListener("DOMContentLoaded", this.domReadyCallback);
    }
    console.log(`AdlSurvey Constructor: Initial ready state: ${this.isReadyToRender}`);
  }

  // --- Lifecycle Callbacks ---
  connectedCallback() {
    this._isConnected = true;
    console.log("AdlSurvey connectedCallback");

    // Add component-specific listeners
    this.addEventListener("survey:question", this.handleEvent);

    // Parse attributes that might affect rendering
    this.parseAttributes();

    this.parseColorAttributes(); // Parse initial attributes

    // Check initial collapsed state from attribute?
    this.isPopupCollapsed = this.hasAttribute('collapsed');
    this.updateCollapsedAttribute(); // Sync attribute initially

    // Attempt initial render if conditions are met
    this.tryInitialRender();
  }

  disconnectedCallback() {
    this._isConnected = false;
    console.log("AdlSurvey disconnectedCallback");

    // Clean up global/document listeners
    document.removeEventListener("DOMContentLoaded", this.domReadyCallback);
    this.removeEventListener("survey:question", this.handleEvent);
    // Note: Shadow DOM listeners (like button clicks) are removed automatically when shadow DOM is cleared or element destroyed.
  }

  getDefaultColors = () => {
    return {
      color: "#000",
      backgroundColor: "#fff",
      buttonColor: "#fff",
      buttonBackgroundColor: "#626a84", // Default from original CSS
      buttonScaleColor: "#000",
      buttonScaleBackgroundColor: "#fff",
      buttonScaleBorderColor: "#8c9394",
      progressBarTrackColor: "#e0e2e8",
      progressBarColor: "#626a84"
    };
  }

  // --- Stylesheet Adoption ---
  adoptStyles = () => {
    const styles = /* CSS */`
      /* Reset Styles */
      *,::before,::after{box-sizing:border-box}
      :host{font-family:var(--adl-survey-font-family, Arial, sans-serif, Tahoma);display:none}
      :host(:defined){display:block}
      *{-webkit-text-size-adjust:100%;font-size:16px;font-weight:400;letter-spacing:normal;line-height:1.5;margin:0;text-transform:initial}
      input,button,select,optgroup,textarea{font-family:inherit;font-size:inherit;line-height:inherit;margin:0}
      textarea{white-space:revert}
      span{color:inherit;border:0;margin:0;padding:0;float:none}
      button, select{text-transform:none}
      button:focus:not(:focus-visible){outline:0}
      button{-webkit-appearance:button;appearance:button}
      button:not(:disabled){cursor:pointer}
      [hidden],.hidden{display:none!important}

      /* General Styles */
      :host{display:none}:host(:defined){display:block}
      :host .btn{background-color:var(--adl-survey-button-background-color, #626a84);border:0;border-radius:8px;box-shadow:none;color:var(--adl-survey-button-color, #fff);float:none;font-size:14px;font-weight:600;height:40px;margin:0;min-height:initial;min-width:initial;outline:0;padding:8px 24px;text-decoration:none;transition:opacity .15s ease-in-out;vertical-align:top;width:auto;zoom:1}
      :host .btn-primary:hover{opacity: 0.77}
      :host .btn-primary[disabled]{pointer-events:none;opacity:.33}

      :host header{padding:1rem;display:flex;flex-shrink:0;align-items:center;justify-content:space-between}
      :host header h2{font-size:1.375em;font-weight:500;line-height:1;margin-right:1em;color:var(--adl-survey-color,#000)}
      :host .container{background:var(--adl-survey-background-color,#fff);border-radius:5px 5px 0 0;box-shadow:0 0 7px 0 #0000004d;font-size:.75em;margin:0 auto;min-width:300px;font-family:inherit}
      :host footer{position:relative;align-items:center;display:flex;flex-direction:row-reverse;gap:12px;justify-content:space-between;padding:.75em;padding-top:calc(0.75em + 4px);width:100%}
      :host footer::after{content:'';position:absolute;top:0;left:0;width:100%;height:4px;background-color:var(--adl-survey-progress-track-color,#e0e2e8);z-index:1}
      :host footer::before{content:'';position:absolute;top:0;left:0;width:var(--adl-survey-progress-width,0%);height:4px;background-color:var(--adl-survey-progress-bar-color,var(--adl-survey-button-background-color,#008acc));z-index:2;transition:width .3s ease-in-out}

      :host .logo{display:flex;align-items:center;gap:12px}
      :host .pagination{display:flex;align-items:center;gap:12px}
      :host .pagination-info{font-size:0.9em;color:#666}

      :host button[action="close"],:host button[action="collapse"]{position:absolute;top:0;right:0;display:block;width:40px;height:40px;font-size:0;transition:transform 150ms,opacity .15s ease-in-out;margin:.5rem;border:0;padding:0;background:0 0;cursor:pointer;opacity:.5;box-sizing:border-box}
      :host button[action="close"]:hover,:host button[action="collapse"]:hover{opacity:1}

      :host button[action="close"]:after,:host button[action="close"]:before{position:absolute;top:50%;left:50%;width:2px;height:18px;content:'';background:var(--adl-survey-color,#000)}
      :host button[action="close"]:before{transform:rotate(45deg) translate(-50%,-50%);transform-origin:top left}
      :host button[action="close"]:after{transform:rotate(-45deg) translate(-50%,-50%);transform-origin:top left}
      :host button[action="close"]:hover{transform:rotateZ(90deg)}

      :host button[action="collapse"]{transition:transform .2s ease-in-out,opacity .15s ease-in-out;transform:rotate(180deg)}
      :host button[action="collapse"]:before,:host button[action="collapse"]:after{position:absolute;top:50%;left:50%;content:'';width:10px;height:2px;background:var(--adl-survey-color,#000);transform-origin:center}
      :host button[action="collapse"]:before{transform:translate(-90%,-50%) rotate(-45deg)}
      :host button[action="collapse"]:after{transform:translate(-30%,-50%) rotate(45deg)}

      /* --- Modal Theme --- */
      :host([theme="modal"]){z-index:var(--adl-survey-z-index,999);position:fixed;left:0;top:0;width:100%;height:100%;overflow:auto;background-color:#0009;display:flex;align-items:center;justify-content:center}
      :host([theme="modal"][position="left"]){justify-content:flex-start}
      :host([theme="modal"][position="right"]){justify-content:flex-end}
      :host([theme="modal"]) main{min-height:110px;padding:0 1em}
      :host([theme="modal"]) .container{border-radius:8px;width:384px;animation:scaleUp .5s cubic-bezier(.165,.84,.44,1) forwards;margin:0 1em}
      :host([theme="modal"]) .thanks{font-size:1.375em;font-weight:600;text-align:center;padding:2em 1em}

      /* --- Popup Theme --- */
      :host([collapsed]) main,:host([collapsed]) footer{display:none}
      :host([collapsed]) button[action="collapse"]{transform:rotate(0deg)}

      :host([theme="popup"]){position:fixed;z-index:var(--adl-survey-z-index,999);bottom:0;width:320px;max-width:calc(100% - 2em);animation:slideToTop .5s ease-out forwards;right:1em;left:auto}
      :host([theme="popup"][position="left"]){left:1em;right:auto}
      :host([theme="popup"][position="center"]){left:50%;right:auto;transform:translateX(-50%);animation-name:slideToTopCenter}
      :host([theme="popup"]) .container{width:100%;border-radius:8px 8px 0 0;box-shadow:0 2px 10px 0 #0000004d;background:var(--adl-survey-background-color,#fff);overflow:hidden}
      :host([theme="popup"]) main{padding:0 1em 1rem 1rem;min-height:80px}
      :host([theme="popup"]) footer{padding:.75em 1em}
      :host([theme="popup"]) button[action="collapse"]{margin:.5rem}

      @keyframes scaleUp{0%{transform:scale(.65);opacity:0}100%{transform:scale(1);opacity:1}}
      @keyframes slideToTop{0%{transform:translateY(100%);opacity:0}100%{transform:translateY(0);opacity:1}}
      @keyframes slideToTopCenter{0%{transform:translateX(-50%) translateY(100%);opacity:0}100%{transform:translateX(-50%) translateY(0);opacity:1}}
    `;
    const css = new CSSStyleSheet();
    css.replaceSync(styles); // Use replaceSync
    this.shadowRoot.adoptedStyleSheets.push(css);
  }

  updateProgressBar = () => {
    const footer = this.shadowRoot.querySelector('footer');
    if (!footer) return;

    const totalQuestions = this.questions.length;
    if (totalQuestions === 0) {
      footer.style.setProperty('--adl-survey-progress-width', '0%');
      return;
    }

    let progressPercent = 0;

    // 1. Check for Completion First: If survey is done, it's 100%
    if (this.isSurveyCompleted) {
      progressPercent = 100;
    }
    // 2. Handle Custom Path (-1): Progress based on *completed* questions
    else if (this.currentPage === -1) {
      const visibleQ = this.questions.find(q => !q.classList.contains('hidden'));
      if (visibleQ) {
        const visibleIndex = this.questions.findIndex(q => q === visibleQ);
        // Use visibleIndex (0-based) directly for completed steps before this one
        progressPercent = (visibleIndex / totalQuestions) * 100;
      } else {
        progressPercent = 0; // Should not happen in a valid state
      }
    }
    // 3. Handle Standard Paging (>= 0): Progress based on *completed* pages
    else {
      const totalPages = Math.ceil(totalQuestions / this.questionsPerPage);
      if (totalPages > 0) {
        // Use currentPage (0-based) directly for completed pages before this one
        progressPercent = (this.currentPage / totalPages) * 100;
      } else {
        progressPercent = 0; // Only if totalQuestions is 0, handled above
      }
    }

    // Clamp percentage between 0 and 100 (safety net)
    progressPercent = Math.max(0, Math.min(100, progressPercent));

    console.log(`AdlSurvey updateProgressBar: Setting width to ${progressPercent}% (State: currentPage=${this.currentPage}, completed=${this.isSurveyCompleted})`);
    footer.style.setProperty('--adl-survey-progress-width', `${progressPercent}%`);
  }

  attributeChangedCallback = (name, oldValue, newValue) => {
    if (oldValue !== newValue) {
      console.log(`AdlSurvey attributeChangedCallback: ${name} changed from ${oldValue} to ${newValue}`);

      let needsColorUpdate = false; // Renaming applyColors -> applyStyles might be good
      let needsRender = false;
      let needsAttributeParse = false;

      // ... existing logic ...
      if (name === 'theme') {
        // Update button visibility if theme changes after initial render
        if (this.shadowRoot.childElementCount > 0 && this.originalHTML !== null) {
          this.updateButtonVisibility();
        }
      }

      if (name.startsWith('color-')) {
        this.parseColorAttributes();
        needsColorUpdate = true;
      } else if (name === 'z-index') {
        needsAttributeParse = true;
        needsColorUpdate = true; // z-index is applied in applyColors/applyStyles
      } else if (name === 'position') { // <-- Handle position change
        needsAttributeParse = true;
        // Option A: Re-apply styles if position affects CSS variables (less likely)
        // needsColorUpdate = true;
        // Option B: Let CSS handle it via attribute selector (simpler if possible)
        // No specific JS action needed here other than parsing if CSS handles it
        console.log(`AdlSurvey attributeChangedCallback: Position changed to ${this.position}. CSS should handle visual update.`);

      } else if (name === 'questions-per-page') {
        needsAttributeParse = true;
        needsRender = true;
      }

      // Re-parse general attributes if needed
      if (needsAttributeParse) {
        this.parseAttributes(); // This updates this.position
      }

      // Apply updates ONLY if the component is already initialized and rendered
      if (this.shadowRoot.childElementCount > 0 && this.originalHTML !== null) {
        if (needsRender) {
          console.log(`AdlSurvey attributeChangedCallback: Triggering re-render due to ${name} change.`);
          this.render();
        } else if (needsColorUpdate) {
          console.log(`AdlSurvey attributeChangedCallback: Triggering applyStyles due to ${name} change.`);
          this.applyStyles(); // Assuming renamed function
        }
      } else {
        console.log(`AdlSurvey attributeChangedCallback: Attribute ${name} changed, but component not fully rendered yet.`);
      }
    }
  }

  parseColorAttributes = () => {
    const newColors = { ...this.getDefaultColors() };
    newColors.color = this.getAttribute('color-text') || newColors.color;
    newColors.backgroundColor = this.getAttribute('color-background') || newColors.backgroundColor;
    newColors.buttonColor = this.getAttribute('color-button-text') || newColors.buttonColor;
    newColors.buttonBackgroundColor = this.getAttribute('color-button-background') || newColors.buttonBackgroundColor;
    newColors.buttonScaleColor = this.getAttribute('color-scale-text') || newColors.buttonScaleColor;
    newColors.buttonScaleBackgroundColor = this.getAttribute('color-scale-background') || newColors.buttonScaleBackgroundColor;
    newColors.buttonScaleBorderColor = this.getAttribute('color-scale-border') || newColors.buttonScaleBorderColor;
    newColors.progressBarTrackColor = this.getAttribute('color-progress-track') || newColors.progressBarTrackColor;
    newColors.progressBarColor = this.getAttribute('color-progress-bar') || newColors.progressBarColor;
    this.colors = newColors;
    console.log("AdlSurvey parseColorAttributes: Updated colors:", this.colors);
    console.log("AdlSurvey parseColorAttributes: Parsed colors object:", JSON.stringify(this.colors));
  }

  // --- Initialization Logic ---
  domReadyCallback = () => {
    console.log("AdlSurvey domReadyCallback: DOMContentLoaded fired");
    this.isReadyToRender = true;
    // Clean up listener - it only fires once
    document.removeEventListener("DOMContentLoaded", this.domReadyCallback);
    // Attempt render now that DOM is ready
    this.tryInitialRender();
  }

  tryInitialRender = () => {
    if (this._isConnected && this.isReadyToRender) {
      // Prevent re-initialization
      if (this.originalHTML !== null) {
        console.log("AdlSurvey tryInitialRender: Already initialized, skipping.");
        return;
      }

      console.log("AdlSurvey tryInitialRender: Conditions met, performing initial render.");
      this.originalHTML = this.innerHTML; // Capture HTML

      // Parse ALL attributes initially (including colors) BEFORE rendering
      // This ensures colors is populated before applyStyles runs
      this.parseAttributes(); // Handles non-color like questions-per-page
      this.parseColorAttributes(); // Parse initial color attributes

      // Render the shadow DOM structure
      this.render();

      // Apply colors AFTER shadow DOM is built by render()
      console.log("AdlSurvey tryInitialRender: Calling applyStyles after initial render.");
      this.applyStyles(); // <<< THIS IS THE KEY INITIAL CALL
      this.updateProgressBar();

    } else {
      console.log(`AdlSurvey tryInitialRender: Conditions not met. Connected: ${this._isConnected}, Ready: ${this.isReadyToRender}`);
    }
  }

  parseAttributes = () => {
    // --- Questions Per Page ---
    if (this.hasAttribute('questions-per-page')) {
      const value = parseInt(this.getAttribute('questions-per-page'), 10);
      this.questionsPerPage = (!isNaN(value) && value > 0) ? value : 1;
    } else {
      this.questionsPerPage = 1; // Default
    }
    console.log(`AdlSurvey parseAttributes: questionsPerPage set to ${this.questionsPerPage}`);

    // --- Z-Index ---
    if (this.hasAttribute('z-index')) {
      const zValue = this.getAttribute('z-index');
      // Basic check if it looks like a number, otherwise use default
      this.zIndex = !isNaN(parseInt(zValue, 10)) ? zValue : 9999;
    } else {
      this.zIndex = 9999; // Default if attribute not present
    }
    console.log(`AdlSurvey parseAttributes: zIndex set to ${this.zIndex}`);

    // --- Position ---
    const validPositions = ['left', 'center', 'right'];
    if (this.hasAttribute('position')) {
      const posValue = this.getAttribute('position').toLowerCase();
      // Use the value if valid, otherwise default to 'center'
      this.position = validPositions.includes(posValue) ? posValue : 'center';
    } else {
      this.position = 'center'; // Default if attribute not present
    }
    console.log(`AdlSurvey parseAttributes: position set to ${this.position}`);

    // Note: 'theme' attribute is handled by CSS selector :host([theme="modal"])
    // Color attributes are handled by parseColorAttributes
  }

  applyStyles = () => { // Renaming to applyStyles might be more accurate now
    if (!this.colors) {
      console.log("AdlSurvey applyStyles: Skipping, no colors object found.");
      return;
    }
    // Also ensure zIndex has been parsed (should be handled by initial parseAttributes)
    console.log(`AdlSurvey applyStyles: Applying styles. Colors: ${JSON.stringify(this.colors)}, Z-Index: ${this.zIndex}`);

    const colors = this.colors;
    // Generate the CSS string including the z-index variable
    const dynamicStyles = /* CSS */`
        :host {
          /* Color Variables */
          --adl-survey-color: ${colors.color};
          --adl-survey-background-color: ${colors.backgroundColor};
          --adl-survey-button-color: ${colors.buttonColor};
          --adl-survey-button-background-color: ${colors.buttonBackgroundColor};
          --adl-survey-button-scale-color: ${colors.buttonScaleColor};
          --adl-survey-button-scale-background-color: ${colors.buttonScaleBackgroundColor};
          --adl-survey-button-scale-border-color: ${colors.buttonScaleBorderColor};
          --adl-survey-progress-track-color: ${colors.progressBarTrackColor};
          --adl-survey-progress-bar-color: ${colors.progressBarColor};

          /* Z-Index Variable */
          --adl-survey-z-index: ${this.zIndex};
        }
      `;
    console.log("AdlSurvey applyStyles: Generated CSS:", dynamicStyles);

    // Update or add the stylesheet (same logic as before)
    // Maybe give this stylesheet a more specific purpose if you have multiple dynamic ones
    const styleSheetKey = 'dynamic-styles'; // Give it a conceptual key
    let sheet = this.shadowRoot.adoptedStyleSheets.find(s => s[styleSheetKey]);

    if (sheet) {
      console.log("AdlSurvey applyStyles: Replacing existing dynamic stylesheet.");
      sheet.replaceSync(dynamicStyles);
    } else {
      console.log("AdlSurvey applyStyles: Adding new dynamic stylesheet.");
      sheet = new CSSStyleSheet();
      sheet[styleSheetKey] = true; // Mark the sheet
      sheet.replaceSync(dynamicStyles);
      // Add this new sheet to the array of adopted sheets
      this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
    }
    console.log("AdlSurvey applyStyles: Stylesheet updated/added.");
  }

  // --- Core Rendering Function ---
  render = () => {
    console.log("AdlSurvey render: Starting render process.");
    if (this.originalHTML === null) {
      console.error("AdlSurvey render: Cannot render, originalHTML not captured yet.");
      return;
    }

    this.shadowRoot.innerHTML = ''; // Clear previous content

    const parser = new DOMParser();
    const doc = parser.parseFromString(this.originalHTML, 'text/html');

    const container = document.createElement('div');
    container.className = 'container';

    // --- Header ---
    let headerElement;
    const originalHeader = doc.querySelector('header');
    if (originalHeader) {
      headerElement = originalHeader.cloneNode(true);
      // *** OPTIMIZATION START: Ensure both action buttons exist for styling/visibility logic ***
      let closeBtn = headerElement.querySelector('button[action="close"]');
      if (!closeBtn) {
          closeBtn = document.createElement('button');
          closeBtn.setAttribute('action', 'close');
          // Add default classes/parts if needed, though CSS targets [action="close"]
          // closeBtn.className = 'close close-button-default';
          // closeBtn.part = 'button close-button';
          closeBtn.setAttribute('aria-label', 'Close Survey');
          headerElement.appendChild(closeBtn); // Append if missing
      }

      let collapseBtn = headerElement.querySelector('button[action="collapse"]');
      if (!collapseBtn) {
          collapseBtn = document.createElement('button');
          collapseBtn.setAttribute('action', 'collapse');
          // Add default classes/parts if needed
          // collapseBtn.className = 'close collapse-button-default'; // Base 'close' class might be confusing here
          // collapseBtn.part = 'button collapse-button';
          collapseBtn.setAttribute('aria-label', 'Toggle Survey');
          headerElement.appendChild(collapseBtn); // Append if missing
      }
      // *** OPTIMIZATION END ***
    } else {
      console.warn("AdlSurvey render: Original HTML missing <header>, adding default.");
      headerElement = document.createElement('header');
      // Add default content INCLUDING BOTH buttons
      headerElement.innerHTML = `<h2>Survey</h2>
                                 <button action="close" aria-label="Close Survey"></button>
                                 <button action="collapse" aria-label="Toggle Survey"></button>`;
    }
    container.appendChild(headerElement);


    // --- Main (Questions Container) ---
    let questionsContainer;
    const main = doc.querySelector('main.questions-container');
    if (main) {
      questionsContainer = main.cloneNode(true);
      // Clear placeholder scales from the template clone
      questionsContainer.querySelectorAll('.question').forEach(el => el.remove());
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
      questionsContainer.appendChild(thanksDiv);
    } else {
      thanksDiv.classList.add('hidden'); // Ensure it starts hidden
    }

    // --- Footer ---
    const footer = doc.querySelector('footer');
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

    // Append the fully constructed container
    this.shadowRoot.appendChild(container);

    // --- Question Cloning ---
    const originalScales = doc.querySelectorAll('.question');
    console.log(`AdlSurvey render: Found ${originalScales.length} original .question elements.`);
    this.questions = [];
    this.questionMap = {};
    originalScales.forEach(originalScale => {
      const clonedScale = originalScale.cloneNode(true);
      const questionId = clonedScale.getAttribute('question-id');
      // Insert cloned questions *before* the thanks div within the questionsContainer
      questionsContainer.insertBefore(clonedScale, thanksDiv);
      this.questions.push(clonedScale);
      if (questionId) {
        this.questionMap[questionId] = clonedScale;
      } else {
        console.warn("AdlSurvey render: LikertScale in original HTML missing 'question-id'.", originalScale);
      }
    });
    console.log(`AdlSurvey render: Cloned ${this.questions.length} questions.`);

    // --- Attach Listeners ---
    this.attachActionListeners(); // Attaches to buttons based on action attribute
    const nextBtn = this.shadowRoot.querySelector('.btn-next');
    if (nextBtn) {
         // Ensure listener isn't added multiple times if render is called again (though clearing innerHTML helps)
         // Consider removing listener before adding if issues arise, but usually okay with full render.
         nextBtn.addEventListener('click', this.goToNextPage);
    } else {
        console.warn("AdlSurvey render: '.btn-next' not found in footer.");
    }
    console.log("AdlSurvey render: Attached listeners to shadow DOM buttons (if found).");

    // --- Initialize Visibility & State ---
    this.updateButtonVisibility(); // <<< Now crucial to hide the irrelevant action button
    this.updateQuestionVisibility();
    //this.updatePaginationInfo();
    this.updateNextButtonState();

    console.log("AdlSurvey render: Render process complete.");
  }

  // --- Helper to Attach Listeners based on 'action' attribute ---
  attachActionListeners = () => {
    const closeBtn = this.shadowRoot.querySelector('button[action="close"]');
    const collapseBtn = this.shadowRoot.querySelector('button[action="collapse"]');

    // Remove potentially existing listeners before adding (safer if render logic changes)
    if(closeBtn) closeBtn.removeEventListener('click', this.closeSurvey);
    if(collapseBtn) collapseBtn.removeEventListener('click', this.togglePopupCollapse);

    // Add listeners
    if (closeBtn) {
      closeBtn.addEventListener('click', this.closeSurvey);
      console.log("AdlSurvey attachActionListeners: Attached closeSurvey to", closeBtn);
    }
    if (collapseBtn) {
      collapseBtn.addEventListener('click', this.togglePopupCollapse);
      console.log("AdlSurvey attachActionListeners: Attached togglePopupCollapse to", collapseBtn);
    }
  }

  // --- Helper to Show/Hide Correct Button based on Theme ---
  updateButtonVisibility = () => {
    const closeBtn = this.shadowRoot.querySelector('button[action="close"]');
    const collapseBtn = this.shadowRoot.querySelector('button[action="collapse"]');
    // If buttons aren't found, something is wrong with render, but add guards anyway
    if (!closeBtn || !collapseBtn) {
        console.warn("updateButtonVisibility: Action buttons not found in header.");
        return;
    }

    const isPopup = this.getAttribute('theme') === 'popup';

    // Hide the button that is NOT relevant for the current theme
    closeBtn.hidden = isPopup;
    collapseBtn.hidden = !isPopup;

    console.log(`updateButtonVisibility: Popup=${isPopup}, Close Hidden=${closeBtn.hidden}, Collapse Hidden=${collapseBtn.hidden}`);
  }

  // --- Helper to Sync Attribute ---
  updateCollapsedAttribute() {
    console.log(this.isPopupCollapsed);
    if (this.isPopupCollapsed) {
      this.setAttribute('collapsed', ''); // Set boolean attribute
    } else {
      this.removeAttribute('collapsed');
    }
    // Optional: Dispatch an event when state changes
    // this.dispatchEvent(new CustomEvent('adl-survey:toggled', { detail: { collapsed: this.isPopupCollapsed } }));
  }


  // --- Event Handlers ---
  // Renamed from handleEvent to be more specific
  // Optional: Rename this.data for clarity
  handleEvent = (event) => {
    if (event.type === "survey:question" && event.detail) {
      console.log(`AdlSurvey handleEvent: Received answer for ${event.detail.questionId}`, event.detail);
      this.answers[event.detail.questionId] = event.detail.value;
      this.updateNextButtonState();
    }
  }

  // --- Navigation and State Updates ---

  // Use arrow function or ensure boundGoToNextPage is used in listener
  goToNextPage = () => {
    console.log("AdlSurvey goToNextPage: Clicked. Completed:", this.isSurveyCompleted);

    // If the survey is already marked as completed, the button acts as 'Close'
    if (this.isSurveyCompleted) {
      this.closeSurvey();
      return; // Exit early, no state change needed
    }

    const visibleQuestions = this.getVisibleQuestions();
    let hasConditionalJumpHappened = false;

    // --- Check for Conditional Jumps ---
    for (const question of visibleQuestions) {
      const questionId = question.getAttribute('question-id');
      const selectedValue = this.answers[questionId];

      // Only check logic if there's a selected value for the current question
      if (selectedValue !== undefined && selectedValue !== null) {
        // Check if the question component has the logic method
        const nextQuestionId = question.getNextQuestionId?.();
        console.log(`AdlSurvey goToNextPage: Checking Q${questionId}. Answer=${selectedValue}. LogicNextID=${nextQuestionId}`);

        if (nextQuestionId) {
          const targetQuestion = this.questionMap[nextQuestionId];
          console.log(`AdlSurvey goToNextPage: Conditional jump target ${nextQuestionId}. Found:`, !!targetQuestion);

          if (targetQuestion) {
            console.log(`AdlSurvey goToNextPage: Jumping to Q${nextQuestionId}`);
            // --- Perform the Jump ---
            this.questions.forEach(q => q.classList.add('hidden')); // Hide all questions
            targetQuestion.classList.remove('hidden'); // Show the target question

            // --- Update State After Jump ---
            this.currentPage = -1; // Signal we are off the standard page track
            //this.updatePaginationInfo(); // Update page/question number display
            this.updateNextButtonState(); // Check requirements for the NEWLY visible question
            this.updateProgressBar(); // <<< UPDATE PROGRESS BAR after jump
            hasConditionalJumpHappened = true;
            return; // IMPORTANT: Exit function after handling the jump
          } else {
            // Logic rule specified a target ID that doesn't exist
            console.warn(`AdlSurvey goToNextPage: Conditional target Question ID "${nextQuestionId}" not found in questionMap.`);
            // Decide how to proceed: Treat as no jump? Log error? For now, we continue as if no jump occurred.
          }
        }
      }
    } // End loop checking for jumps

    // --- Standard Pagination (Only if no conditional jump happened) ---
    if (!hasConditionalJumpHappened) {
      console.log("AdlSurvey goToNextPage: No jump, proceeding with standard pagination.");

      // Determine current page index based on the first visible question before advancing
      // This helps if we were previously in a custom path (currentPage === -1)
      let currentVisibleIndex = -1;
      if (visibleQuestions.length > 0) {
        currentVisibleIndex = this.questions.findIndex(q => q === visibleQuestions[0]);
      }

      if (currentVisibleIndex !== -1) {
        // Calculate the logical page number based on the visible question's index
        this.currentPage = Math.floor(currentVisibleIndex / this.questionsPerPage);
      } else if (this.currentPage === -1) {
        // If we were in custom nav (-1) but somehow didn't find a visible question (edge case?),
        // or if the jump logic failed silently, reset to start progressing from page 0.
        console.warn("AdlSurvey goToNextPage: Exiting custom nav state or couldn't find visible question index. Resetting to page 0 for next step.");
        this.currentPage = -1; // Will become 0 after increment below
      }
      // else: If index not found and not -1, keep existing this.currentPage (might happen if survey is empty)

      // --- Advance Page Index ---
      this.currentPage++;
      console.log(`AdlSurvey goToNextPage: Advanced standard page index to: ${this.currentPage}`);

      const totalQuestions = this.questions.length;
      const totalPages = Math.ceil(totalQuestions / this.questionsPerPage);
      console.log(`AdlSurvey goToNextPage: Total pages: ${totalPages}`);

      // --- Check if there are more pages or if survey is now complete ---
      if (this.currentPage < totalPages) {
        // --- Go to Next Standard Page ---
        console.log(`AdlSurvey goToNextPage: Advancing display to page ${this.currentPage + 1} / ${totalPages}`);
        this.updateQuestionVisibility(); // Show the questions for the new standard page
        //this.updatePaginationInfo(); // Update page number display
        this.updateNextButtonState(); // Check requirements for the new page's questions
        this.updateProgressBar(); // <<< UPDATE PROGRESS BAR after standard page advance
      } else {
        // --- Reached End of Survey ---
        console.log("AdlSurvey goToNextPage: Reached end of standard survey flow.");
        this.isSurveyCompleted = true;
        this.updateQuestionVisibility(); // Show 'thanks' message, hide questions
        //this.updatePaginationInfo(); // Update display to show completion
        this.updateNextButtonState(); // Update button text to 'Cerrar' and enable it
        this.updateProgressBar(); // <<< UPDATE PROGRESS BAR on completion (sets to 100%)
      }
    }
    // If hasConditionalJumpHappened was true, the function returned earlier.
  }

  updateQuestionVisibility = () => {
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

  updatePaginationInfo = () => {
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

  updateNextButtonState = () => {
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

  getVisibleQuestions = () => {
    // Ensure query runs on shadowRoot
    return Array.from(this.shadowRoot.querySelectorAll('.question:not(.hidden)'));
  }

  closeSurvey = () => {
    console.log("AdlSurvey closeSurvey: Closing survey fully.");

    // --- Dispatch Event ---
    // Dispatch event BEFORE removing/hiding so listeners can react
    try {
      this.dispatchEvent(new CustomEvent('adl-survey:closed', {
        detail: {
          answers: { ...this.answers }, // Send a copy of answers
          completed: this.isSurveyCompleted
        },
        bubbles: true, // Allow event to bubble up
        composed: true // Allow event to cross shadow DOM boundary
      }));
      console.log("AdlSurvey closeSurvey: Dispatched 'adl-survey:closed' event.");
    } catch (e) {
      console.error("AdlSurvey closeSurvey: Error dispatching event:", e);
    }


    // --- Hide or Remove Element ---
    const theme = this.getAttribute('theme');
    if (theme === 'modal') {
      console.log("AdlSurvey closeSurvey: Removing modal element.");
      // Optional: Add fade-out animation before removing
      // this.style.animation = 'fadeOut 0.3s ease-out forwards';
      // setTimeout(() => this.remove(), 300);
      this.remove(); // Remove element from DOM
    } else {
      // For 'popup' or 'inline' themes, just hide
      console.log(`AdlSurvey closeSurvey: Hiding element (theme: ${theme || 'inline'}).`);
      this.style.display = 'none';
    }

    // --- Cleanup (Optional but Recommended) ---
    // Although disconnectedCallback handles some cleanup,
    // explicit cleanup here can be useful if the element isn't fully removed immediately.
    // Remove document/global listeners if not already handled by disconnectedCallback firing
    document.removeEventListener("survey:question", this.handleEvent);
    document.removeEventListener("DOMContentLoaded", this.domReadyCallback); // Should already be removed

  }

  togglePopupCollapse = () => {
    // Only makes sense for popup theme
    /*if (this.getAttribute('theme') !== 'popup') {
      console.warn("AdlSurvey togglePopupCollapse: Called on non-popup theme. Ignoring.");
      // Optionally, call full closeSurvey as fallback?
      // this.closeSurvey();
      return;
    }*/

    this.isPopupCollapsed = !this.isPopupCollapsed;
    console.log(`AdlSurvey togglePopupCollapse: Setting collapsed state to ${this.isPopupCollapsed}`);

    // Update the attribute which triggers CSS changes
    this.updateCollapsedAttribute();

    // Optional: Dispatch an event indicating the toggle
    try {
      this.dispatchEvent(new CustomEvent('adl-survey:toggled', {
        detail: { collapsed: this.isPopupCollapsed },
        bubbles: true,
        composed: true
      }));
      console.log("AdlSurvey togglePopupCollapse: Dispatched 'adl-survey:toggled' event.");
    } catch (e) {
      console.error("AdlSurvey togglePopupCollapse: Error dispatching event:", e);
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