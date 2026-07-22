// @ts-check

import { JaDyDoCo, createApp } from "../src/core/JaDyDoCo.js";

const app = createApp("#root");
const directApp = new JaDyDoCo(document.body);

app.render({
  tagName: "a",
  href: "/documentation",
  text: "Dokumentation",
  target: "_blank",
  rel: "noopener",
});

app.render({
  tagName: "img",
  src: "/logo.svg",
  alt: "JaDyDoCo",
  loading: "lazy",
});

app.render({
  tagName: "button",
  type: "button",
  text: "Speichern",
  events: {
    click: (event) => console.log(event.type),
  },
});

app.render({
  tagName: "form",
  method: "post",
  children: [
    {
      tagName: "input",
      type: "email",
      name: "email",
      required: true,
    },
    {
      tagName: "button",
      type: "submit",
      text: "Absenden",
    },
  ],
});

directApp.render({
  tagName: "select",
  name: "language",
  options: [
    { value: "de", text: "Deutsch", selected: true },
    { value: "en", text: "English" },
  ],
});

// An anchor uses href rather than src.
app.render({
  tagName: "a",
  // @ts-expect-error href is required by AnchorNode
  src: "/wrong",
  text: "Falsch",
});

// Images deliberately require accessible alternative text.
// @ts-expect-error alt is required by ImageNode
app.render({
  tagName: "img",
  src: "/missing-alt.svg",
});

// An explicit button type prevents accidental form submissions.
// @ts-expect-error type is required by ButtonNode
app.render({
  tagName: "button",
  text: "Ohne Typ",
});
