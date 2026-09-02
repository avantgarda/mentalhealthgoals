# Partner logos: provenance, permissions and placement

Logos are trademarks, and putting one on this site says the organisation stands
with the programme. This file records where each file came from, what its owner
still has to confirm, and the rules the site follows when showing them.

## The permission switch

A partner **without** a logo renders as a typographic lockup — its name over a
short second line — carrying the same link and sitting in the same row as the
logos. Nothing about the layout breaks when artwork is missing, so an
organisation can be credited accurately long before its artwork is cleared.
Clearing one is an upload in `/admin → Partners`, no code change.

Two partners are text lockups today for specific reasons, not by oversight:

- **Office for Life Sciences** — the GOV.UK identity is the Royal Arms crest:
  Crown copyright, and explicitly _excluded_ from the Open Government Licence.
  Third-party use needs OLS's permission and their supplied lockup.
- **Medical Research Council** — UKRI brand rules require their own supplied
  files. The About page states the programme is funded by OLS and delivered by
  the MRC, so the band names the MRC whether or not artwork exists.

## Artwork in the repo

Each file is the organisation's own current public brand asset, taken from the
site they use to present themselves. That is a reasonable basis for showing a
partner, and it is **not** the same as written permission: confirming these is a
launch-checklist item, one email per organisation. Until then the `usageNote`
on each partner record says exactly what is outstanding. That field is
authenticated-read only — the notes are internal and must not ship in the
public API.

| Organisation          | File                     | Source                                                                                                                                                        | Still to confirm                                                                                                              |
| --------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| King's College London | kings-college-london.svg | Official current logo, vector, from the kcl.ac.uk site header                                                                                                 | Delivery lead, and the programme's own brochure already carries it. Follow KCL brand rules: no recolouring, keep clear space. |
| DIGIT                 | digit.svg                | Redrawn as a vector from the team's own `digit logo.png`; geometry and colour (#0090FF) measured from that file and checked against it to within antialiasing | The programme's own team mark, hosted at King's. Mark only — no wordmark artwork exists, so the site sets the name beside it. |
| GLAD Study            | glad-study.png           | The study's own header logo from gladstudy.org.uk (raster; no vector published)                                                                               | Confirm with the GLAD team; ask for vector artwork.                                                                           |
| DATAMIND              | datamind.svg             | Official vector `DATAMIND_black_cmyk.svg` from datamind.org.uk                                                                                                | Confirm with DATAMIND comms. A white variant exists on their site if a dark ground is ever needed.                            |
| MHDI                  | mhdi.png                 | The site lockup from mhdi.uk (raster; Wix, no vector published), white ground removed to transparency                                                         | Confirm with MHDI; ask for vector artwork.                                                                                    |

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
