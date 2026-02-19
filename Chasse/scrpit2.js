const texts = {
  pont: [
    "Il n'y a pas l'air d'avoir que que ce soit d'intéressant ici.",
    "À moins que...",
    "Que faire ? :"
  ],

  trappe: [
    "Une trappe...",
    "Peut-être qu'il y a quelque chose en bas.",
    "Que faire ? :"
  ],

  cale: [
    "Là non plus il n'y a pas grand chose.",
    "C'est une porte au fond ?",
    "Que faire ? :"
  ],

  piece: [
    "On dirait la loge du capitaine.",
    "Peut-être que ces parchemins pourront m'aiguiller...",
    "Que faire ? :"
  ],

  intro: [
    "Te voilà à bord...",
    "Où veux-tu aller ?",
    "__CHOICES__"
  ]
};

let currentText = "intro";
let dialogues = texts[currentText];
let index = 0;
let charIndex = 0;
let isTyping = false;
let intervalId = null;

const textEl = document.getElementById("text");
const arrowEl = document.getElementById("arrow");
const dialogueBox = document.getElementById("dialogueBox");
const choicesEl = document.getElementById("choices");
const sceneEl = document.querySelector(".scene"); // pour changer le fond

// associe chaque scène à son image de fond
const backgrounds = {
  pont: "url('/Images/pont.png')",
  trappe: "url('/Images/trappe.png')",
  cale: "url('/Images/cale.png')",
  piece: "url('/Images/piece.png')",
  intro: "url('/Images/pont.png')" // fond par défaut pour l'intro
};

function updateBackground() {
  const bg = backgrounds[currentText];
  if (bg) {
    sceneEl.style.backgroundImage = bg;
    sceneEl.style.backgroundRepeat = "no-repeat";
    sceneEl.style.backgroundPosition = "center bottom";
    sceneEl.style.backgroundSize = "cover";
  }
}

function typeText() {
  isTyping = true;
  arrowEl.style.display = "none";
  choicesEl.innerHTML = "";
  textEl.textContent = "";
  charIndex = 0;

  const current = dialogues[index];

  // Si on tombe sur le marqueur de choix
  if (current === "__CHOICES__") {
    isTyping = false;
    showChoices();
    return;
  }

  intervalId = setInterval(() => {
    textEl.textContent += current[charIndex];
    charIndex++;

    if (charIndex >= current.length) {
      clearInterval(intervalId);
      isTyping = false;
      arrowEl.style.display = index < dialogues.length - 1 ? "block" : "none";
    }
  }, 40);
}

function showChoices() {
  textEl.textContent = "Où veux-tu aller ?";
  arrowEl.style.display = "none";

  const opts = [
    { label: "Aller sur le pont", key: "pont" },
    { label: "Ouvrir la trappe", key: "trappe" },
    { label: "Descendre à la cale", key: "cale" },
    { label: "Aller dans la pièce du capitaine", key: "piece" }
  ];

  opts.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      currentText = opt.key;
      dialogues = texts[currentText];
      index = 0;
      updateBackground();   // change le fond quand on change de lieu
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
    returnToChoices();
  }
}

function returnToChoices() {
  currentText = "intro";
  dialogues = texts[currentText];
  index = dialogues.length - 1; // tombe sur "__CHOICES__"
  updateBackground();           // fond de l'intro si tu veux
  typeText();
}

// clic pour avancer seulement si pas de choix affichés
dialogueBox.addEventListener("click", () => {
  if (choicesEl.children.length === 0) {
    nextDialogue();
  }
});

// Démarrage
updateBackground();
typeText();
