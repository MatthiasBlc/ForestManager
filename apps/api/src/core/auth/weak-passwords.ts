// Controle local des mots de passe faibles (aucun appel externe). La politique
// impose deja 10 caracteres : la liste ne garde que les mots de passe courants
// d'au moins 10 caracteres, completee par des regles (username, repetitions,
// suites).

const COMMON = new Set([
  "1234567890",
  "0123456789",
  "12345678910",
  "123456789a",
  "1234567890a",
  "a123456789",
  "qwertyuiop",
  "azertyuiop",
  "qwerty1234",
  "azerty1234",
  "qwertyuiop1",
  "azertyuiop1",
  "1q2w3e4r5t",
  "1a2z3e4r5t",
  "1qaz2wsx3edc",
  "qazwsxedcrfv",
  "zaq12wsxcde3",
  "asdfghjkl1",
  "password12",
  "password123",
  "password1234",
  "passw0rd123",
  "motdepasse",
  "motdepasse1",
  "motdepasse123",
  "mot2passe123",
  "iloveyou12",
  "iloveyou123",
  "jetaime123",
  "jetaime1234",
  "football12",
  "football123",
  "baseball12",
  "superman12",
  "superman123",
  "batman1234",
  "princess12",
  "princess123",
  "sunshine12",
  "sunshine123",
  "starwars12",
  "starwars123",
  "pokemon123",
  "pokemon1234",
  "doudou1234",
  "chouchou12",
  "chouchou123",
  "soleil1234",
  "marseille13",
  "marseille1",
  "liverpool1",
  "liverpool123",
  "chocolate1",
  "chocolat123",
  "welcome123",
  "welcome1234",
  "letmein123",
  "trustno1234",
  "administrator",
  "admin12345",
  "admin123456",
  "changeme123",
  "unknown1234",
  "computer12",
  "internet12",
  "dragon1234",
  "master1234",
  "monkey1234",
  "shadow1234",
  "michael123",
  "jennifer12",
  "charlie123",
  "forestmanager",
  "forestmanager1",
  "forestmanager123",
  "recettes123",
  "cuisine123",
]);

function isRepeated(password: string): boolean {
  return new Set(password).size <= 2;
}

/** Suite reguliere de caracteres : "abcdefghij", "9876543210". */
function isSequence(password: string): boolean {
  const steps = new Set<number>();
  for (let index = 1; index < password.length; index += 1) {
    steps.add(password.charCodeAt(index) - password.charCodeAt(index - 1));
  }
  return steps.size === 1 && (steps.has(1) || steps.has(-1));
}

/** Vrai si le mot de passe est trop facile a deviner pour ce compte. */
export function isWeakPassword(password: string, personal: readonly string[] = []): boolean {
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || isRepeated(lower) || isSequence(lower)) return true;
  return personal.some((value) => {
    const word = value.toLowerCase();
    return word.length >= 3 && lower.includes(word);
  });
}
