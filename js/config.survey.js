// En este momento, se ejecuta el constructor() del componente
/*const adlSurvey = document.createElement("adl-survey");
adlSurvey.setAttribute("theme", "modal");
adlSurvey.setAttribute("questions-per-page", "1");
*/

const adlSurvey = document.querySelector("adl-survey");

adlSurvey.configure({
  theme: "modal",
  questionsPerPage: 1,
  questions: [],
  color: {
    color: "#000",
    backgroundColor: "#fff",
    buttonColor: "#fff",
    buttonBackgroundColor: "#008acc",
    buttonScaleColor: "#000",
    buttonScaleBackgroundColor: "#fff",
    buttonScaleBorderColor: "#8c9394"
  }
});

// En este momento, se ejecuta el connectedCallback() del componente
//document.body.append(adlSurvey);

adlSurvey.addEventListener('adl-survey:closed', (event) => {
  console.log('Survey was closed with answers:', event.detail.answers);
  console.log('Survey was completed:', event.detail.completed);
});
