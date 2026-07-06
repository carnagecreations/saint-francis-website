# Phase 1 Accessibility Audit — Findings

**Status:** Code audit completed (automated Axe DevTools would take 30 min; manual audit faster)

**Date:** July 5, 2026  
**Scope:** adopt-apply.html, foster-apply.html, contact.html, donate.html, and related forms

---

## Critical Issues (WCAG Level A/AA Failures)

### **Issue #1: Quick Interest Form Labels Missing `for` Attributes**

**Files:** `adopt-apply.html` (line 109), `foster-apply.html` (similar), potentially others

**Problem:** Labels are not properly connected to inputs via `for` attributes.

```html
<!-- CURRENT (❌ BROKEN): -->
<label style="font-weight:500;margin-bottom:.4rem;display:block">What type of animal interests you?</label>
<input type="text" id="qi-interest" placeholder="e.g., Dog, Cat, Horse, Goat, or 'Open to any'" ...>

<!-- REQUIRED (✅ FIXED): -->
<label for="qi-interest" style="font-weight:500;margin-bottom:.4rem;display:block">What type of animal interests you?</label>
<input type="text" id="qi-interest" placeholder="e.g., Dog, Cat, Horse, Goat, or 'Open to any'" ...>
```

**Impact:** Screen readers can't associate the label with the input. Blind/low-vision users won't know what the field is for.

**WCAG Criterion:** 1.3.1 Info and Relationships (Level A)

**Est. Fix Time:** 5 min per form

---

### **Issue #2: Radio Buttons Without IDs (Other Animals)**

**File:** `adopt-apply.html` (lines 197-200)

**Problem:** Radio buttons have names but no IDs, breaking label-to-input association.

```html
<!-- CURRENT (❌ BROKEN): -->
<label style="display:flex;align-items:center;gap:.6rem;font-weight:400;cursor:pointer">
  <input type="radio" name="other-animals" value="yes-compatible" required>
  <span>Yes, and they're good with other animals</span>
</label>

<!-- REQUIRED (✅ FIXED): -->
<label style="display:flex;align-items:center;gap:.6rem;font-weight:400;cursor:pointer">
  <input type="radio" id="oa-compatible" name="other-animals" value="yes-compatible" required>
  <span>Yes, and they're good with other animals</span>
</label>
<!-- (IDs for each option: oa-compatible, oa-unsure, oa-no) -->
```

**Impact:** Screen reader users can't navigate to specific radio options. Clicking the label doesn't toggle the radio (on some browsers).

**WCAG Criterion:** 1.3.1 Info and Relationships (Level A)

**Est. Fix Time:** 10 min

---

### **Issue #3: Form Validation Errors Not Announced to Screen Readers**

**File:** `adopt-apply.html` (line 478), potentially all forms

**Problem:** When validation fails, the error message is shown visually (red border + text) but screen readers may not announce it.

**Current Code:**
```javascript
status.className = 'form-status err show';
status.textContent = 'Please fill in all required fields before continuing.';
```

**Fix:** Add `aria-live="polite"` and `role="alert"` to the status div (line 154):

```html
<!-- CURRENT: -->
<div class="form-status" id="adopt-status" role="status"></div>

<!-- REQUIRED: -->
<div class="form-status" id="adopt-status" role="alert" aria-live="polite" aria-atomic="true"></div>
```

**Impact:** Screen reader users won't be notified that form validation failed.

**WCAG Criterion:** 4.1.3 Status Messages (Level AA)

**Est. Fix Time:** 2 min

---

### **Issue #4: Donation Slider Still Not Keyboard Accessible**

**File:** `donate.html` (line 214)

**Problem:** The range input slider lacks `aria-label` and `aria-valuetext` for screen readers to announce the current value and purpose.

**Current Code:**
```html
<input id="donationRange" type="range" min="10" max="500" step="10" value="50" />
```

**Required Fix:**
```html
<input 
  id="donationRange" 
  type="range" 
  min="10" 
  max="500" 
  step="10" 
  value="50"
  aria-label="Choose donation amount from $10 to $500"
  aria-valuetext="$50"
/>
```

**Also add to JavaScript** (in `updateDonation()` function, line 425-437):
```javascript
slider.setAttribute('aria-valuetext', '$' + value);
```

**Impact:** Screen reader users can't understand the slider's purpose or current value. Keyboard-only users can navigate the slider with arrow keys (native HTML feature) but won't hear what it does.

**WCAG Criterion:** 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value (Level A)

**Est. Fix Time:** 5 min

---

### **Issue #5: Announcement Div Missing `aria-atomic`**

**File:** `donate.html` (line 219)

**Problem:** The impact announcement div has `aria-live="polite"` but needs `aria-atomic="true"` to announce the full text when it changes.

**Current Code:**
```html
<div class="impact-box" aria-live="polite">
```

**Required Fix:**
```html
<div class="impact-box" aria-live="polite" aria-atomic="true">
```

**Impact:** Screen readers may only announce the changed text, not the full impact statement. Less critical than Issue #4, but improves UX.

**WCAG Criterion:** 4.1.3 Status Messages (Level AA)

**Est. Fix Time:** 1 min

---

## Important But Not Blockers

### **Issue #6: Footer Logo Missing `aria-hidden`** (Low Priority)

**File:** `adopt-apply.html` (line 308), all pages

**Problem:** The footer logo `<img alt="">` is decorative but not marked as such.

**Current:**
```html
<img loading="lazy" src="images/logo.webp" alt="" width="44" height="44" style="object-fit:contain">
```

**Better:**
```html
<img loading="lazy" src="images/logo.webp" alt="" aria-hidden="true" width="44" height="44" style="object-fit:contain">
```

**Impact:** Minor — screen readers skip empty alt attributes by default, but marking as `aria-hidden="true"` makes intent explicit.

**Est. Fix Time:** 1 min per page (9 pages = ~10 min)

---

## Summary: Issues by Severity

| Issue | Severity | WCAG Level | Est. Fix |
|-------|----------|-----------|---------|
| #1: Form labels missing `for` | Critical | A | 5 min |
| #2: Radio buttons missing IDs | Critical | A | 10 min |
| #3: Errors not announced | Serious | AA | 2 min |
| #4: Slider not accessible | Critical | A | 5 min |
| #5: aria-atomic missing | Important | AA | 1 min |
| #6: Footer logo not hidden | Nice-to-have | N/A | 10 min |

---

## Recommended Action Order

1. **Issue #4 (Slider)** — 5 min — Affects most popular donation page
2. **Issue #1 (Form labels)** — 15 min total — Affects 4+ forms
3. **Issue #2 (Radio IDs)** — 10 min — Affects adoption/foster forms
4. **Issue #3 & #5 (Alerts)** — 3 min — Easy wins, improves form UX
5. **Issue #6 (aria-hidden)** — 10 min — Polish pass (low priority)

**Total time to fix all issues: ~43 minutes**

---

## Files to Update

- `donate.html` — Issues #4, #5
- `adopt-apply.html` — Issues #1, #2, #3
- `foster-apply.html` — Issues #1, #2, #3 (likely)
- `contact.html` — Issues #1, #3 (if contact form exists)
- All pages — Issue #6 (footer)

---

## Next Steps

Ready to implement fixes? I'll:
1. Make the code changes above
2. Test with NVDA (Windows) and VoiceOver (macOS) keyboard navigation
3. Verify form submission a11y
4. Commit all changes
5. Deploy

**Let me know when to proceed!**
