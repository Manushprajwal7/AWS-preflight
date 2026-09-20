const { evaluatePOA, detectSections, EXAMPLE_GOOD } = require("./rubric.js");

console.log("=== RUNNING EDGE CASE & REGRESSION SUITE (test_edge.js) ===\n");

let passed = true;

// 1. Empty string: score 0, does not throw
try {
  const resEmpty = evaluatePOA({ poaText: "" });
  if (resEmpty.finalScore === 0) {
    console.log("PASS 1: Empty string returns score 0 without throwing");
  } else {
    console.error("FAIL 1: Empty string should return score 0, got:", resEmpty.finalScore);
    passed = false;
  }
} catch (err) {
  console.error("FAIL 1: Empty string threw error:", err);
  passed = false;
}

// 2. "help": REJECTED, does not throw
try {
  const resHelp = evaluatePOA({ poaText: "help" });
  if (resHelp.verdict === "WOULD BE REJECTED" && resHelp.finalScore < 50) {
    console.log("PASS 2: 'help' returns WOULD BE REJECTED without throwing (score:", resHelp.finalScore, ")");
  } else {
    console.error("FAIL 2: 'help' should be rejected, got verdict:", resHelp.verdict);
    passed = false;
  }
} catch (err) {
  console.error("FAIL 2: 'help' threw error:", err);
  passed = false;
}

// 3. Good POA, no headings (Item 2 fix): score >= 60, STRUCT_NO_SECTIONS present but NOT critical
try {
  const goodNoHeadings = EXAMPLE_GOOD
    .replace(/^1\.\s*ROOT\s*CAUSE.*$/mi, "")
    .replace(/^2\.\s*IMMEDIATE\s*CORRECTIVE.*$/mi, "")
    .replace(/^3\.\s*LONG-TERM\s*PREVENTIVE.*$/mi, "")
    .trim();

  const resGoodNoHeadings = evaluatePOA({ enforcementType: "inauthentic", poaText: goodNoHeadings });
  const structFinding = resGoodNoHeadings.findings.find(f => f.id === "STRUCT_NO_SECTIONS");

  console.log("Good POA with no headings -> score:", resGoodNoHeadings.finalScore, "verdict:", resGoodNoHeadings.verdict);
  console.log("STRUCT_NO_SECTIONS finding:", structFinding ? structFinding.severity : "NOT FOUND");

  if (resGoodNoHeadings.finalScore >= 60 && resGoodNoHeadings.finalScore <= 74 && resGoodNoHeadings.verdict === "AT RISK") {
    console.log("PASS 3a: Good POA with no headings scores between 60 and 74 (" + resGoodNoHeadings.finalScore + ") and verdict is AT RISK");
  } else {
    console.error("FAIL 3a: Good POA with no headings must score 60 <= score <= 74 with AT RISK verdict, got:", resGoodNoHeadings.finalScore, resGoodNoHeadings.verdict);
    passed = false;
  }

  if (structFinding && structFinding.severity === "high") {
    console.log("PASS 3b: STRUCT_NO_SECTIONS is severity 'high' (not critical)");
  } else {
    console.error("FAIL 3b: STRUCT_NO_SECTIONS must be high, got:", structFinding ? structFinding.severity : "null");
    passed = false;
  }

  const hasCritical = resGoodNoHeadings.findings.some(f => f.severity === "critical");
  if (!hasCritical) {
    console.log("PASS 3c: 0 critical findings triggered on strong POA without headings");
  } else {
    console.error("FAIL 3c: Strong POA without headings should have 0 critical findings, got criticals:",
      resGoodNoHeadings.findings.filter(f => f.severity === "critical").map(f => f.id)
    );
    passed = false;
  }
} catch (err) {
  console.error("FAIL 3: Good POA without headings threw error:", err);
  passed = false;
}

// 4. Inline-heading POA (Item 3): hasHeadings: true, all three sections non-empty
try {
  const inlineText = "Root Cause: our supplier verification failed. Corrective Actions: we have removed all units. Preventive Measures: weekly audit with owner.";
  const detection = detectSections(inlineText);

  if (detection.hasHeadings &&
      detection.sections.rootCause.trim().length > 0 &&
      detection.sections.corrective.trim().length > 0 &&
      detection.sections.preventive.trim().length > 0) {
    console.log("PASS 4: Inline-heading POA detected headings and populated all 3 sections");
    console.log("  - rootCause:", detection.sections.rootCause);
    console.log("  - corrective:", detection.sections.corrective);
    console.log("  - preventive:", detection.sections.preventive);
  } else {
    console.error("FAIL 4: Inline-heading POA failed detection:", detection);
    passed = false;
  }
} catch (err) {
  console.error("FAIL 4: Inline detection threw error:", err);
  passed = false;
}

// 5. Polite but contentless text: REJECTED, fires RC_* and CA_* findings
try {
  const politeText = "Dear Amazon Seller Performance Team, hope this message finds you well. We are very pleased to write this appeal. We kindly request you to look into our account. Thank you very much for your time, patience, and cooperation. Have a wonderful day.";
  const resPolite = evaluatePOA({ poaText: politeText });

  const hasRC = resPolite.findings.some(f => f.id.startsWith("RC_"));
  const hasCA = resPolite.findings.some(f => f.id.startsWith("CA_"));

  if (resPolite.verdict === "WOULD BE REJECTED" && hasRC && hasCA) {
    console.log("PASS 5: Polite but contentless text is REJECTED and fires RC_* and CA_* findings");
  } else {
    console.error("FAIL 5: Polite text check failed. verdict:", resPolite.verdict, "hasRC:", hasRC, "hasCA:", hasCA);
    passed = false;
  }
} catch (err) {
  console.error("FAIL 5: Polite text threw error:", err);
  passed = false;
}

// 6. 5,000 words of repeated text: completes under 500ms, does not hang
try {
  const sampleChunk = "On August 14, 2026, our warehouse received inventory batch #492 from distributor Apex Goods LLC without verifying commercial invoices or brand authorization agreements. ";
  const repeatCount = Math.ceil(5000 / sampleChunk.split(/\s+/).length);
  const largeText = sampleChunk.repeat(repeatCount);

  const t0 = performance.now();
  const resLarge = evaluatePOA({ poaText: largeText });
  const elapsed = performance.now() - t0;

  console.log(`Large text test (${resLarge.wordCount} words) completed in ${elapsed.toFixed(1)}ms`);

  if (elapsed < 500) {
    console.log(`PASS 6: 5,000 words processed in under 500ms (${elapsed.toFixed(1)}ms)`);
  } else {
    console.error(`FAIL 6: 5,000 words took too long: ${elapsed.toFixed(1)}ms (threshold 500ms)`);
    passed = false;
  }
} catch (err) {
  console.error("FAIL 6: Large text processing threw error:", err);
  passed = false;
}

console.log("\n==================================================");
console.log(passed ? "ALL 6 EDGE CASE & REGRESSION TESTS PASSED!" : "SOME EDGE CASE TESTS FAILED!");
console.log("==================================================");

process.exit(passed ? 0 : 1);
