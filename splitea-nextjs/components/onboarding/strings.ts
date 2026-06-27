// components/onboarding/strings.ts
// Onboarding-only translation dictionary (Option A) — keyed off the language the
// user picked in Settings (localStorage "spliteasy.lang"). No full-app i18n needed.

export type LangId = "en" | "fr" | "ar" | "es" | "de";

export interface OnboardingStrings {
  welcomeTitle: string;
  welcomeSubtitle: string;
  intro: string;
  step1Title: string; step1Desc: string;
  step2Title: string; step2Desc: string;
  step3Title: string; step3Desc: string;
  step4Title: string; step4Desc: string;
  checklistTitle: string;
  checklistSubtitle: string;
  progress: (done: number, total: number) => string;
  start: string;
  skip: string;
  finish: string;
  replay: string;
  done: string;
  go: string;
  // interactive tour
  takeTour: string;
  tourNext: string;
  tourBack: string;
  tourDone: string;
  tourSteps: Array<{ title: string; body: string }>;
}

const en: OnboardingStrings = {
  welcomeTitle: "Welcome to SplitEasy 👋",
  welcomeSubtitle: "Split expenses with friends — fairly and effortlessly.",
  intro: "SplitEasy keeps track of who owes who. Here's how to get started in 4 quick steps:",
  step1Title: "Create a group", step1Desc: "Start a group for a trip, home, or any shared spending.",
  step2Title: "Add members", step2Desc: "Invite the friends you share expenses with.",
  step3Title: "Add an expense", step3Desc: "Log what was paid and split it between members.",
  step4Title: "Settle up", step4Desc: "See who owes what and settle the balance in one tap.",
  checklistTitle: "Getting Started",
  checklistSubtitle: "Complete these steps to set up SplitEasy.",
  progress: (d, t) => `${d} of ${t} done`,
  start: "Get Started",
  skip: "Skip for now",
  finish: "Finish",
  replay: "Guide",
  done: "Done",
  go: "Go",
  takeTour: "Take a tour",
  tourNext: "Next",
  tourBack: "Back",
  tourDone: "Got it",
  tourSteps: [
    { title: "Your balances", body: "At a glance: what you're owed, what you owe, and what's pending." },
    { title: "Who owes who", body: "See exactly who owes you and who you need to pay — tap to settle." },
    { title: "Quick actions", body: "Add an expense, create a group, or settle up in one tap." },
    { title: "Replay anytime", body: "Stuck later? Click here to reopen this guide whenever you want." },
  ],
};

const fr: OnboardingStrings = {
  welcomeTitle: "Bienvenue sur SplitEasy 👋",
  welcomeSubtitle: "Partagez les dépenses entre amis — simplement et équitablement.",
  intro: "SplitEasy suit qui doit quoi à qui. Voici comment démarrer en 4 étapes :",
  step1Title: "Créer un groupe", step1Desc: "Créez un groupe pour un voyage, la maison, ou toute dépense partagée.",
  step2Title: "Ajouter des membres", step2Desc: "Invitez les amis avec qui vous partagez les dépenses.",
  step3Title: "Ajouter une dépense", step3Desc: "Enregistrez ce qui a été payé et répartissez-le entre les membres.",
  step4Title: "Régler les comptes", step4Desc: "Voyez qui doit quoi et réglez le solde en un clic.",
  checklistTitle: "Pour commencer",
  checklistSubtitle: "Complétez ces étapes pour configurer SplitEasy.",
  progress: (d, t) => `${d} sur ${t} terminé`,
  start: "Commencer",
  skip: "Plus tard",
  finish: "Terminer",
  replay: "Guide",
  done: "Fait",
  go: "Aller",
  takeTour: "Visite guidée",
  tourNext: "Suivant",
  tourBack: "Retour",
  tourDone: "Compris",
  tourSteps: [
    { title: "Vos soldes", body: "En un coup d'œil : ce qu'on vous doit, ce que vous devez, et ce qui est en attente." },
    { title: "Qui doit à qui", body: "Voyez précisément qui vous doit et qui vous devez payer — touchez pour régler." },
    { title: "Actions rapides", body: "Ajoutez une dépense, créez un groupe ou réglez en un clic." },
    { title: "Rejouer à tout moment", body: "Bloqué plus tard ? Cliquez ici pour rouvrir ce guide quand vous voulez." },
  ],
};

