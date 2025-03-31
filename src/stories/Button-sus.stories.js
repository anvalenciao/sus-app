import "../components/Button.js";

export default {
  title: "Components/Button",
  argTypes: {
    text: { control: "text" },
    color: { control: "color" },
    size: { control: { type: "select", options: ["small", "medium", "large"] } },
  },
};

const Template = ({ text, color, size }) => {
  const button = document.createElement("button-component");
  button.setAttribute("text", text);
  button.setAttribute("color", color);
  button.setAttribute("size", size);
  return button;
};

export const Primary = Template.bind({});
Primary.args = {
  text: "Click me",
  color: "blue",
  size: "medium",
};