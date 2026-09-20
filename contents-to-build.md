# Contents To Build — Round 5: STOP BUILDING, SHIP

**Round 4 is verified complete and the build quality is good.** Independently checked:

| Item | Result |
|---|---|
| Citation URLs | All three now resolve to the real UUID threads. Fabricated slugs gone. |
| Light theme | Swapped. Only one dark-theme value survives anywhere in `styles.css`. |
| Contrast audit | Every text token passes 4.5:1 on white. `text-main` 18.9:1, `text-muted` 7.1:1, red 6.6:1, ochre 5.5:1, green 5.1:1. |
| Orange discipline | Used as text in 5 places — all on navy, 6.3–8.2:1. Correct, not a violation. |
| Verdict/CTA collision | Avoided. AT RISK is ochre, orange is CTA-only. |
| Tests | `test_rubric.js` 4/4, `test_edge.js` 6/6 |
| Deployment zip | Regenerated, contains the light theme, 4 files at root |
| Empty state | Present |

**The application is finished.** Read the next section before writing any more code.

---

## The actual situation

It is the final evening. The app works, is tested, is accessible, looks good, and has a deployable artifact. What does not exist is **the three-minute video** — which has been the top item for three consecutive rounds and is the only thing the judges will ever see.

There is no live demo at this event. A polished app with no video scores nothing. A rough video of a decent app scores.

**Every hour spent on new features from here is an hour taken from the only deliverable that cannot be substituted.** This round is therefore a shipping checklist, not a feature list.

---

## P0 — DO THESE, IN THIS ORDER, AND NOTHING ELSE UNTIL THEY ARE DONE

### 1. Record the video · ~40 min

Shot list unchanged from round 3. Open the app, hit record, do it in one take, accept the imperfections.

| Time | Shot |
|---|---|
| 0:00–0:20 | The *"Appeal rejected in 4 minutes?!"* thread on screen. What a suspension costs a seller. |
| 0:20–0:50 | Load the failing example. Red, 13/100, criticals. Read **one** finding aloud — problem *and* fix. |
| 0:50–1:40 | **Auto-Fix POA.** Let the score climb. Stop talking for a few seconds and let it run. |
| 1:40–2:10 | Architecture diagram. Deterministic engine is local: privacy, and it cannot fail mid-demo. Name the AWS services. |
| 2:10–2:35 | Honest scope: does not guarantee reinstatement, not legal advice, removes the guessing. |
| 2:35–3:00 | What you learned. Tell the `STRUCT_NO_SECTIONS` story — a spec that was wrong, caught by testing against realistic input. That is a real engineering story and it is a scored criterion. |

### 2. Get the deployment done · ~15 min, mostly waiting

Send `preflight-amplify.zip` and `DEPLOY.md` to the account holder **now** if not already sent. Chase the URL. **No URL means no Ship It entry**, which is the ₹2,00,000 track.

The moment it arrives: paste it at the top of `README.md` and into the submission form.

### 3. Submit · ~15 min

Do not leave this to the last ten minutes. Confirm before you start: the submission deadline, and that your teammate's Builder Center profile is linked to the team. **Entries are checked per person against Builder Center, and the team cannot be changed after submission.**

Checklist:
- [ ] Live Amplify URL in the form
- [ ] Video uploaded and the link works in a logged-out browser
- [ ] Repo link
- [ ] `BLOG_POST.md` published to AWS Builder Center and linked (separate prize, low competition)
- [ ] "What I learned" filled in — it is a scored criterion, not a formality

---

## P1 — THREE SMALL FIXES · ~10 min total, only between takes

### 4. One failing border colour
`styles.css` line 1337: `.finding-card.sev-medium` uses `border-left: 4px solid #94a3b8` — 2.56:1 on white, below the 3:1 that non-text UI needs. It is the only dark-theme value left in the file. Change to `#6F7373` (4.8:1).

### 5. Audit `--text-dim` on the page ground
`--text-dim` (#6F7373) is 4.8:1 on white but only **4.08:1** on the `#EAEDED` page background — a fail for small text. It is used in 20 places. Check which of those sit directly on the page ground rather than on a white card, and switch those to `--text-muted` (6.0:1 on that ground).

### 6. Exclude `scratch/` from the submission
It contains the Python build scripts used to generate the theme and docs. Harmless, but it is build detritus in a repo a judge may open. Add it to `.gitignore` or delete it. Confirm it is not in the zip — it currently is not.

---

## P2 — ONLY IF THE VIDEO IS RECORDED, DEPLOYED AND SUBMITTED

Two genuine gaps. Both are real improvements. **Neither is worth one minute before P0 is complete.**

### 7. Autosave the draft to localStorage · ~15 min
There is no persistence. If the browser closes, crashes, or the tab is lost, the seller loses the most important document of their year. Autosave `poaText` and the enforcement type on the existing debounce, restore on load, add a "Draft restored — clear" affordance. Stays entirely on-device, so it is consistent with the privacy claim rather than in tension with it.

### 8. Print stylesheet · ~15 min
`@media print` does not exist. The user's actual next step after using this tool is submitting the text to Amazon. A print view that outputs the three sections cleanly — no UI chrome, no findings panel, black on white — closes the loop. Cheap on a light theme.

---

## Do not build anything else

No new rubric checks. No new categories. No diff view. No dark-mode toggle. No extra AWS services.

The project is feature-complete and the marginal value of another feature is now lower than the marginal value of a better video, an earlier submission, and a night where nothing breaks at 23:50.

If you find yourself with spare time after P0 and P1, the highest-value use of it is **rehearsing the demo once more** so the video is confident rather than hesitant.

---

## Do not change

- The rubric: structure, weights, finding IDs, critical set, caps at 49 and 74
- Section detection, both line-based and inline
- Auto-Fix and its undo stack
- HTML escaping in the highlight backdrop and finding cards — verified XSS defence
- The palette tokens and the reservation of red/ochre/green for verdicts
- Header disclaimers and the privacy notice
- `preflight-amplify.zip` structure — 4 files at archive root
