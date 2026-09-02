# Partner logos: provenance, permissions and placement

Logos are trademarks, and putting one on this site says the organisation stands
with the programme. This file records where each file came from, what its owner
still has to confirm, and the rules the site follows when showing them.

## The permission switch

A partner **without** a logo renders as a typographic lockup — its name over a
short second line — carrying the same link and sitting in the same row as the
logos. Nothing about the layout breaks when artwork is missing, so an
organisation can be credited accurately long before its artwork arrives, and
adding one later is an upload in `/admin → Partners`, no code change.

Every partner has artwork today. The switch still matters: it is what lets a
logo be swapped, withdrawn at an owner's request, or held back pending a
confirmation without touching the site.

## Artwork in the repo

Each file is the organisation's own current brand asset, taken from the source
that organisation uses to present itself. That is a sound basis for showing a
partner, and it is **not** the same as written permission: confirming these is a
launch-checklist item, one email per organisation. Until then the `usageNote` on
each partner record says exactly what is outstanding. That field is
authenticated-read only — the notes are internal and must not ship in the public
API.

| Organisation             | File                         | Source                                                                                                                                                        | Still to confirm                                                                                                                                                                                                                                      |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Office for Life Sciences | office-for-life-sciences.png | The OLS lockup (Royal Arms crest over the wordmark) from OLS's own GOV.UK publication, _Life science competitiveness indicators 2016_                         | The crest is Crown copyright and outside the Open Government Licence. Acknowledging our own funder is the use it exists for, but OLS comms should confirm — and can supply better artwork than this, which is 117×156 and the best public copy found. |
| Medical Research Council | medical-research-council.png | Official UKRI Medical Research Council logo from ukri.org                                                                                                     | Acknowledging a funder or delivery body is what this mark is for. Follow UKRI brand rules: no recolouring, keep clear space. Ask brand@ukri.org for vector artwork if a larger rendering is ever needed.                                              |
| King's College London    | kings-college-london.svg     | Official current logo, vector, from the kcl.ac.uk site header                                                                                                 | Delivery lead, and the programme's own brochure already carries it. Follow KCL brand rules.                                                                                                                                                           |
| DIGIT                    | digit.svg                    | Redrawn as a vector from the team's own `digit logo.png`; geometry and colour (#0090FF) measured from that file and checked against it to within antialiasing | The programme's own team mark, hosted at King's. Mark only — no wordmark artwork exists, so the site sets the name beside it.                                                                                                                         |
| GLAD Study               | glad-study.png               | The study's own header logo from gladstudy.org.uk (raster; no vector published)                                                                               | Confirm with the GLAD team; ask for vector artwork.                                                                                                                                                                                                   |
| DATAMIND                 | datamind.svg                 | Official vector `DATAMIND_black_cmyk.svg` from datamind.org.uk                                                                                                | Confirm with DATAMIND comms. A white variant exists on their site if a dark ground is ever needed.                                                                                                                                                    |
| MHDI                     | mhdi.png                     | The site lockup from mhdi.uk (raster; Wix, no vector published), white ground removed to transparency                                                         | Confirm with MHDI; ask for vector artwork.                                                                                                                                                                                                            |

**A note on finding the two government marks.** Neither is on a logo-download
page. The OLS organisation page on GOV.UK renders its name as _text_ — it is a
joint unit of DHSC and DSIT and carries no crest there, unlike DHSC's own page —
and current OLS documents use the unified "UK Government" crest rather than an
OLS lockup. The OLS lockup does exist and OLS uses it on its own publications,
which is where this copy comes from. The MRC mark is published by UKRI as a
stacked logo; both it and the OLS lockup therefore need extra height before
their wordmarks are readable, which is what their `logoScale` of 1.5 is for.

**What these organisations are.** GLAD, DATAMIND and MHDI are independent
organisations and studies the programme builds on and delivers with — not
workstreams of the programme. Each is led or co-directed by someone on the
programme team, which is why they appear as programme partners: GLAD is the
cohort the Multi-omics workstream builds on, DATAMIND is the hub the Data
Observatory is delivered with, and MHDI is the partner behind Digital
Innovation. The site says so in those words; the logo rows should not imply
anything more.

## Where logos appear, and where they deliberately do not

- **The accountability band**, above the footer on every page: who funds and who
  delivers. This is the one site-wide claim, so it stays short.
- **Curated rows** on the home, About, Industry and Patients & public pages, and
  in the body of a workstream or an article — placed by an editor, and only
  where the set shown is complete.
- **Not** in a workstream's "Delivered by" sidebar. That list is co-equal
  institutions, and we hold cleared artwork for one of them; a single logo above
  four plain university names would invent a hierarchy the programme does not
  claim. Those stay as text.
- **Not** the NHS, whose identity is legally protected, and **not** anything from
  the industry-partner workbook, which is a confidential contacts list rather
  than a roster of endorsements.

Logo surfaces pin themselves to the light palette (`.partner-plate`). Partner
artwork is drawn for light grounds — DATAMIND's mark is black ink — so on the
dark theme it would otherwise vanish while its link stayed focusable.

## Not seeded as partners

Universities beyond King's (Manchester, Oxford, Cardiff, Swansea, Liverpool,
Belfast, Edinburgh, Cambridge) and Health Innovation Oxford & Thames Valley are
named in prose and in workstream delivery lists. Each identity needs its own
comms team's consent, and a row of eight text lockups would add nothing over the
sentence that already names them. Add them in `/admin` if consent and artwork
arrive together.

NIHR, MRC/UKRI and HDR UK fund workstream organisations rather than the
programme, so a "Funded by" claim for them would be wrong — the MRC appears
under "Delivered by" because that is what the site's own copy says.
