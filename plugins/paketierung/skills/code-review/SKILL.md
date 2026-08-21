---
description: Review code changes in the Paketierung project for correctness, security, performance, and maintainability. Use when reviewing a PR, diff, or file, or when asked "is this safe to merge?".
---

# Code Review – Paketierung

Review the provided code changes (PR URL, diff, or file path). If none was given, ask what to review before proceeding.

Check for:

1. **Correctness** – edge cases, error handling, off-by-one errors
2. **Security** – injection risks, unsafe deserialization, secrets in code
3. **Performance** – unnecessary loops/allocations, N+1 patterns, unbounded queries
4. **Maintainability** – naming, duplication, missing tests, unclear logic

Structure the output as:

```markdown
## Code Review: [title]

### Summary
[1-2 sentences]

### Critical Issues
| # | File | Line | Issue |
|---|------|------|-------|

### Suggestions
| # | File | Line | Suggestion |
|---|------|------|------------|

### What Looks Good
- ...

### Verdict
[Approve / Request Changes / Needs Discussion]
```

Keep findings concrete and cite file/line. Skip generic praise.
