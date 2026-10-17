# Design direction research

Date:2026-10-17. Scope: public documentation/product pages, read during this
session. These are our design interpretations, not measured product usability,
authenticated UI audits or redistribution permission. No assets/code copied,
no reference screenshots committed, no service added to Sanctum. A public page
cannot prove a product's offline behavior, accessibility or long-session comfort.

| Reference / public source | Principle to explore | What not to copy |
|---|---|---|
| [ChatGPT overview](https://chatgpt.com/overview/) | Keep the conversational task and composer visually primary; reveal secondary tasks progressively | Brand, icons, account/cloud flows or capability claims |
| [Claude overview](https://claude.com/product/overview) | Test warm surfaces and a reading-oriented assistant column; separate prose from chrome | Brand typography/assets or inferred proprietary tokens |
| [Linear](https://linear.app/features) | Stable hierarchy, concise labels, predictable list rhythm | Work-management features or proprietary visual assets |
| [Raycast](https://www.raycast.com/) | Make existing actions discoverable through a keyboard palette | Extension ecosystem, auto-install or decorative effects |
| [Superhuman](https://superhuman.com/) | Design fast repeated actions and visible shortcut learning | Its mail workflow, external AI/service connections |
| [Notion](https://www.notion.com/product) | Distinguish document reading from navigation and editing chrome | Blocks/features without Sanctum backing or illustrations |
| [Bear](https://bear.app/) | Test generous prose leading and restrained formatting hierarchy | Bear marks, bundled font files or editor-specific controls |
| [Obsidian](https://obsidian.md/) | Keep navigation calm while letting experts expose panels | Plugins, arbitrary CSS/code loading or a graph with no backend |
| [Apple Messages guide](https://support.apple.com/guide/messages/welcome/mac) | Distinguish participants and group related messages with quiet metadata | Apple assets, emoji art or platform messaging claims |
| [Telegram](https://telegram.org/) | Explore clear conversation selection and composer affordances | Stickers, proprietary iconography or network messaging |
| [VS Code interface](https://code.visualstudio.com/docs/editing/getting-started/userinterface) | Stable panel regions, predictable focus and hideable secondary tools | Terminal, extension loading or IDE-specific commands |
| [Cursor](https://cursor.com/) | Keep ongoing work adjacent to context instead of burying it | Coding-agent capabilities or features Sanctum cannot execute |
| [Arc](https://arc.net/) | Use a restrained sidebar and clear active-context hierarchy | Browser chrome, names, assets or unsupported spaces features |
| [Perplexity sources](https://www.perplexity.ai/help-center/en/articles/10352155-what-is-perplexity) | Make evidence links easy to inspect next to the answer | Automatic web search, trust claims or its identity |
| [Open WebUI features](https://docs.openwebui.com/features/) | Separate model/conversation/Knowledge context in a broad chat surface | Feature inventory, license assumptions, connectors or assets |
| [LibreChat](https://www.librechat.ai/) | Keep settings and conversation navigation understandable across engines | Provider defaults, account/team features or brand |
| [LobeHub documentation](https://lobehub.com/llms.txt) | Explore task/context organization with consistent settings patterns | Marketplace, cloud integrations or unsupported agent screens |
| [chatbot-ui](https://github.com/mckaywrigley/chatbot-ui) | Treat model selection and saved chat as first-class state | Source snippets/dependencies without separate license/audit review |
| [assistant-ui architecture](https://www.assistant-ui.com/docs/architecture) | Separate rendering, conversation state and execution; compose small chat primitives | Cloud runtime and unnecessary component dependencies |
| [Vercel AI Elements](https://elements.ai-sdk.dev/) | Give code, sources and tool progress clear reusable presentation | Its runtime, snippets or packages without admission |
| [prompt-kit](https://github.com/ibelick/prompt-kit) | Use a coherent composer and small accessible component vocabulary | Automatic registry installation, snippets or its assets |
| [shadcn blocks](https://ui.shadcn.com/blocks) | Reuse semantic patterns for navigation/forms with consistent state coverage | Wholesale dependency trees or unreviewed blocks |

The prompt-kit website fetch failed in this session; the linked public upstream
repository was readable instead. Perplexity's homepage yielded no substantive
text; its help-center source supports the citation principle. These limitations
are not evidence of product failure. No signed-in product sessions were tested.

## Concrete shared rules

Use8px layout rhythm, with4px fine alignment only where necessary. Group related
controls before adding containers. Keep answer measure distinct from panel
width; avoid spanning long prose across the entire workspace. Use size/weight
and position for hierarchy; muted text still needs AA. One accent communicates
action/focus, not decoration. Sources must retain filename/page/passage context;
never make citations look like verification of an unsupported answer.

The composer remains visible, has an explicit send/stop state, and does not jump
as text streams. Keep layout stable after fonts load. Busy/error copy says what
happened and the next real action; display Retry-After only if the API supplies
it. Empty copy invites a local question, without claiming a model is loaded.
Spacing density changes chrome, not reading accessibility or mobile hit targets.
Motion120-200ms is feedback, never a wait condition. Paper's serif is optional
assistant prose only; input, controls and code stay purpose-appropriate.

## Three hypotheses, not three measured winners

| Pack | Light / dark intent | Typography/layout intent | Risk to check |
|---|---|---|---|
| Paper | Warm ivory and ink / warm charcoal and parchment | Existing Spectral option for answers,Archivo controls;70ch,1.65 leading | Washed-out metadata, serif code fallback, overly spacious mobile |
| Night Study | Soft warm neutral day variant / low-glare brown-charcoal with restrained amber | Archivo by default,optional existing reading font;same content hierarchy | Dim labels, overly bright focus/primary controls, dark-only polish |
| Studio | Neutral pale surfaces / neutral graphite with restrained blue | Archivo,tighter chrome,strong heading rhythm;density controls retained | Small targets, excessive rules, dense unreadable prose |

Paper is a candidate for reading-focused use, not yet the recommended default.
The final recommendation needs the CRITERIA matrix, two real critique passes,
and owner-facing before/after screenshots. All three ship as choices only after
their tests pass. Hermes-fidelity remains the default until owner approval.
