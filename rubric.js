/**
 * Preflight - Deterministic Rubric Engine for Amazon Seller POAs
 * Strictly adheres to PRD.md specifications.
 */

// 5.4 Enforcement-type keyword map
const ENFORCEMENT_KEYWORDS = {
  inauthentic:         ["invoice", "supplier", "authori", "sourcing", "distributor", "receipt"],
  counterfeit:         ["authori", "brand", "licen", "distributor", "invoice", "genuine"],
  safety:              ["recall", "expiry", "expiration", "storage", "temperature", "safety", "hazard"],
  condition:           ["condition", "inspect", "packaging", "grading", "used", "new", "refurb"],
  ip_complaint:        ["rights owner", "retract", "licen", "trademark", "copyright", "permission"],
  review_manipulation: ["review", "incentiv", "solicit", "feedback", "policy", "third party"],
  late_shipment:       ["carrier", "ship", "handling time", "fulfil", "tracking", "inventory"],
  linked_account:      ["account", "relationship", "disclose", "ownership", "separate", "ip address"],
  other:               []
};

// 7. Demo content
const EXAMPLE_BAD = `Dear Amazon Team, I don't know why my account was suspended, it must be a system error on your side. I have been selling for 5 years with no problems. The buyer lied about the product being inauthentic. I will be more careful in future and make sure this does not happen again. Please reinstate my account immediately, my family depends on this income. If not I will have to contact my lawyer.`;

const EXAMPLE_GOOD = `1. ROOT CAUSE ANALYSIS
On August 14, 2026, our seller account was suspended for inauthentic complaints regarding ASIN B08N5WRWNW (SonicClean Electric Toothbrush). We take full responsibility for this operational failure.

Our internal investigation revealed the following root causes:
- Sourcing oversight: We purchased 120 units of ASIN B08N5WRWNW from an unauthorized liquidation vendor (Apex Goods LLC) on July 22, 2026, without verifying their authorization credentials or distributor chain.
- Inadequate intake inspection: Our warehouse receiving staff did not inspect manufacturer serial numbers, holographic security seals, or packaging barcodes against brand specifications prior to inventory ingestion.
- Missing chain of custody: We failed to obtain itemized commercial invoices or manufacturer licensing agreements before listing inventory on Amazon Seller Central.

2. IMMEDIATE CORRECTIVE ACTIONS TAKEN
Upon notification of suspension on August 15, 2026, we executed the following corrective measures:
- Immediate inventory removal: We removed all 84 remaining units of ASIN B08N5WRWNW from FBA fulfillment centers under removal order #94821 and scheduled them for certified disposal.
- Supplier relationship terminated: We formally ceased all business operations with Apex Goods LLC on August 16, 2026, and canceled open purchase orders.
- Full customer resolution: We audited all 36 customer orders for this ASIN, issued complete proactive refunds totaling $2,844.00, and responded to all customer inquiries.
- Comprehensive inventory audit: We conducted a complete physical audit of all 450 active SKUs in our warehouse to verify authentic supplier invoices for every listed unit.
- Attached documentation: We have attached supplier invoice #INV-7721, disposal verification receipt #DIS-309, and credit memo proofs.

3. LONG-TERM PREVENTIVE MEASURES
To prevent recurrence, we have implemented the following systemic controls:
- Authorized supplier verification policy: Our Operations Director now requires direct brand authorization letters and verified manufacturer distribution agreements prior to purchasing any new inventory.
- Mandatory 3-stage receiving SOP: Our Warehouse Quality Manager conducts a daily inspection protocol verifying batch lot numbers, UPC barcodes, and seals against official brand packaging standards.
- Inventory management software integration: We deployed InventoryLab compliance tracking, which automatically locks any SKU from listing unless verified commercial invoices are uploaded and approved.
- Weekly compliance reviews: Our Compliance Lead conducts a weekly audit of supplier invoices and Amazon Account Health metrics to ensure strict adherence to Amazon Anti-Counterfeiting Policies.`;

/**
 * 5.2 Section Detection
 */
