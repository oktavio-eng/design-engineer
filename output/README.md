# Portfolio project deliverables

Complete working archives for Meta Suplementos and Assopra Store: supplied source captures, crop records, individual images, device compositions, English copy, local review presentations, verification evidence and final ZIP packages.

These files are excluded from the Vercel deployment by the existing `/output/` entry in `.vercelignore`. Adding them to Git does not publish the review pages or change the portfolio.

## Read this before using the packages

The project folders and ZIPs preserve review snapshots. They are not exports of the current live drawers. Keep the original files when comparing the preparation stages with the published cases.

| Project | Review package | Published presentation |
| --- | --- | --- |
| [Meta Suplementos](meta-suplementos/README.md) | `final/` contains the original 25-image selection, including the home mockup and isolated IronHair mockup later removed from the gallery. Its banners remain in a review grid. | The gallery has 23 images, with the home retained as the cover. Campaigns use the shared ticker. |
| [Assopra Store](assopra-store/README.md) | `final/` and the ZIP preserve the original 23-image presentation and initial copy. [copy-expanded.md](assopra-store/copy-expanded.md) contains the subsequently approved expanded English text. | The gallery has 23 images. Campaigns appear after the catalogue, before the product and cart screens. |

Production content also includes later refinements to CloudFaster's mobile mockups and the shared drawer entrances. Those changes were already committed to `main` through [9324f65](https://github.com/oktavio-eng/design-engineer/commit/9324f6568982802cdf8a5cc58973e7698e3f14c2) before this archive PR.

For the current presentation, use the production assets in [`assets/projects/`](../assets/projects/), the content seed in [`portfolio-content.js`](../portfolio-content.js), and the media supplement in [`project-media.mjs`](../project-media.mjs). Published copy is served by the Studio; the integration and publication history are recorded in [`docs/nova-home-projetos.md`](../docs/nova-home-projetos.md).

## Local review and provenance

Each project README describes its local HTTP server and regeneration scripts. `sources/` contains preserved captures and metadata, rather than editable `.fig` files. Crop manifests record the source coordinates; review boards and QA screenshots remain separate from the individual portfolio images.

`archive-manifest.json` records the byte size and SHA-256 of every project file included in this archive, including the ZIPs. It excludes this index and itself. Verify against those hashes before regenerating or replacing a snapshot.
