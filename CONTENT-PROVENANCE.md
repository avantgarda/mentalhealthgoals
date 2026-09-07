# Content provenance

Where the programme's images and partner logos came from, and what may be done with
them. Kept because permission and licence questions outlive the files themselves.

The files these notes describe are no longer in this repository — media lives in the
production CMS and its blob store. These are the notes that travelled with them.

**Confirming each logo owner's permission is a launch item.**

---

## Photography and imagery

**Supplied internally by the programme team (via Eoin Gogarty, 2026-09-01)** —
preferred, current photos for eleven people, pre-cropped to the card's 4:5
frame in this repo (Downloads originals listed). Matthias Pierce's portrait is
cropped from a supplied group photo. The remainder were collected 2026-09-01
from each person's own institutional or programme profile.

**Licence status: pending team confirmation** (launch checklist, gate 2). Any
photo can be swapped in `/admin` with no code change.

| Person                 | File                 | Source                                                                   |
| ---------------------- | -------------------- | ------------------------------------------------------------------------ |
| Prof. Kathryn Abel     | kathryn-abel.jpg     | supplied internally (`kathryn.png`)                                      |
| Prof. Husseini Manji   | husseini-manji.jpg   | supplied internally (`husseini.jpg`)                                     |
| Dr Vaibhav Narayan     | vaibhav-narayan.jpg  | supplied internally (`vaibhav.jpg`)                                      |
| Prof. Mitul Mehta      | mitul-mehta.jpg      | MHG IEF brochure (programme-owned)                                       |
| Prof. Richard Emsley   | richard-emsley.jpg   | supplied internally (`richard.jpg`)                                      |
| Dr Siân Rees           | sian-rees.jpg        | https://www.healthinnovationoxford.org/about-us/our-people/dr-sian-rees/ |
| Prof. Edward Harcourt  | edward-harcourt.jpg  | supplied internally (`edward.png`)                                       |
| Prof. Paula Williamson | paula-williamson.jpg | supplied internally (`paula.jpg`)                                        |
| Dr Matthias Pierce     | matthias-pierce.jpg  | supplied internally (`matthias.jpg`, cropped from group)                 |
| Eric Lynch             | eric-lynch.jpg       | MHG brochure pptx (programme-owned)                                      |
| Non Hill               | non-hill.jpg         | supplied internally (`non.jpeg`)                                         |
| Eoin Gogarty           | eoin-gogarty.jpg     | supplied internally (`eoin.png`)                                         |
| Prof. Gerome Breen     | gerome-breen.jpg     | https://kclpure.kcl.ac.uk/portal/en/persons/gerome-breen                 |
| Prof. James Walters    | james-walters.jpg    | supplied internally (`james.jpeg`)                                       |
| Prof. Ann John         | ann-john.jpg         | https://datamind.org.uk/portfolio/professor-ann-john/                    |
| Prof. Rob Stewart      | rob-stewart.jpg      | https://www.kcl.ac.uk/people/professor-robert-stewart                    |
| Dr Pauline Whelan      | pauline-whelan.jpg   | supplied internally (`pauline.jpg`)                                      |
| Dr Trina Histon        | trina-histon.jpg     | supplied internally (`trina.jpeg`)                                       |

## Still without a photo — request internally

- **Dr Kerrie McGiveron**
- **Sidharth Sanjeev**

They render as initials until supplied; drop a photo into this folder (4:5
crop, ≤1000px tall) and upload it to the person's record in the CMS.

---

## Partner logos

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
| King's College London    | kings-college-london.svg     | Official current logo, vector, from the kcl.ac.uk site header                                                                                                 | Host institution of the DIGIT award and operator of this website; the programme's own brochure already carries it. Not in the footer band — see below. Follow KCL brand rules.                                                                        |
| DIGIT                    | digit.svg                    | Redrawn as a vector from the team's own `digit logo.png`; geometry and colour (#0090FF) measured from that file and checked against it to within antialiasing | The programme's own team mark. Mark only — no wordmark artwork exists, so the site sets the name beside it. Not in the footer band — see below.                                                                                                       |
| GLAD Study               | glad-study.png               | The study's own header logo from gladstudy.org.uk (raster; no vector published)                                                                               | Confirm with the GLAD team; ask for vector artwork.                                                                                                                                                                                                   |
| DATAMIND                 | datamind.svg                 | Official vector `DATAMIND_black_cmyk.svg` from datamind.org.uk                                                                                                | Confirm with DATAMIND comms. A white variant exists on their site if a dark ground is ever needed.                                                                                                                                                    |
| MHDI                     | mhdi.png                     | The site lockup from mhdi.uk (raster; Wix, no vector published), white ground removed to transparency                                                         | Confirm with MHDI; ask for vector artwork.                                                                                                                                                                                                            |

**A note on the two government marks.** Neither is on a logo-download page.
The OLS organisation page on GOV.UK renders its name as _text_ — it is a joint
unit of DHSC and DSIT and carries no crest there, unlike DHSC's own page — and
current OLS documents use the unified "UK Government" crest. UKRI's logo library
is a Frontify app that serves nothing to a fetch. Both marks are published by
partner organisations that carry them properly, which is where these copies come
from, and both are the horizontal lockups rather than the stacked variants, so
they sit in a row without needing extra height.

**Sizing.** Logos of different shapes do not look the same size at the same
height: a wide wordmark set to a square mark's height dwarfs it. Each partner's
`logoScale` is therefore derived from its aspect ratio, part-way between
matching heights and matching areas, so the row balances by visual mass. DIGIT
is set below what its square mark alone suggests, because what a reader sees is
the mark plus the name beside it — a much wider lockup.

**What these organisations are.** GLAD, DATAMIND and MHDI are independent
organisations and studies the programme builds on and delivers with — not
workstreams of the programme. Each is led or co-directed by someone on the
programme team, which is why they appear as programme partners: GLAD is the
cohort the Multi-omics workstream builds on, DATAMIND is the hub the Data
Observatory is delivered with, and MHDI is the partner behind Digital
Innovation. The site says so in those words; the logo rows should not imply
anything more.

## Where logos appear, and where they deliberately do not

- **The accountability band**, above the footer on every page: the funder and
  the delivery body the site's own copy names — the Office for Life Sciences
  and the MRC, and nothing else. This is the one claim the site makes on every
  page, and it is about the programme, not about who is doing the work.
  Neither King's nor DIGIT belongs in it: nine institutions deliver the
  programme, and naming one of them site-wide reads as precedence over the
  other eight. King's is credited where it is the accurate credit — the
  privacy notice's operator and controller statements, and the DIGIT page.
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

## Deliberately not shown as partners

The nine delivery institutions (Cardiff, Health Innovation Oxford & Thames
Valley, King's, Queen's Belfast, Swansea, Cambridge, Edinburgh, Manchester and
Oxford) are named in prose and in workstream delivery lists. Each identity needs
its own comms team's consent, and a row of nine text lockups would add nothing
over the sentence that already names them — while showing any subset would
invent the hierarchy the flat list avoids. Add them in `/admin` if consent and
artwork arrive together, and only as a complete set.

NIHR, MRC/UKRI and HDR UK fund workstream organisations rather than the
programme, so a "Funded by" claim for them would be wrong — the MRC appears
under "Delivered by" because that is what the site's own copy says.