function detectSections(poaText) {
  const lines = poaText.split(/\r?\n/);
  
  // Detect by heading match, case-insensitive, at line start (PRD 5.2)
  const headingPatterns = {
    rootCause: /^\s*(?:#+\s*|\*{1,2}\s*|\d+[\.:\)]\s*|-+\s*)?(?:primary\s+|underlying\s+)?(root\s*cause|reason|what\s*happened|why\s*this\s*happened|cause\s*of)\b/i,
    corrective: /^\s*(?:#+\s*|\*{1,2}\s*|\d+[\.:\)]\s*|-+\s*)?(?:immediate\s+|urgent\s+)?(corrective|actions?\s*taken|immediate\s*actions?|steps?\s*taken|what\s*we\s*have\s*done)\b/i,
    preventive: /^\s*(?:#+\s*|\*{1,2}\s*|\d+[\.:\)]\s*|-+\s*)?(?:long[- ]term\s+|future\s+)?(preventive|preventative|prevent|future|going\s*forward|long[- ]term|steps?\s*to\s*prevent)\b/i
  };

  const detected = [];

  lines.forEach((line, index) => {
    // Headings are typically succinct header lines (< 120 chars)
    if (line.trim().length > 0 && line.trim().length < 120) {
      for (const [sectionKey, regex] of Object.entries(headingPatterns)) {
        if (regex.test(line)) {
          detected.push({ sectionKey, lineIndex: index, lineText: line });
          break;
        }
      }
    }
  });

  // Inline Heading Detection Fallback (contents-to-build.md Item 3)
  // If line-based detection found < 2 headings, run a second pass with global inline regex
  if (detected.length < 2) {
    const INLINE_HEADING = /(root\s*cause|reason\s*for|what\s*happened|corrective\s*actions?|actions?\s*taken|steps?\s*taken|preventive(?:\s*measures?|\s*actions?|\s*steps?)?|preventative(?:\s*measures?|\s*actions?|\s*steps?)?|steps?\s*to\s*prevent|going\s*forward)\s*[:\-–]/gi;
    let match;
    const inlineMatches = [];

    while ((match = INLINE_HEADING.exec(poaText)) !== null) {
      const s = match[1].toLowerCase();
      let sectionKey = null;
      if (/root\s*cause|reason\s*for|what\s*happened/i.test(s)) sectionKey = "rootCause";
      else if (/corrective|actions?\s*taken|steps?\s*taken/i.test(s)) sectionKey = "corrective";
      else if (/preventive|preventative|steps?\s*to\s*prevent|going\s*forward/i.test(s)) sectionKey = "preventive";

      if (sectionKey) {
        inlineMatches.push({ sectionKey, index: match.index });
      }
    }

    const distinctKeys = new Set(inlineMatches.map(m => m.sectionKey));
    if (distinctKeys.size >= 2) {
      inlineMatches.sort((a, b) => a.index - b.index);
      const sections = {
        rootCause: "",
        corrective: "",
        preventive: ""
      };
      const order = [];

      for (let i = 0; i < inlineMatches.length; i++) {
        const cur = inlineMatches[i];
        const next = inlineMatches[i + 1];
        const start = cur.index;
        const end = next ? next.index : poaText.length;
        const content = poaText.slice(start, end).trim();
        sections[cur.sectionKey] = (sections[cur.sectionKey] ? sections[cur.sectionKey] + "\n" : "") + content;
        if (!order.includes(cur.sectionKey)) {
          order.push(cur.sectionKey);
        }
      }

      return {
        hasHeadings: true,
        sections,
        order,
        confidenceMultiplier: 0.9
      };
    }
  }

  // If no headings found, treat as unsectioned (PRD 5.2)
  if (detected.length === 0) {
    const totalLength = poaText.length;
    const third = Math.floor(totalLength / 3);
    return {
      hasHeadings: false,
      sections: {
        rootCause: poaText.slice(0, third),
        corrective: poaText.slice(third, third * 2),
        preventive: poaText.slice(third * 2)
      },
      order: [],
      confidenceMultiplier: 0.8
    };
  }

  // Extract sections based on detected heading indices
  detected.sort((a, b) => a.lineIndex - b.lineIndex);

  const sections = {
    rootCause: "",
    corrective: "",
    preventive: ""
  };
  const order = detected.map(d => d.sectionKey);

  for (let i = 0; i < detected.length; i++) {
    const current = detected[i];
    const startLine = current.lineIndex;
    const endLine = (i + 1 < detected.length) ? detected[i + 1].lineIndex : lines.length;
    const content = lines.slice(startLine, endLine).join("\n");
    sections[current.sectionKey] = (sections[current.sectionKey] ? sections[current.sectionKey] + "\n" : "") + content;
  }

  return {
    hasHeadings: true,
    sections,
    order,
    confidenceMultiplier: 1.0
  };
}

/**
 * Utility: count words
 */
function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Utility: extract match snippet for highlight
 */
function extractSnippet(text, regex) {
  const match = text.match(regex);
  return match ? match[0] : null;
}

/**
 * Check 1: Root cause specificity (weight 22%)
 */
function evaluateRootCause(sectionText, confidenceMultiplier) {
  let score = 100;
  const findings = [];

  if (!sectionText || !sectionText.trim()) {
    return {
      score: 0,
      findings: [{
        id: "RC_EMPTY",
        severity: "critical",
        section: "rootCause",
        title: "Root cause section is missing or empty",
        explanation: "Amazon requires a clear, detailed Root Cause Analysis identifying the exact operational failure.",
        offendingText: null,
        suggestion: "Add a dedicated Root Cause section explaining what went wrong in your operations, naming specific suppliers, dates, and inventory batches."
      }]
    };
  }

  // Vague cause (-45, critical)
  const vagueRegex = /\b(system (error|glitch)|technical (error|glitch)|misunderstanding|miscommunication|not sure|unsure|don'?t know|may have been|might have been|possibly|somehow|unknown reason)\b/i;
  const vagueMatch = extractSnippet(sectionText, vagueRegex);
  if (vagueMatch) {
    score -= 45;
    findings.push({
      id: "RC_VAGUE",
      severity: "critical",
      section: "rootCause",
      title: "Your root cause is vague",
      explanation: `You wrote "${vagueMatch}". Amazon reads that as "I have not investigated". They need to see which part of your operation failed.`,
      offendingText: vagueMatch,
      suggestion: "Name the specific operational step that failed. Example: 'We sourced 40 units from an unverified liquidator without requesting authorization certificates or itemized invoices.'",
      evidence: {
        claim: "Vague explanations such as 'system error' or 'misunderstanding' are reported to fail automated and human review",
        source: "DAM Law Firm: Amazon Account Suspension Appeal Guide (2026)",
        url: "https://damlawfirm.com/blog/amazon-account-suspension-appeal-2026/"
      }
    });
  }

  // Blame-shifting (-40, critical)
  const blameRegex = /\b(amazon('s)? (error|mistake|fault|system)|buyer lied|customer lied|false (claim|complaint)|competitor|malicious (buyer|seller)|unfair)\b/i;
  const blameMatch = extractSnippet(sectionText, blameRegex);
  if (blameMatch) {
    score -= 40;
    findings.push({
      id: "RC_BLAME",
      severity: "critical",
      section: "rootCause",
      title: "Blame-shifting detected",
      explanation: `You wrote "${blameMatch}". Blaming buyers, competitors, or Amazon's system is an immediate rejection signal. Amazon expects sellers to take full operational accountability.`,
      offendingText: blameMatch,
      suggestion: "Take complete ownership. Rather than asserting the buyer lied, explain what gap in packaging, inspection, or authenticity verification led to the complaint.",
      evidence: {
        claim: "Appeals rejected within minutes, consistent with automated triage when blaming Amazon or buyers",
        source: "Seller Central: Appeal rejected in 4 minutes?!",
        url: "https://sellercentral.amazon.com/seller-forums/discussions/t/6d44201f-0fe5-40db-9586-aea1e77b59ec"
      }
    });
  }

  // No specificity (-30, high): no digit, no date, no quantity, no proper noun
  const hasDigit = /\d/.test(sectionText);
  const hasMonth = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(sectionText);
  const hasQuantityWord = /\b(\d+|units|items|order|batch|sku|asin|pieces|shipment)\b/i.test(sectionText);
  if (!hasDigit && !hasMonth && !hasQuantityWord) {
    score -= 30;
    findings.push({
      id: "RC_NO_SPECIFICS",
      severity: "high",
      section: "rootCause",
      title: "Root cause lacks specific operational data",
      explanation: "Your root cause contains no dates, unit quantities, order numbers, or specific identifiers.",
      offendingText: null,
      suggestion: "Cite exact numbers: 'On [Date], we purchased [Quantity] units of ASIN [B0...] under Purchase Order #[ID] from [Supplier Name].'"
    });
  }

  // No process named (-25, high)
  const processRegex = /\b(process|procedure|supplier|sourcing|inventory|listing|receiving|inspection|training|staff|vendor|invoice|packaging|storage|quality|workflow|system)\b/i;
  if (!processRegex.test(sectionText)) {
    score -= 25;
    findings.push({
      id: "RC_NO_PROCESS",
      severity: "high",
      section: "rootCause",
      title: "No business process or workflow named",
      explanation: "Amazon wants to know which specific operational procedure broke down.",
      offendingText: null,
      suggestion: "Reference the exact procedure that failed, such as 'intake receiving inspection', 'catalog listing review', or 'supplier onboarding verification'."
    });
  }

  // Denial (-35, critical)
  const denialRegex = /\b(did not violate|no violation|we are innocent|nothing wrong|not our fault|wrongly (suspended|flagged))\b/i;
  const denialMatch = extractSnippet(sectionText, denialRegex);
  if (denialMatch) {
    score -= 35;
    findings.push({
      id: "RC_DENIAL",
      severity: "critical",
      section: "rootCause",
      title: "Denial of violation",
      explanation: `You wrote "${denialMatch}". Denying the issue or insisting on innocence prevents the reviewer from verifying that you understand Amazon policy.`,
      offendingText: denialMatch,
      suggestion: "Acknowledge the policy violation directly and focus on demonstrating how you diagnosed the operational root cause.",
      evidence: {
        claim: "Denial of violation without presenting root cause diagnostics triggers immediate appeal rejection",
        source: "Seller Central: Appeal rejected in 4 minutes?!",
        url: "https://sellercentral.amazon.com/seller-forums/discussions/t/6d44201f-0fe5-40db-9586-aea1e77b59ec"
      }
    });
  }

  // Too short (-20, medium)
  const words = countWords(sectionText);
  if (words < 40) {
    score -= 20;
    findings.push({
      id: "RC_THIN",
      severity: "medium",
      section: "rootCause",
      title: "Root cause explanation is too brief",
      explanation: `Your root cause is only ${words} words. Sections under 40 words signal superficial analysis.`,
      offendingText: null,
      suggestion: "Expand your root cause to 60–120 words detailing exactly what occurred, who was involved, and why standard safeguards failed."
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score * confidenceMultiplier)));
  return { score, findings };
}

/**
 * Check 2: Corrective actions completed (weight 18%)
 */
function evaluateCorrective(sectionText, enforcementType, confidenceMultiplier) {
  let score = 100;
  const findings = [];

  if (!sectionText || !sectionText.trim()) {
    return {
      score: 0,
      findings: [{
        id: "CA_EMPTY",
        severity: "critical",
        section: "corrective",
        title: "Corrective actions section is missing or empty",
        explanation: "Amazon requires proof of immediate actions already completed to remedy the violation.",
        offendingText: null,
        suggestion: "Add a 'Immediate Corrective Actions Taken' section detailing inventory removed, buyers refunded, and listings closed."
      }]
    };
  }

  const futureRegex = /\b(we will|we plan to|we intend to|we are going to|we would|we shall)\b/i;
  const pastVerbRegex = /\b(we have|has been|have been|removed|disposed|destroyed|deleted|stopped|ceased|suspended|contacted|obtained|retrained|corrected|updated|audited|reviewed|terminated)\b/i;

  const hasFuture = futureRegex.test(sectionText);
  const hasPast = pastVerbRegex.test(sectionText);

  // Future tense only (-45, critical)
  if (hasFuture && !hasPast) {
    const futureMatch = extractSnippet(sectionText, futureRegex);
    score -= 45;
    findings.push({
      id: "CA_FUTURE",
      severity: "critical",
      section: "corrective",
      title: "Corrective actions written as future intentions",
      explanation: `You wrote "${futureMatch}". Corrective actions must describe what you have ALREADY completed before submitting the appeal, not future plans.`,
      offendingText: futureMatch,
      suggestion: "Rewrite in the completed past tense: 'We have already removed all 84 units of ASIN B0... from FBA and issued full refunds to all affected buyers.'",
      evidence: {
        claim: "Appeals rejected within minutes, consistent with automated triage when corrective actions are future intentions",
        source: "Seller Central: Appeal rejected in 4 minutes?!",
        url: "https://sellercentral.amazon.com/seller-forums/discussions/t/6d44201f-0fe5-40db-9586-aea1e77b59ec"
      }
    });
  }

  // No completion verbs (-40, critical)
  if (!hasPast) {
    score -= 40;
    findings.push({
      id: "CA_NONE",
      severity: "critical",
      section: "corrective",
      title: "No completed action verbs found",
      explanation: "Amazon reviewers scan for active past-tense verbs proving that inventory was removed, refunded, or audited.",
      offendingText: null,
      suggestion: "Use explicit past-tense completion verbs: 'We removed...', 'We audited...', 'We terminated contracts with...', 'We refunded...'"
    });
  }

  // No specifics (-25, high): no digit, no ASIN pattern /\bB0[A-Z0-9]{8}\b/, no date
  const hasDigit = /\d/.test(sectionText);
  const hasAsin = /\bB0[A-Z0-9]{8}\b/i.test(sectionText);
  const hasDate = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(sectionText) ||
                  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(sectionText);

  if (!hasDigit && !hasAsin && !hasDate) {
    score -= 25;
    findings.push({
      id: "CA_NO_SPECIFICS",
      severity: "high",
      section: "corrective",
      title: "Corrective actions lack specific identifiers",
      explanation: "No ASINs, dates, or unit quantities were found in your corrective actions.",
      offendingText: null,
      suggestion: "Specify exact identifiers: 'On [Date], we recalled [X] units of ASIN [B0...] under removal order #[ID] and refunded $[Amount].'"
    });
  }

  // Not addressed to violation (-20, medium)
  const targetKeywords = ENFORCEMENT_KEYWORDS[enforcementType] || [];
  if (targetKeywords.length > 0) {
    const hasViolationKeyword = targetKeywords.some(kw => new RegExp(`\\b${kw}`, "i").test(sectionText));
    if (!hasViolationKeyword) {
      score -= 20;
      findings.push({
        id: "CA_OFF_TARGET",
        severity: "medium",
        section: "corrective",
        title: `Corrective actions not addressed to ${enforcementType.replace('_', ' ')} violation`,
        explanation: `Your suspension is marked as "${enforcementType}", but your corrective section does not mention relevant terms like ${targetKeywords.slice(0, 3).join(", ")}.`,
        offendingText: null,
        suggestion: `Explicitly address the enforcement issue. For ${enforcementType}, describe actions taken regarding ${targetKeywords.slice(0, 3).join(", ")}.`
      });
    }
  }

  // Too short (-20, medium)
  const words = countWords(sectionText);
  if (words < 40) {
    score -= 20;
    findings.push({
      id: "CA_THIN",
      severity: "medium",
      section: "corrective",
      title: "Corrective actions section is too brief",
      explanation: `Your corrective actions contain only ${words} words.`,
      offendingText: null,
      suggestion: "Detail at least 3 distinct actions taken: inventory removal/quarantine, customer refunds, and supplier audit."
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score * confidenceMultiplier)));
  return { score, findings };
}

/**
 * Check 3: Preventive measures are systemic (weight 18%)
 */
function evaluatePreventive(sectionText, confidenceMultiplier) {
  let score = 100;
  const findings = [];

  if (!sectionText || !sectionText.trim()) {
    return {
      score: 0,
      findings: [{
        id: "PM_EMPTY",
        severity: "critical",
        section: "preventive",
        title: "Preventive measures section is missing or empty",
        explanation: "Amazon requires long-term, systemic procedures that guarantee the issue cannot happen again.",
        offendingText: null,
        suggestion: "Add a 'Long-Term Preventive Measures' section detailing new SOPs, training schedules, software tools, and management audits."
      }]
    };
  }

  const vaguePromiseRegex = /\b(more careful|be careful|pay attention|double[- ]check|make sure|ensure that|try to|do our best|never happen again|will not happen)\b/i;
  const systemicRegex = /\b(process|procedure|policy|system|software|tool|audit|training|checklist|sop|standard operating|weekly|monthly|daily|quarterly|automated|verification|approval|supplier agreement|documentation)\b/i;

  const hasVaguePromise = vaguePromiseRegex.test(sectionText);
  const hasSystemic = systemicRegex.test(sectionText);

  // Vague promise only (-45, critical)
  if (hasVaguePromise && !hasSystemic) {
    const vagueMatch = extractSnippet(sectionText, vaguePromiseRegex);
    score -= 45;
    findings.push({
      id: "PM_VAGUE",
      severity: "critical",
      section: "preventive",
      title: "Vague promises without systemic controls",
      explanation: `You wrote "${vagueMatch}". A promise to "be more careful" is not an operational control. Amazon rejects promises that lack enforceable workflows.`,
      offendingText: vagueMatch,
      suggestion: "Replace promises with documented mechanisms: 'We implemented a mandatory 4-point receiving checklist and integrated automated batch verification software.'",
      evidence: {
        claim: "Appeals rejected within minutes when preventive measures lack enforceable mechanisms or SOPs",
        source: "Seller Central: Appeal rejected in 4 minutes?!",
        url: "https://sellercentral.amazon.com/seller-forums/discussions/t/6d44201f-0fe5-40db-9586-aea1e77b59ec"
      }
    });
  }

  // No systemic mechanism (-40, critical)
  if (!hasSystemic) {
    score -= 40;
    findings.push({
      id: "PM_NO_MECHANISM",
      severity: "critical",
      section: "preventive",
      title: "No systemic mechanisms or SOPs named",
      explanation: "No policies, software tools, SOPs, or inspection checklists were referenced in your preventive measures.",
      offendingText: null,
      suggestion: "Specify the exact systemic tool or procedure: 'We deployed InventoryLab for purchase order verification and created an internal SOP for supplier credential validation.'"
    });
  }

  // No cadence or owner (-22, high)
  const cadenceRegex = /\b(daily|weekly|bi-weekly|monthly|quarterly|annually|per shipment|every|each batch|ongoing)\b/i;
  const ownerRegex = /\b(manager|team|staff|owner|supervisor|designated|responsible|lead|director)\b/i;

  const hasCadence = cadenceRegex.test(sectionText);
  const hasOwner = ownerRegex.test(sectionText);

  if (!hasCadence && !hasOwner) {
    score -= 22;
    findings.push({
      id: "PM_NO_OWNER",
      severity: "high",
      section: "preventive",
      title: "No cadence or designated owner assigned",
      explanation: "Amazon wants to know WHO is responsible for enforcing preventive policies and HOW OFTEN reviews occur.",
      offendingText: null,
      suggestion: "Assign ownership and frequency: 'Our Quality Assurance Manager will conduct weekly spot-checks of 100% of received supplier invoices.'"
    });
  }

  // No verification step (-18, medium)
  const verifyRegex = /\b(verify|verification|audit|review|monitor|track|measure|report|check)\b/i;
  if (!verifyRegex.test(sectionText)) {
    score -= 18;
    findings.push({
      id: "PM_NO_VERIFY",
      severity: "medium",
      section: "preventive",
      title: "No verification or audit protocol",
      explanation: "A control must include a verification step to confirm that the policy is being actively followed.",
      offendingText: null,
      suggestion: "Include an auditing protocol: 'All inspection logs will be reviewed and signed off weekly by our Operations Director.'"
    });
  }

  // Too short (-20, medium)
  const words = countWords(sectionText);
  if (words < 40) {
    score -= 20;
    findings.push({
      id: "PM_THIN",
      severity: "medium",
      section: "preventive",
      title: "Preventive measures section is too brief",
      explanation: `Your preventive measures section contains only ${words} words.`,
      offendingText: null,
      suggestion: "Flesh out your preventive plan with 3–4 bulleted controls covering supplier verification, staff training, and ongoing compliance audits."
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score * confidenceMultiplier)));
  return { score, findings };
}

/**
 * Check 4: Accountability and tone (weight 15%) - checked across entire POA
 */
function evaluateTone(fullText) {
  let score = 100;
  const findings = [];

  // Emotional appeal (-35, high)
  const emotionalRegex = /\b(my family|feed my|please help|beg(ging)?|desperate|livelihood|children|mercy|humble request|kindly help|survive)\b/i;
  const emotionalMatch = extractSnippet(fullText, emotionalRegex);
  if (emotionalMatch) {
    score -= 35;
    findings.push({
      id: "TONE_EMOTIONAL",
      severity: "high",
      section: "tone",
      title: "Emotional appeal detected",
      explanation: `You wrote "${emotionalMatch}". Appeal reviewers evaluate compliance and operational safeguards. Emotional appeals distract from factual evidence and harm credibility.`,
      offendingText: emotionalMatch,
      suggestion: "Remove emotional language. Focus entirely on operational facts, root causes, and verifiable business controls."
    });
  }

  // Threat (-50, critical)
  const threatRegex = /\b(lawyer|attorney|legal action|sue|lawsuit|court|arbitration|media|press|social media|report you)\b/i;
  const threatMatch = extractSnippet(fullText, threatRegex);
  if (threatMatch) {
    score -= 50;
    findings.push({
      id: "TONE_THREAT",
      severity: "critical",
      section: "tone",
      title: "Threat of legal or public action",
      explanation: `You wrote "${threatMatch}". Mentioning lawyers, arbitration, lawsuits, or media exposure prompts immediate appeal rejection and escalation to Amazon legal counsel.`,
      offendingText: threatMatch,
      suggestion: "Delete all references to legal action, attorneys, or social media complaints. Maintain a respectful, professional, business-to-business tone.",
      evidence: {
        claim: "Legal threats or litigation demands escalate tickets to legal counsel, halting standard seller reinstatement",
        source: "Seller Central: 10+ Year Seller Wrongfully Suspended",
        url: "https://sellercentral.amazon.com/seller-forums/discussions/t/93d41a74-ee0a-40b2-b297-f34217f2cb56"
      }
    });
  }

  // Demanding (-35, high)
  const demandRegex = /\b(immediately reinstate|you must|demand|unacceptable|ridiculous|absurd|incompetent)\b/i;
  const demandMatch = extractSnippet(fullText, demandRegex);
  if (demandMatch) {
    score -= 35;
    findings.push({
      id: "TONE_DEMAND",
      severity: "high",
      section: "tone",
      title: "Demanding or confrontational tone",
      explanation: `You wrote "${demandMatch}". Demanding immediate reinstatement signals resistance to Amazon's compliance process.`,
      offendingText: demandMatch,
      suggestion: "Replace confrontational demands with a polite concluding request: 'Thank you for reviewing our plan of action. We respectfully request reinstatement of our selling privileges.'"
    });
  }

  // Excessive apology (-15, low)
  const apologyMatches = fullText.match(/\b(sorry|apologi[sz]e)\b/gi);
  if (apologyMatches && apologyMatches.length > 3) {
    score -= 15;
    findings.push({
      id: "TONE_APOLOGY",
      severity: "low",
      section: "tone",
      title: "Excessive apologizing",
      explanation: `You apologized ${apologyMatches.length} times. Excessive apologies make the document look unprofessional and dilute factual points.`,
      offendingText: apologyMatches[0],
      suggestion: "Limit apologies to a single opening statement of accountability. Focus on solutions and processes."
    });
  }

  // No ownership (-30, high)
  const ownershipRegex = /\b(we (take|accept|acknowledge)|our (responsibility|error|mistake|failure|oversight)|we failed|we did not)\b/i;
  if (!ownershipRegex.test(fullText)) {
    score -= 30;
    findings.push({
      id: "TONE_NO_OWNERSHIP",
      severity: "high",
      section: "tone",
      title: "Lack of direct ownership statement",
      explanation: "Amazon wants to see explicit acknowledgement that the seller accepts responsibility for the issue.",
      offendingText: null,
      suggestion: "Include an explicit ownership statement early in the document: 'We acknowledge and take full responsibility for our operational failure to verify supplier documentation.'",
      evidence: {
        claim: "Long-tenured sellers suspended and unable to get human review without structured operational accountability",
        source: "Seller Central: 10+ Year Seller Wrongfully Suspended",
        url: "https://sellercentral.amazon.com/seller-forums/discussions/t/93d41a74-ee0a-40b2-b297-f34217f2cb56"
      }
    });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, findings };
}

/**
 * Check 5: Evidence and documentation (weight 12%) - points additive, starts at 40
 */
function evaluateEvidence(fullText) {
  let score = 40;
  const findings = [];

  // Invoices referenced (+25)
  const invoiceRegex = /\b(invoice|receipt|purchase order|bill of lading|packing slip)\b/i;
  if (invoiceRegex.test(fullText)) {
    score += 25;
  }

  // Supplier named (+20)
  const supplierRegex = /\b(supplier|distributor|manufacturer|wholesaler|authori[sz]ed (dealer|reseller))\b/i;
  if (supplierRegex.test(fullText)) {
    score += 20;
  }

  // Documents attached (+15)
  const attachRegex = /\b(attach(ed|ment)?|enclosed|included|provided|submit(ted)?)\b.{0,30}\b(document|invoice|proof|evidence|certificate)\b/i;
  if (attachRegex.test(fullText)) {
    score += 15;
  }

  // Dates present (+10)
  const dateRegex = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i;
  const monthRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
  if (dateRegex.test(fullText) || monthRegex.test(fullText)) {
    score += 10;
  }

  // ASINs cited (+10)
  const asinRegex = /\bB0[A-Z0-9]{8}\b/;
  if (asinRegex.test(fullText)) {
    score += 10;
  }

  score = Math.max(0, Math.min(100, score));

  if (score < 60) {
    findings.push({
      id: "EVID_WEAK",
      severity: "medium",
      section: "evidence",
      title: "Minimal evidence and documentation cited",
      explanation: "Amazon appeals require concrete documentary references: commercial invoices, supplier agreements, and removal order IDs.",
      offendingText: null,
      suggestion: "Cite and attach specific documentation: 'Attached: Commercial Invoice #INV-1029 dated July 15, 2026 from authorized distributor [Name].'",
      evidence: {
        claim: "Appeals require concrete documentary proof: commercial invoices and verifiable supplier contacts",
        source: "DAM Law Firm: Amazon Account Suspension Appeal Guide (2026)",
        url: "https://damlawfirm.com/blog/amazon-account-suspension-appeal-2026/"
      }
    });
  }

  return { score, findings };
}

/**
 * Check 6: Structure and format (weight 10%)
 */
function evaluateStructure(detectionResult, fullText) {
  let score = 100;
  const findings = [];

  // Missing sections (-35 each)
  if (!detectionResult.hasHeadings) {
    score -= 70; // major structural failure
    findings.push({
      id: "STRUCT_NO_SECTIONS",
      severity: "high",
      section: "structure",
      title: "Missing standard 3-part structure",
      explanation: "Amazon automated classifiers and human reviewers look for three distinct, labeled sections: Root Cause, Corrective Actions, and Preventive Measures. Without these headings, appeals are frequently rejected on arrival.",
      offendingText: null,
      suggestion: "Organize your appeal with 3 clear numbered headings: '1. Root Cause Analysis', '2. Immediate Corrective Actions Taken', and '3. Long-Term Preventive Measures'.",
      evidence: {
        claim: "Appeals are reported to fail on structure rather than substance when 3 distinct sections are absent",
        source: "DAM Law Firm: Amazon Account Suspension Appeal Guide (2026)",
        url: "https://damlawfirm.com/blog/amazon-account-suspension-appeal-2026/"
      }
    });
  } else {
    const missing = [];
    if (!detectionResult.sections.rootCause.trim()) missing.push("Root Cause");
    if (!detectionResult.sections.corrective.trim()) missing.push("Corrective Actions");
    if (!detectionResult.sections.preventive.trim()) missing.push("Preventive Measures");

    if (missing.length > 0) {
      score -= (missing.length * 35);
      findings.push({
        id: "STRUCT_MISSING_SECTION",
        severity: "critical",
        section: "structure",
        title: `Missing required section: ${missing.join(", ")}`,
        explanation: `Your POA does not include identifiable content for: ${missing.join(", ")}. Amazon requires all three sections.`,
        offendingText: null,
        suggestion: `Add the missing section(s) (${missing.join(", ")}) using clear header titles.`
      });
    }

    // Wrong order (-10)
    const expectedOrder = ["rootCause", "corrective", "preventive"];
    const actualOrder = detectionResult.order;
    const isOrderCorrect = actualOrder.length === 3 &&
      actualOrder[0] === expectedOrder[0] &&
      actualOrder[1] === expectedOrder[1] &&
      actualOrder[2] === expectedOrder[2];

    if (actualOrder.length >= 2 && !isOrderCorrect) {
      score -= 10;
      findings.push({
        id: "STRUCT_WRONG_ORDER",
        severity: "low",
        section: "structure",
        title: "Sections are not in chronological order",
        explanation: "Amazon standard procedure expects Root Cause -> Corrective Actions -> Preventive Measures in that exact sequence.",
        offendingText: null,
        suggestion: "Rearrange sections so Root Cause is first, Corrective Actions second, and Preventive Measures third."
      });
    }
  }

  // No bullets or numbering (-20)
  const listRegex = /^\s*([-*•]|\d+[.)])/m;
  if (!listRegex.test(fullText)) {
    score -= 20;
    findings.push({
      id: "STRUCT_NO_LISTS",
      severity: "medium",
      section: "structure",
      title: "No bullet points or numbered lists",
      explanation: "Appeals formatted as solid text walls are hard to read and score poorly with automated intake classifiers.",
      offendingText: null,
      suggestion: "Convert individual actions and preventive steps into bullet points or numbered items for quick readability."
    });
  }

  // Wall of text (-20): any paragraph > 150 words
  const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim());
  const longParagraph = paragraphs.find(p => countWords(p) > 150);
  if (longParagraph) {
    score -= 20;
    findings.push({
      id: "STRUCT_WALL_OF_TEXT",
      severity: "medium",
      section: "structure",
      title: "Paragraph is too long (wall of text)",
      explanation: "Found a paragraph with more than 150 words. Reviewers scan fast and frequently miss key details in dense paragraphs.",
      offendingText: longParagraph.slice(0, 80) + "...",
      suggestion: "Break paragraphs over 100 words into shorter 2–3 sentence blocks and bulleted lists.",
      evidence: {
        claim: "Reviewers scan fast; dense text walls bury critical facts and lead to automated and human rejection",
        source: "DAM Law Firm: Amazon Account Suspension Appeal Guide (2026)",
        url: "https://damlawfirm.com/blog/amazon-account-suspension-appeal-2026/"
      }
    });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, findings };
}

/**
 * Check 7: Length and readability (weight 5%)
 */
function evaluateLength(fullText) {
  let score = 100;
  const findings = [];
  const words = countWords(fullText);

  if (words < 150) {
    score = 30;
    findings.push({
      id: "LEN_SHORT",
      severity: "medium",
      section: "length",
      title: "Appeal is too short",
      explanation: `Your appeal is only ${words} words. Appeals under 150 words rarely contain enough detail to satisfy Amazon's review criteria.`,
      offendingText: null,
      suggestion: "Aim for 250–700 words to comprehensively cover the root cause, immediate remedies, and long-term preventive processes."
    });
  } else if (words <= 250) {
    score = 70;
  } else if (words <= 700) {
    score = 100; // sweet spot
  } else if (words <= 1000) {
    score = 75;
  } else {
    score = 40;
    findings.push({
      id: "LEN_LONG",
      severity: "medium",
      section: "length",
      title: "Appeal is excessively long",
      explanation: `Your appeal is ${words} words. Appeals over 1000 words risk losing reviewer attention or burying vital facts.`,
      offendingText: null,
      suggestion: "Condense your appeal to 400–700 words by cutting repetitive sentences and background storytelling."
    });
  }

  // Sentence length check: average sentence length > 35 words -> -15
  const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 0) {
    const avgSentenceLength = words / sentences.length;
    if (avgSentenceLength > 35) {
      score -= 15;
      findings.push({
        id: "LEN_SENTENCES",
        severity: "low",
        section: "length",
        title: "Sentences are excessively long and complex",
        explanation: `Average sentence length is ${Math.round(avgSentenceLength)} words. Complex run-on sentences increase rejection risk.`,
        offendingText: null,
        suggestion: "Keep sentences concise (15–25 words). Clear, punchy statements are easier for classifiers and overseas agents to review."
      });
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, findings, wordCount: words, sentenceCount: sentences.length };
}

/**
 * 5.5 Master Evaluation Function
 */
function evaluatePOA(input) {
  const enforcementType = input.enforcementType || "inauthentic";
  const poaText = (input.poaText || "").trim();

  if (!poaText) {
    return {
      finalScore: 0,
      verdict: "WOULD BE REJECTED",
      verdictBand: "rejected",
      color: "red",
      isCapped: false,
      wordCount: 0,
      sentenceCount: 0,
      checks: {
        rootCause: { score: 0, findings: [] },
        corrective: { score: 0, findings: [] },
        preventive: { score: 0, findings: [] },
        tone: { score: 0, findings: [] },
        evidence: { score: 0, findings: [] },
        structure: { score: 0, findings: [] },
        length: { score: 0, findings: [] }
      },
      findings: [{
        id: "POA_EMPTY",
        severity: "critical",
        section: "rootCause",
        title: "No Plan of Action entered",
        explanation: "Paste your suspension reason and draft Plan of Action to begin analysis.",
        offendingText: null,
        suggestion: "Type or paste your appeal draft into the editor, or click 'Load Example' to test with sample appeals."
      }],
      counts: { critical: 1, high: 0, medium: 0, low: 0 }
    };
  }

  // 1. Detect sections
  const detection = detectSections(poaText);

  // 2. Run the 7 checks
  const checkRootCause = evaluateRootCause(detection.sections.rootCause, detection.confidenceMultiplier);
  const checkCorrective = evaluateCorrective(detection.sections.corrective, enforcementType, detection.confidenceMultiplier);
  const checkPreventive = evaluatePreventive(detection.sections.preventive, detection.confidenceMultiplier);
  const checkTone = evaluateTone(poaText);
  const checkEvidence = evaluateEvidence(poaText);
  const checkStructure = evaluateStructure(detection, poaText);
  const checkLength = evaluateLength(poaText);

  const checks = {
    rootCause: checkRootCause,
    corrective: checkCorrective,
    preventive: checkPreventive,
    tone: checkTone,
    evidence: checkEvidence,
    structure: checkStructure,
    length: checkLength
  };

  // Combine all findings
  const allFindings = [
    ...checkRootCause.findings,
    ...checkCorrective.findings,
    ...checkPreventive.findings,
    ...checkTone.findings,
    ...checkEvidence.findings,
    ...checkStructure.findings,
    ...checkLength.findings
  ];

  // Severity ordering: critical -> high -> medium -> low
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  allFindings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  // Counts
  const counts = {
    critical: allFindings.filter(f => f.severity === "critical").length,
    high: allFindings.filter(f => f.severity === "high").length,
    medium: allFindings.filter(f => f.severity === "medium").length,
    low: allFindings.filter(f => f.severity === "low").length
  };

  // 5.5 Calculate weighted score
  const weights = {
    rootCause: 0.22,
    corrective: 0.18,
    preventive: 0.18,
    tone: 0.15,
    evidence: 0.12,
    structure: 0.10,
    length: 0.05
  };

  let rawScore = 0;
  for (const [key, weight] of Object.entries(weights)) {
    rawScore += (checks[key].score * weight);
  }
  rawScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  // Critical override: if ANY finding has severity 'critical', cap at 49
  const hasCritical = counts.critical > 0;
  let isCapped = hasCritical && rawScore > 49;
  let finalScore = isCapped ? 49 : rawScore;

  // Round 3 Item 3: Calibrate the no-headings band
  // When all three sections are missing (hasHeadings === false), cap the final score at 74 — top of the AT RISK band.
  // Not a disqualifier, but never "likely to pass."
  if (!detection.hasHeadings && finalScore > 74) {
    finalScore = 74;
    isCapped = true;
  }

  // Verdict calculation
  let verdict = "WOULD BE REJECTED";
  let verdictBand = "rejected";
  let color = "red";

  if (finalScore >= 75) {
    verdict = "LIKELY TO PASS REVIEW";
    verdictBand = "pass";
    color = "green";
  } else if (finalScore >= 50) {
    verdict = "AT RISK";
    verdictBand = "risk";
    color = "amber";
  } else {
    verdict = "WOULD BE REJECTED";
    verdictBand = "rejected";
    color = "red";
  }

  return {
    finalScore,
    rawScore,
    isCapped,
    verdict,
    verdictBand,
    color,
    checks,
    findings: allFindings,
    counts,
    sections: detection.sections,
    hasHeadings: detection.hasHeadings,
    confidenceMultiplier: detection.confidenceMultiplier,
    wordCount: checkLength.wordCount,
    sentenceCount: checkLength.sentenceCount
  };
}

/**
 * Multi-Category Worked Examples (PRD §3 #7, §5.4, §7)
 */
const SAMPLE_APPEALS = {
  inauthentic: {
    name: "Inauthentic Items / Documentation",
    bad: EXAMPLE_BAD,
    good: EXAMPLE_GOOD
  },
  late_shipment: {
    name: "Late Shipment Rate / Fulfillment Defect",
    bad: `Dear Amazon, our carrier had delays due to bad weather which was beyond our control. We are innocent and our late shipment rate was affected unfairly. We will try our best and be more careful in the future to make sure this never happens again. Please restore our selling privileges right now.`,
    good: `1. ROOT CAUSE ANALYSIS
Between August 1 and August 12, 2026, our Late Shipment Rate (LSR) reached 7.4%, exceeding Amazon's 4% threshold, across 142 merchant-fulfilled orders for ASIN B07X8Y9Z10. We accept full responsibility for this fulfillment breakdown.

Our operational audit identified the following specific root causes:
- Fulfillment bottleneck: We relied on a single local postal drop-off location rather than an automated scheduled daily carrier pick-up, leading to severe intake delays during peak volume.
- Inaccurate handling time: Our Amazon Seller Central handling time was set to 1 day, while our warehouse assembly process required 48 hours for customized packaging.
- Staff scheduling shortage: Two fulfillment staff members were absent during the promotional week of August 5, 2026, and we lacked cross-trained backup personnel.

2. IMMEDIATE CORRECTIVE ACTIONS TAKEN
Upon account restriction on August 13, 2026, we completed the following immediate actions:
- Order backlog cleared: We dispatched all 142 delayed orders via UPS Next Day Air at our own expense (total cost $1,940.00) with tracking numbers uploaded within 6 hours.
- Customer communication: We proactively contacted all affected customers, issued a 20% courtesy credit, and responded to 100% of buyer inquiries.
- Handling time updated: We updated handling times across all 210 active merchant-fulfilled SKUs from 1 day to 3 business days to ensure accurate delivery promises.
- Courier partnership secured: We established an enterprise contract with DHL Express (Contract #DHL-8812) with guaranteed daily dock pickups at 4:00 PM.

3. LONG-TERM PREVENTIVE MEASURES
To prevent future late shipments, we implemented the following systemic procedures:
- Automated carrier dispatch SOP: Our Logistics Manager oversees automated API integration with ShipStation, generating manifest sheets and carrier scans by 3:30 PM daily.
- Redundant carrier protocol: If our primary courier experiences delays, our secondary partner (FedEx Express) is automatically scheduled for same-day sweep.
- Staff cross-training program: All 6 warehouse personnel completed certified training on packaging workflows, ensuring continuous operational coverage.
- Weekly shipping metrics review: Our Operations Director conducts a weekly audit of Order Defect Rate (ODR), Late Shipment Rate (LSR), and On-Time Delivery metrics every Monday.`
  },
  ip_complaint: {
    name: "Intellectual Property / Rights Owner",
    bad: `Dear Amazon, the rights owner who reported us is a malicious competitor trying to destroy our business. We did not violate any intellectual property. They lied and Amazon's system is wrong. Reinstate us immediately or we will take legal action.`,
    good: `1. ROOT CAUSE ANALYSIS
On August 10, 2026, our seller account received an intellectual property infringement notice regarding trademark registration #5892110 for ASIN B09K3M8P21. We take full responsibility for our failure to perform trademark clearance.

Our internal investigation revealed the following root causes:
- Trademark oversight: Our catalog listing team included protected brand terminology in our search terms and title on July 18, 2026, without verifying rights ownership against the USPTO database.
- Inadequate listing review SOP: We lacked a formal pre-listing IP validation checklist, allowing unverified branded terms to enter our product detail pages.
- Sourcing gap: While the product itself was generic hardware, our marketing staff used trademarked phrases without authorization from the rights owner (Vanguard Holdings).

2. IMMEDIATE CORRECTIVE ACTIONS TAKEN
Upon receipt of the infringement notification on August 11, 2026, we executed the following immediate actions:
- Immediate listing deletion: We permanently deleted ASIN B09K3M8P21 from our Amazon inventory and closed all active advertising campaigns.
- Inventory recall: We initiated FBA removal order #RM-6601 for all 150 units stored in fulfillment centers.
- Rights owner contact & resolution: We reached out to Vanguard Holdings on August 12, 2026, apologized for the unauthorized trademark usage, and obtained a formal retraction confirmation email (Case #IP-9902).
- Catalog audit: We audited all 380 active listings in our catalog to verify zero unauthorized brand names or copyright materials.
- Attached proof: We have attached the rights owner retraction confirmation, USPTO search report, and FBA removal documentation.

3. LONG-TERM PREVENTIVE MEASURES
To ensure strict compliance with Amazon Intellectual Property Policy, we established the following controls:
- Pre-listing IP clearance protocol: Our Brand Compliance Officer must verify every new SKU against USPTO and WIPO trademark databases prior to catalog listing.
- Automated IP monitoring tool: We integrated BrandShield software to continuously scan our titles, bullet points, and backend search terms for protected marks.
- Bi-weekly staff legal compliance training: Our legal advisor conducts bi-weekly training sessions for all marketing and listing staff regarding Amazon IP policies.
- Management sign-off: No new ASIN can be created without written sign-off from our Compliance Director verifying rights ownership or generic classification.`
  },
  review_manipulation: {
    name: "Customer Review Policy Breach",
    bad: `Dear Amazon, we did nothing wrong with customer reviews. The algorithm made a mistake or a competitor reported us unfairly. We will never do this again and will be very careful. Reinstate us now because our children depend on this.`,
    good: `1. ROOT CAUSE ANALYSIS
On August 12, 2026, our selling account was suspended for customer review policy violations concerning product insert cards for ASIN B08X1234AB. We acknowledge and take full responsibility for this policy violation.

Our internal review revealed the following root causes:
- Prohibited incentive wording: We included a package insert card offering a $10 gift card in exchange for leaving an Amazon review, which strictly violates Amazon Customer Review Creation Guidelines.
- Third-party marketing agency failure: We hired an external marketing consultancy (ScaleLaunch LLC) on June 15, 2026, and failed to audit their collateral against Amazon terms of service before manufacturing.
- Lack of compliance oversight: Our product packaging manager approved insert cards without legal or Amazon compliance verification.

2. IMMEDIATE CORRECTIVE ACTIONS TAKEN
Upon notification of suspension on August 13, 2026, we completed the following immediate actions:
- Physical inventory quarantine: We created removal order #REV-8831 for all 540 units of ASIN B08X1234AB at Amazon fulfillment centers to physically remove and destroy all non-compliant insert cards.
- Marketing contract terminated: We severed all contractual agreements with ScaleLaunch LLC on August 14, 2026.
- Buyer messaging stopped: We ceased all automated buyer-seller messaging sequences and canceled promotional review campaigns.
- Catalog audit: We inspected all 320 active SKUs in our warehouse, confirming zero other products contain incentives or review solicitation materials.
- Attached proof: Attached is removal order confirmation #REV-8831 and termination letter for ScaleLaunch LLC.

3. LONG-TERM PREVENTIVE MEASURES
To guarantee permanent adherence to Amazon Review Policies, we established the following controls:
- Zero-incentive packaging SOP: All packaging, user manuals, and inserts must be reviewed and signed off by our Compliance Director using our updated 5-point Amazon Policy Checklist.
- Amazon review policy retraining: All 12 members of our marketing and product teams completed certified Amazon Brand Academy training on August 15, 2026.
- Monthly collateral audit: Our Quality Assurance Manager conducts monthly unboxing audits of production batches before shipment to FBA warehouses.
- Executive oversight: Any customer-facing communication or insert design requires dual executive sign-off prior to print run.`
  }
};

/**
 * Intelligent Fix Helper: Applies concrete suggestions to a POA
 */
function applyFindingFix(poaText, finding) {
  if (!poaText) return poaText;

  // 1. If finding has specific offendingText present in poaText, replace it
  if (finding.offendingText) {
    const index = poaText.toLowerCase().indexOf(finding.offendingText.toLowerCase());
    if (index !== -1) {
      const actualText = poaText.substr(index, finding.offendingText.length);
      
      const specificReplacements = {
        RC_VAGUE: "On August 14, 2026, we purchased 120 units from unverified distributor Apex Goods LLC without verifying commercial invoices",
        RC_BLAME: "We take full operational responsibility for failing to verify authenticity credentials prior to listing",
        RC_DENIAL: "We acknowledge and accept full responsibility for our operational compliance failure",
        CA_FUTURE: "We have already recalled all 84 remaining units from FBA under removal order #94821 and refunded all affected customers",
        PM_VAGUE: "Our Quality Assurance Manager now executes a daily 3-stage receiving inspection SOP and weekly compliance audit",
        TONE_THREAT: "We respectfully request review of our completed corrective actions",
        TONE_EMOTIONAL: "We are committed to operating in full compliance with Amazon seller policies",
        TONE_DEMAND: "Thank you for your review of our detailed plan of action"
      };

      const replacement = specificReplacements[finding.id] ||
        (finding.suggestion ? finding.suggestion.replace(/^Try instead:\s*/i, "").replace(/^Name the specific.*?: /i, "") : "");

      if (replacement) {
        return poaText.substring(0, index) + replacement + poaText.substring(index + actualText.length);
      }
    }
  }

  // 2. Structural fix: Missing sections
  if (finding.id === "STRUCT_NO_SECTIONS" && !detectSections(poaText).hasHeadings) {
    return `1. ROOT CAUSE ANALYSIS\n${poaText}\n\n2. IMMEDIATE CORRECTIVE ACTIONS TAKEN\n- We removed all affected inventory from FBA under removal order #94821.\n- We audited all purchase orders and issued full proactive refunds to affected customers.\n- We terminated relationships with unverified suppliers.\n\n3. LONG-TERM PREVENTIVE MEASURES\n- Our Warehouse Quality Manager executes a daily 3-stage inspection SOP for all incoming shipments.\n- We integrated automated invoice compliance verification software.\n- Our Operations Director conducts weekly audits of supplier credentials and Amazon Account Health metrics.`;
  }

  // 3. Fallback: append or replace based on section
  return poaText;
}

// Support both Node.js (for testing) and Browser globals
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ENFORCEMENT_KEYWORDS,
    EXAMPLE_BAD,
    EXAMPLE_GOOD,
    SAMPLE_APPEALS,
    applyFindingFix,
    detectSections,
    evaluatePOA
  };
}

