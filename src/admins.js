// STRIKTE LISTE: Nur diese E-Mail-Adressen haben Admin-Rechte.
// WICHTIG: Muss mit der Liste in firestore.rules (Funktion isAdmin) übereinstimmen!
export const ADMIN_EMAILS = [
  "ivan.trombino@outlook.de",
  "cordula.buhl@gmail.com"
];

export const isAdminUser = (user) =>
  !!user && !user.isAnonymous && !!user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
