/** Deterministic visual / validation fixtures for Arabic + English chat. */
export const MESSAGE_FIXTURES = {
  english: "I miss you",
  arabic: "اشتقتلك",
  arabicFirstMixed: "بحبك so much ❤️",
  englishFirstMixed: "I love you كتير ❤️",
  numbers: "بشوفك الساعة 8:30",
  url: "شوفي https://example.com",
  emoji: "❤️🥹",
  multiline: "بحبك\ngood night ❤️",
  mixedProduct: "طلبت iPhone اليوم",
  mixedTime: "بدي اشوفك at 8:00",
  saadName: "بحبك Saad ❤️",
  talaName: "Tala بحبك ❤️",
  punctuationMixed: "وينك؟! wait—now??",
  longEnglish:
    "I keep thinking about last night and how quiet the room felt after you fell asleep. I wanted to tell you in the morning but the words sat with me instead, warm and a little shy, like they were waiting for the right pause.",
  longArabic:
    "كل يوم بفتقدك أكتر، وبحكي معك بالمسا حتى لو الشات ساكت. بحب التفاصيل الصغيرة: صوتك، ضحكتك، وطريقة ما بتقولي تصبح على خير. اشتقتلك كتير اليوم.",
  arabicEnglishUrl: "شوفي https://example.com وقولي لي رأيك كتير ❤️",
} as const;

export const MESSAGE_FIXTURE_LIST = Object.values(MESSAGE_FIXTURES);
