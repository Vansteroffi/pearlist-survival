const routes = {
  intro: [
    "Qui es-tu ??",
    "__CHOICES__"
  ],

  passer: [
    "Personne, je ne fais que passer.",
    "Dans ce cas là, bouge-toi de là."
  ],

  aventurier: [
    "Un aventurier à la recherche du trésor de Barbe d'Or.",
    "Et toi, qui es-tu ?",
    "Hum...",
    "Tu as dû trouver son journal.",
    "On m'appelait le Roux dans le temps...",
    "Tu peux m'appeler Edward.",
    "Nous n'étions pas très amis à la fin.",
    "Je ne sais pas ce qu'il en a fait.",
    "Et honnêtement, ça ne m'intéresse pas.",
    "Je ne veux plus rien avoir à faire avec lui.",
    "Écoute...",
    "Je crois que le barman le connaissait mieux.",
    "Va lui parler."
  ]
};

let currentRoute = "intro";
let dialogues = routes[currentRoute];
let index = 0;
let charIndex = 0;
let isTyping = false;
let intervalId = null;

const textEl = document.getElementById("text");
const arrowEl = document.getElementById("arrow");
const dialogueBox = document.getElementById("dialogueBox");
const choicesEl = document.getElementById("choices");

function typeText() {
  isTyping = true;
  arrowEl.style.display = "none";
  choicesEl.innerHTML = "";
  textEl.textContent = "";
  charIndex = 0;

  const currentText = dialogues[index];

  if (currentText === "__CHOICES__") {
    isTyping = false;
    showChoices();
    return;
  }

  intervalId = setInterval(() => {
    textEl.textContent += currentText[charIndex];
    charIndex++;

    if (charIndex >= currentText.length) {
      clearInterval(intervalId);
      isTyping = false;
      arrowEl.style.display = index < dialogues.length - 1 ? "block" : "none";
    }
  }, 40);
}

function showChoices() {
  textEl.textContent = "Qui es-tu ??";
  arrowEl.style.display = "none";

  const opts = [
    { label: "Personne, je ne fais que passer", route: "passer" },
    { label: "Un aventurier à la recherche du trésor de Barbe d'Or", route: "aventurier" }
  ];

  opts.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = opt.label;
    btn.onclick = () => {
      currentRoute = opt.route;
      dialogues = routes[currentRoute];
      index = 0;
      typeText();
    };
    choicesEl.appendChild(btn);
  });
}

function nextDialogue() {
  if (isTyping) return;

  index++;
  if (index < dialogues.length) {
    typeText();
  }
}

dialogueBox.addEventListener("click", () => {
  if (choicesEl.children.length === 0) {
    nextDialogue();
  }
});

typeText();
