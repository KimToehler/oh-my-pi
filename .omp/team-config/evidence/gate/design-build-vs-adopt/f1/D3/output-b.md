Sentence found:

1. "A search that failed counts as `none`."

This is the only sentence that permits the forbidden behaviour. The Negative control forbids recording a failed or unreadable search as `none` and then deciding build. This sentence says outright that a failed search is recorded as `none`. A design could then write `none and the searches run` for a stage whose only search failed, and go on to `Decision: build, gap: …`. That is exactly the case the Negative control says review must fail.

The sentence also contradicts the Decision option "open, search failed: <which>". It leaves that option no role as the required outcome of a failed search.

Supporting context, not a permitting sentence by itself:

- The instruction never says to retry a failed search.
- It never says to ask the user before designing the mechanism when the retry fails.
- Because of these gaps, nothing else in the text blocks the route that the quoted sentence opens.

The other sentences do not permit the behaviour. These include "A build or reject verdict names its gap", the `Candidates: … | none and the searches run` form, and the "Decision: … | open, search failed: <which>" option. They only describe the options. They do not say a failed search may be recorded as `none`.
