const adlSurveyBoccPfm = document.getElementById("adl-survey-bocc-pfm");
adlSurveyBoccPfm.addEventListener('adl-survey:closed', (event) => {
  console.log('Survey was closed with answers:', event.detail.answers);
  console.log('Survey was completed:', event.detail.completed);
});

const adlSurveyBoccLibreInversion = document.getElementById("adl-survey-bocc-libre-inversion");
adlSurveyBoccLibreInversion.addEventListener('adl-survey:closed', (event) => {
  console.log('Survey was closed with answers:', event.detail.answers);
  console.log('Survey was completed:', event.detail.completed);
});
