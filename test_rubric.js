const { evaluatePOA, SAMPLE_APPEALS, applyFindingFix } = require("./rubric.js");

console.log("=== VERIFYING ALL SAMPLE CATEGORIES ===");

let passed = true;

for (const [category, data] of Object.entries(SAMPLE_APPEALS)) {
  console.log(`\nTesting category: ${category} (${data.name})`);
  
  // Test Bad
  const badRes = evaluatePOA({ enforcementType: category, poaText: data.bad });
  console.log(`  - Bad POA score: ${badRes.finalScore}, criticals: ${badRes.counts.critical}`);
  if (badRes.finalScore >= 50) {
    console.error(`  FAIL: ${category} bad POA score must be < 50, got ${badRes.finalScore}`);
    passed = false;
  }
  if (badRes.counts.critical === 0) {
    console.error(`  FAIL: ${category} bad POA must fire criticals`);
    passed = false;
  }

  // Test Good
  const goodRes = evaluatePOA({ enforcementType: category, poaText: data.good });
  console.log(`  - Good POA score: ${goodRes.finalScore}, criticals: ${goodRes.counts.critical}`);
  if (goodRes.finalScore < 75) {
    console.error(`  FAIL: ${category} good POA score must be >= 75, got ${goodRes.finalScore}`);
    passed = false;
  }
  if (goodRes.counts.critical !== 0) {
    console.error(`  FAIL: ${category} good POA must have 0 criticals`);
    passed = false;
  }
}

// Test applyFindingFix
console.log("\nTesting applyFindingFix:");
const testBad = SAMPLE_APPEALS.inauthentic.bad;
const initialRes = evaluatePOA({ enforcementType: "inauthentic", poaText: testBad });
const topCritical = initialRes.findings.find(f => f.offendingText);
console.log("Initial critical finding:", topCritical.id, `"${topCritical.offendingText}"`);
const fixedText = applyFindingFix(testBad, topCritical);
console.log("Fixed text contains replacement:", !fixedText.includes(topCritical.offendingText));
if (fixedText.includes(topCritical.offendingText)) {
  console.error("FAIL: applyFindingFix failed to replace offending text");
  passed = false;
} else {
  console.log("PASS: applyFindingFix successfully replaced offending text");
}

console.log("\nFinal result:", passed ? "ALL CATEGORIES PASSED!" : "FAILED!");
process.exit(passed ? 0 : 1);
