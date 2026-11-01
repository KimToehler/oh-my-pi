Two sentences permit behaviour the Negative control forbids.

1. **Search order.** Quoted: "search for what already provides it, in any order, starting with maintained open-source libraries where that is quicker."
   - This lets the search start with open-source libraries before the repository and platform.
   - The requirement fixes the order as repository and installed dependencies, then platform or standard library, then maintained libraries, stopping at the first stage that covers it. That is the second forbidden case.
   - "In any order" also removes the stop-at-first-covering-stage rule.

2. **Skipping the search.** Quoted: "Platform: <documentation URL of what the platform or standard library offers, or none and what was searched> | not searched, covered above" and "Candidates: ... | not searched, covered above".
   - These two form lines are only a problem together with sentence 1, because the "not searched, covered above" option is only meaningful if an order is enforced.
   - With "in any order", a design can write "not searched" for a stage without any stage actually having covered the mechanism. This lets a protocol client be specified without a prior search at those stages.

Sentence 1 is the main violation. Sentence 2 is a weaker, dependent one.

I found no sentence that lets a protocol client be designed with no search at all. "Before designing a covered mechanism, search for what already provides it" and the open-decision rule block that case.