const ar: OnboardingStrings = {
  welcomeTitle: "مرحبًا بك في SplitEasy 👋",
  welcomeSubtitle: "قسّم المصاريف مع أصدقائك — بعدل وسهولة.",
  intro: "يتتبع SplitEasy من يدين لمن. إليك كيف تبدأ في 4 خطوات سريعة:",
  step1Title: "أنشئ مجموعة", step1Desc: "ابدأ مجموعة لرحلة أو المنزل أو أي مصاريف مشتركة.",
  step2Title: "أضف أعضاء", step2Desc: "ادعُ الأصدقاء الذين تتقاسم معهم المصاريف.",
  step3Title: "أضف مصروفًا", step3Desc: "سجّل ما تم دفعه وقسّمه بين الأعضاء.",
  step4Title: "سوّ الحساب", step4Desc: "اعرف من يدين بماذا وسوِّ الرصيد بنقرة واحدة.",
  checklistTitle: "البداية",
  checklistSubtitle: "أكمل هذه الخطوات لإعداد SplitEasy.",
  progress: (d, t) => `${d} من ${t} مكتمل`,
  start: "ابدأ",
  skip: "لاحقًا",
  finish: "إنهاء",
  replay: "الدليل",
  done: "تم",
  go: "اذهب",
  takeTour: "جولة تعريفية",
  tourNext: "التالي",
  tourBack: "رجوع",
  tourDone: "فهمت",
  tourSteps: [
    { title: "أرصدتك", body: "بنظرة سريعة: ما لك، وما عليك، وما هو قيد الانتظار." },
    { title: "من يدين لمن", body: "اعرف بالضبط من يدين لك ومن عليك أن تدفع له — انقر للتسوية." },
    { title: "إجراءات سريعة", body: "أضف مصروفًا أو أنشئ مجموعة أو سوِّ الحساب بنقرة واحدة." },
    { title: "أعد التشغيل في أي وقت", body: "تحتاج المساعدة لاحقًا؟ انقر هنا لإعادة فتح هذا الدليل متى شئت." },
  ],
};

const es: OnboardingStrings = {
  welcomeTitle: "Bienvenido a SplitEasy 👋",
  welcomeSubtitle: "Divide los gastos con amigos — de forma justa y sencilla.",
  intro: "SplitEasy lleva la cuenta de quién debe a quién. Empieza en 4 pasos rápidos:",
  step1Title: "Crea un grupo", step1Desc: "Crea un grupo para un viaje, el hogar o cualquier gasto compartido.",
  step2Title: "Añade miembros", step2Desc: "Invita a los amigos con quienes compartes gastos.",
  step3Title: "Añade un gasto", step3Desc: "Registra lo pagado y divídelo entre los miembros.",
  step4Title: "Salda cuentas", step4Desc: "Mira quién debe qué y salda el saldo con un toque.",
  checklistTitle: "Primeros pasos",
  checklistSubtitle: "Completa estos pasos para configurar SplitEasy.",
  progress: (d, t) => `${d} de ${t} hechos`,
  start: "Empezar",
  skip: "Más tarde",
  finish: "Finalizar",
  replay: "Guía",
  done: "Hecho",
  go: "Ir",
  takeTour: "Hacer un recorrido",
  tourNext: "Siguiente",
  tourBack: "Atrás",
  tourDone: "Entendido",
  tourSteps: [
    { title: "Tus saldos", body: "De un vistazo: lo que te deben, lo que debes y lo pendiente." },
    { title: "Quién debe a quién", body: "Mira exactamente quién te debe y a quién debes pagar — toca para saldar." },
    { title: "Acciones rápidas", body: "Añade un gasto, crea un grupo o salda cuentas en un toque." },
    { title: "Repetir cuando quieras", body: "¿Atascado luego? Haz clic aquí para reabrir esta guía cuando quieras." },
  ],
};

const de: OnboardingStrings = {
  welcomeTitle: "Willkommen bei SplitEasy 👋",
  welcomeSubtitle: "Teile Ausgaben mit Freunden — fair und mühelos.",
  intro: "SplitEasy verfolgt, wer wem was schuldet. So startest du in 4 schnellen Schritten:",
  step1Title: "Gruppe erstellen", step1Desc: "Starte eine Gruppe für eine Reise, Zuhause oder geteilte Ausgaben.",
  step2Title: "Mitglieder hinzufügen", step2Desc: "Lade die Freunde ein, mit denen du Ausgaben teilst.",
  step3Title: "Ausgabe hinzufügen", step3Desc: "Erfasse das Bezahlte und teile es unter den Mitgliedern auf.",
  step4Title: "Abrechnen", step4Desc: "Sieh, wer was schuldet, und gleiche den Saldo mit einem Tippen aus.",
  checklistTitle: "Erste Schritte",
  checklistSubtitle: "Schließe diese Schritte ab, um SplitEasy einzurichten.",
  progress: (d, t) => `${d} von ${t} erledigt`,
  start: "Loslegen",
  skip: "Später",
  finish: "Fertig",
  replay: "Anleitung",
  done: "Erledigt",
  go: "Los",
  takeTour: "Tour starten",
  tourNext: "Weiter",
  tourBack: "Zurück",
  tourDone: "Verstanden",
  tourSteps: [
    { title: "Deine Salden", body: "Auf einen Blick: was man dir schuldet, was du schuldest und was offen ist." },
    { title: "Wer wem schuldet", body: "Sieh genau, wer dir schuldet und wen du bezahlen musst — zum Ausgleichen tippen." },
    { title: "Schnellaktionen", body: "Ausgabe hinzufügen, Gruppe erstellen oder abrechnen mit einem Tippen." },
    { title: "Jederzeit wiederholen", body: "Später nicht weiter? Klicke hier, um diese Anleitung erneut zu öffnen." },
  ],
};

const DICT: Record<LangId, OnboardingStrings> = { en, fr, ar, es, de };

export function getOnboardingStrings(lang: string | null | undefined): OnboardingStrings {
  return DICT[(lang as LangId) in DICT ? (lang as LangId) : "en"];
}
