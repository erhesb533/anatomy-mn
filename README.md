# Анатоми MN

Монголын анагаахын 1-р курсын оюутнуудад зориулсан анатомийн давтлагын апп.
Утсан дээр суулгаж (PWA), офлайнаар ашиглана. Бүртгэл, сервер шаардлагагүй.

**Хамрах хүрээ (v1.1):** яс, үе мөч, булчин — 11 сэдэв, 669 бүтэц, 439 зураг таних, 685 онолын асуулт.

> ⚠️ Агуулга анатомийн багшаар **шалгагдаагүй** (`verified: false`). Монгол анатомийн нэр томьёо хараахан ороогүй.

## Горимууд
- **Атлас** — бүтэц бүрийн Латин (TA2) / Англи нэр, тайлбар, эхлэл, бэхлэл, мэдрэл, зураг, эх сурвалж.
- **Флэшкарт** — Leitner хайрцгийн давтлагын хуваарь (1, 3, 7, 14, 30 хоног).
- **Зураг таних** — OpenStax-ын шошготой зургууд дээр нэрийг байрлалтай холбох дасгал.
- **Тест** — олон сонголттой, тайлбартай; буруу хариулсан асуулт дахин түрүүлж гарна.
- Нэрийн хэл сэлгэгч: Lat / Eng / Мон.

## Бүтэц
```
index.html, app.js, styles.css   Апп (фреймворкгүй, build алхамгүй)
sw.js, manifest.webmanifest      Офлайн, суулгах
data/*.json                      Агуулга — сэдэв бүр нэг файл (schema/schema.json)
data/index.json, search.json     tools/build_index.py үүсгэнэ
media/                           OpenStax зургууд (1400px хүртэл жижигрүүлсэн)
schema/                          schema.json, sources.json, CONTENT_GUIDE.md, жишээ
tools/validate.py                Агуулгын шалгалт (CI-д ажиллана)
tools/build_index.py             Сэдвийн болон хайлтын индекс
tools/sources/                   Эх текст (OpenStax Markdown, TA2 хүснэгт)
tools/wikipedia_patches.json     Wikipedia-аас авсан булчингийн утгууд (эх хувь)
```

## Локалаар ажиллуулах
```bash
python3 -m http.server 8000      # http://localhost:8000
```

## Агуулга засах
1. `data/<сэдэв>.json` засна (`schema/CONTENT_GUIDE.md`-ийн дүрмээр).
2. `pip install jsonschema && python3 tools/validate.py 'data/*.json'`
3. `python3 tools/build_index.py`
4. Агуулга өөрчлөгдсөн бол `sw.js` доторх `VERSION`-г нэмэгдүүлнэ (оюутнуудын утсан дээр шинэчлэгдэнэ).

`main` салбарт push хийхэд GitHub Actions агуулгыг шалгаад GitHub Pages-д байршуулна.

## Эх сурвалж ба лиценз
| Юу | Эх сурвалж | Лиценз |
|---|---|---|
| Тайлбар, ангилал, булчингийн хүснэгт, зураг | OpenStax, *Anatomy and Physiology 2e*, Betts et al., Rice University | CC BY-NC-SA 4.0 |
| Латин нэр (TA2 ID) | Terminologia Anatomica 2 (FIPAT 2019), Z-Anatomy `TA2.csv` | CC BY-SA 4.0 |
| Булчингийн мэдрэл, цусан хангамж, зарим эхлэл/бэхлэл | English Wikipedia (Infobox muscle) | CC BY-SA 4.0 |

- **Агуулга** (`data/`, `media/`, `schema/`, `tools/sources/`): **CC BY-NC-SA 4.0** — арилжааны бус, эх сурвалжийг дурдаж, ижил лицензээр түгээнэ. `LICENSE-CONTENT.md`.
- **Код**: **MIT** — `LICENSE`.
