import "../components/AdlSurvey";

export default {
  title: "Components/Survey",
  argTypes: {
    theme: { control: "text" },
    number: { control: "number" }
  },
};

const Template = ({ theme, number }) => {
  const survey = document.createElement("adl-survey");
  survey.setAttribute("theme", theme);
  survey.setAttribute("questions-per-page", number);

  return survey;
};

export const Primary = Template.bind({});
Primary.args = {
  theme: "occidente",
  number: 2
}