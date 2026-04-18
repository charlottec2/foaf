// Generate a short, readable invite code (e.g., FOAF-7K2P-9XQM)
export const generateInviteCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const block = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `FOAF-${block(4)}-${block(4)}`;
};
