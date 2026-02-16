const routes = {
  intro: [
    "Bienvenue à toi jeune flibustier !",
    "Qu'est-ce qui t'amène ici ?",
    "__CHOICES__"
  ],
  nom: [
    "Encore un qui vient me parler de Barbe d'Or...",
    "Lui et son équipage venaient souvent mais ils n'étaient pas très bavards.",
    "Quand il décidait de nous parler, il n'y en avait que pour son bateau...",
    "À part ça tu veux pas boire quel-",
    "Déjà repartit..."
  ],
  soif: [
    "Tu as soif ? Ça tombe bien, c'est un bar ici.",
    "Assieds-toi, je vais te servir.",
    "Tiens, je te mets la cuvée maison!"
  ],
  vieuxRoux: [
    "Le vieux roux, hein...",
    "On ne le vois plus trop ces derniers temps.",
    "Apparement il traîne vers le Sud.",
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

  // Si on tombe sur le marqueur de choix
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
  // On garde la question affichée
  textEl.textContent = "Qu'est-ce qui t'amène ici ?";
  arrowEl.style.display = "none";

  const opts = [
    { label: "Je veux en savoir plus sur Barbe d'Or", route: "nom" },
    { label: "J'ai soif", route: "soif" },
    { label: "Je cherche le vieux roux", route: "vieuxRoux" }
  ];

  opts.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      currentRoute = opt.route;
      dialogues = routes[currentRoute];
      index = 0;
      typeText();
    });
    choicesEl.appendChild(btn);
  });
}

function nextDialogue() {
  if (isTyping) return;

  index++;

  if (index < dialogues.length) {
    typeText();
  } else {
    // Fin du dialogue → retour aux choix
    returnToChoices();
  }
}


// Clic uniquement pour passer les lignes, pas quand il y a des choix
dialogueBox.addEventListener("click", () => {
  if (choicesEl.children.length === 0) {
    nextDialogue();
  }
});
function returnToChoices() {
  currentRoute = "intro";
  dialogues = routes[currentRoute];
  index = dialogues.length - 1; // positionne sur __CHOICES__
  typeText();
}
// Démarrage
typeText();