import { phoneLookupCandidates } from "../src/lib/auth/identifier";

let passed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

const sriLankan = phoneLookupCandidates("077 123 4567");
check("Sri Lankan local input resolves to its complete E.164 number", sriLankan.includes("+94771234567"), JSON.stringify(sriLankan));
check("legacy local storage is a precise fallback, not a suffix search", sriLankan.includes("077 123 4567") && !sriLankan.some((candidate) => candidate === "771234567"), JSON.stringify(sriLankan));

const uk = phoneLookupCandidates("+44 7712 34567");
check("foreign input retains its own complete country code", uk.length === 2 && uk[0] === "+44771234567", JSON.stringify(uk));
check("same-ending Sri Lankan and UK numbers remain different identities", !uk.includes("+94771234567"), JSON.stringify(uk));

check("invalid short input never becomes a lookup key", phoneLookupCandidates("771234").length === 0);

console.log(`\n${passed} phone-identifier checks passed.`);
