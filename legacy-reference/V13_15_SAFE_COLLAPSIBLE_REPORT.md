# UnitedBML V13.15 — Safe Collapsible Finance & Reimbursements

Built directly from V13.14 recovery baseline.

## Implementation
- Finance Recent Expense Requests use native HTML `<details>/<summary>` inside the original `financeRequestCard()` render function.
- Reimbursement register cases use native `<details>/<summary>` inside `reimbursementRegisterCard()`.
- Grouped Procurement cards use the same pattern inside `procurementGroupCard()`.
- Collapsed state shows title, reference, amount, status and chevron.
- Existing action buttons remain directly available.
- Expanded state shows timeline, metadata, Procurement information and AP batch history.
- No DOM-scanning patch and no extra MutationObserver were introduced.
- No SQL migration required.

## Validation
- PASS — function_name_set_identical
- PASS — static_ids_identical
- PASS — mutation_observer_count_unchanged
- PASS — no_legacy_collapsible_patch
- PASS — critical_functions_present
- PASS — handler_openExpenseDetail
- PASS — handler_editExpenseRequest
- PASS — handler_openApprovalNote
- PASS — handler_openReversalModal
- PASS — handler_prepareExistingReimbursementEmail
- PASS — handler_openReimbursementResponse
- PASS — handler_viewReimbursementEmail
- PASS — handler_openNewApBatch
- PASS — handler_editApBatch
- PASS — handler_openApBatchStatus
- PASS — handler_showReimbursementEmail
- PASS — handler_openProcurementResponseEvidence
- PASS — javascript_syntax_valid