# Fixtures

These files are real responses from the Rijksmuseum API, captured on 2026-10-01. Tests use them
through the MSW handlers in `src/test/msw/handlers.ts`. No test calls the real API.

To refresh them, run the commands below from this folder. Then run `pnpm test`, because the
expected values in the tests can change.

```sh
SEARCH=https://data.rijksmuseum.nl/search/collection

curl -sf "$SEARCH?creator=Rembrandt&title=Nachtwacht&imageAvailable=true" | jq . > search-rembrandt-nachtwacht.json
curl -sf "$SEARCH?creator=Rembrandt&imageAvailable=true" | jq . > search-rembrandt-page1.json
curl -sf "$SEARCH?title=zzqqxx&imageAvailable=true" | jq . > search-empty.json

for entity in object-200107928:200107928 person-2103429:2103429 \
  visual-202107928:202107928 digital-500711199912110510799100:500711199912110510799100; do
  curl -sfL -H 'Accept: application/ld+json' "https://id.rijksmuseum.nl/${entity#*:}" | jq . > "${entity%%:*}.json"
done
```

| File                                    | Content                                      |
| --------------------------------------- | -------------------------------------------- |
| `search-rembrandt-nachtwacht.json`      | Search with 1 result: The Night Watch        |
| `search-rembrandt-page1.json`           | First search page: 100 IDs and a `next` link |
| `search-empty.json`                     | Search with 0 results                        |
| `object-200107928.json`                 | The Night Watch (SK-C-5)                     |
| `person-2103429.json`                   | Rembrandt van Rijn                           |
| `visual-202107928.json`                 | Visual item of The Night Watch               |
| `digital-500711199912110510799100.json` | Digital object with the IIIF image URL       |

Hook tests that need many results use `makeSearchPage` in `src/test/msw/factories.ts` instead
of real pages.
