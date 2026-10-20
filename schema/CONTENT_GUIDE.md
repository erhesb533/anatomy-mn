# Агуулга бэлтгэх нийтлэг заавар (бүх сэдэвт мөрдөнө)

Зорилго: Монголын анагаахын 1-р курсын оюутнуудад зориулсан анатомийн апп-ын агуулгыг
`schema.json`-ын дагуу JSON болгон бэлтгэх. Бүх файл `/home/claude/proj/` дотор байна.

## Эх сурвалж (ЗӨВХӨН эдгээрээс)
- OpenStax тексттүүд: `00-anatomical-terminology.md`, `01-bone-tissue.md`, `02-axial-skeleton.md`,
  `03-appendicular-skeleton.md`, `04-joints.md`, `05-muscular-system.md` (булчингийн хүснэгтүүд дотор нь)
- TA2 нэрийн хүснэгт: `ta2-00-general-terms.md`, `ta2-01-bones.md`, `ta2-02-joints.md`, `ta2-03-muscles.md`
- Жишээ: `example-scapula.json` — хэлбэр, хэв маягийг яг үүн шиг бич.

## Хатуу дүрэм
1. **Зохиож болохгүй.** Эх текстэд байхгүй мэдээллийг (мэдрэл, цусан хангамж, эмнэлзүй, эхлэл/бэхлэл, үе, ангилал...)
   өөрийн мэдлэгээс бүү нэм. Байхгүй бол талбарыг `null` болгож, нэрийг `missing_in_sources`-д бич
   (жишээ: `"details.innervation_mn"`). Энэ нь апп дээр "материалд байхгүй" гэж харагдана.
   Таны өөрийн мэдлэг зөв байсан ч бичихгүй — бүх мэдээлэл эх сурвалжаас мөрдөгдөх ёстой.
2. **Монгол нэр:** `names.mn = null`, `name_status.mn = "missing"`, `missing_in_sources`-д `"names.mn"`.
   Сэдвийн `topic.title.mn` мөн `null`. Асуултын `answer.mn = null`.
3. **Латин нэр:** TA2 хүснэгтээс яг тохирох мөрийг ол. Олдвол `ta2_id` = ID, `names.la` = тэр мөрийн Латин нэр
   **тэмдэгт тэмдэгтээр яг адил** (validate.py шалгана), `name_status.la = "source"`.
   Олдохгүй эсвэл эргэлзээтэй бол `ta2_id: null`, `names.la: null`, `name_status.la: "missing"`,
   `missing_in_sources`-д `"names.la"`. TA2-д ижил нэр олон удаа гарвал (жишээ "Body", "Head") тухайн ясны
   хэсэгт хамаарах мөрийг дарааллаар нь ол (TA2 нь шатлалын дарааллаар эрэмбэлэгдсэн).
4. **Англи нэр:** OpenStax-д хэрэглэсэн нэр (`name_status.en = "source"`). Өөр нэр (жишээ "glenoid fossa") байвал `synonyms`.
5. **Монгол тайлбар** (`description_mn`, `clinical_mn`, `details.*_mn`, асуулт, тайлбар): эх текстийг утгаар нь
   Монгол руу орчуул. Товч, ойлгомжтой (1–3 өгүүлбэр). Анатомийн бүтцийн нэрийг Монгол тайлбар дотор **Латин нэрээр**
   бич (TA2 Латин, байхгүй бол Англи). Монгол анатомийн нэр томьёо бүү зохио.
   Ерөнхий үгс (урд, хойд, дээд, доод, хажуу, дунд, үе, яс, булчин, нугалах, тэнийлгэх) Монголоор болно.
6. **verified:** бүх бичлэг `"review": {"verified": false, "verified_by": null, "verified_date": null, "notes": ...}`.
7. **sources:** бичлэг бүрт OpenStax locator, жишээ: `"Ch.8.2 Bones of the Upper Limb — Humerus"`.
   TA2 нэр ашигласан бол `{"source_id":"ta2","locator":"TA2 1180","fields":["ta2_id","names.la"]}` нэм.
8. **Зураг:** зөвхөн эх текстэд `[Зураг: файл.jpg]` гэж байгаа файлын нэрийг яг хуулж ашигла (validate.py шалгана).
   Бүтэц тухайн зурагт харагдаж байгаа нь зургийн тайлбар эсвэл текстээр батлагдвал л холбо.
   `region_id: null` (апп бүтээх үед бөглөнө). `view`-г тайлбараас мэдэгдэж байвал бич, эс бөгөөс null.

## Бүтцийн төрөл (kind, schema 1.1)
bone, bone-landmark, skeleton-division (axial skeleton, pectoral girdle, pelvis), cartilage (costal, septal),
joint, joint-part (capsule, synovial membrane, disc, meniscus, labrum, bursa, tendon sheath), ligament,
tendon-fascia (tendon, aponeurosis, fascia, retinaculum), muscle, muscle-group, opening (diaphragm hiatus),
region (triangle, fossa, eminence, perineum).

## Зураг шалгалт
Зураг бүрийг нүдээр шалгаж `figure_check`-д `labeled` (нэрээр шошголсон) эсвэл `visible` (шошгогүй ч тод харагдана) гэж тэмдэглэнэ.
Зурагт олдохгүй бүтцийг зурагтай холбохгүй, практик асуулт гаргахгүй.

## Мэдрэлийн тогтолцоо (schema 1.2)
- system = "nervous"; region = brain / spinal-cord / peripheral-nerves (гавлын мэдрэл → peripheral-nerves).
- kind: brain-part, spinal-cord-part, nerve, ganglion, meninx, ventricle, vessel, tract. details = null (энэ тогтолцоонд details бүтэц алга;
  үүрэг, байрлал, холбоог description_mn-д бичнэ). Мэдрэлийн доод ангилал/үүрэг (жишээ нь гавлын мэдрэл мэдрэхүйн/хөдөлгөөний)
  эх текстэд байвал description_mn-д оруул.
- TA2 хүснэгт: ta2-04-cns.md (тархи, нугас, хальс, ховдол), ta2-05-pns.md (гавлын, нугасны, ургал мэдрэл).
- ID жишээ: cerebrum, frontal-lobe, precentral-gyrus, central-sulcus, thalamus, hypothalamus, midbrain, pons, medulla-oblongata,
  cerebellum, spinal-cord, dorsal-horn, dura-mater, arachnoid-mater, pia-mater, lateral-ventricle, third-ventricle,
  cerebral-aqueduct, fourth-ventricle, choroid-plexus, circle-of-willis (эх текстийн нэрээр), olfactory-nerve, optic-nerve,
  oculomotor-nerve, trochlear-nerve, trigeminal-nerve, abducens-nerve, facial-nerve, vestibulocochlear-nerve,
  glossopharyngeal-nerve, vagus-nerve, accessory-nerve, hypoglossal-nerve, brachial-plexus, cervical-plexus, lumbar-plexus, sacral-plexus,
  dorsal-root-ganglion, sciatic-nerve, femoral-nerve.

## ID дүрэм (файл хоорондын холбоос үүнээс хамаарна)
- Англи нэрийг жижиг үсэг, зураасаар: `humerus`, `head-of-humerus`, `greater-tubercle`, `biceps-brachii`,
  `glenohumeral-joint`, `deltoid-tuberosity`.
- Олон ясанд давтагддаг хэсгийн нэрэнд ясны нэрийг нэм: `head-of-femur`, `head-of-radius`, `body-of-sternum`,
  `spinous-process-of-vertebra`, `styloid-process-of-ulna`.
- Ясны нэрс (бусад файлаас холбоход): `frontal-bone`, `parietal-bone`, `temporal-bone`, `occipital-bone`,
  `sphenoid-bone`, `ethmoid-bone`, `maxilla`, `mandible`, `zygomatic-bone`, `nasal-bone`, `hyoid-bone`,
  `vertebral-column`, `cervical-vertebrae`, `thoracic-vertebrae`, `lumbar-vertebrae`, `atlas`, `axis`, `sacrum`, `coccyx`,
  `sternum`, `ribs`, `clavicle`, `scapula`, `humerus`, `radius`, `ulna`, `carpal-bones`, `metacarpal-bones`,
  `phalanges-of-hand`, `hip-bone`, `ilium`, `ischium`, `pubis`, `pelvis`, `femur`, `patella`, `tibia`, `fibula`,
  `tarsal-bones`, `metatarsal-bones`, `phalanges-of-foot`, `calcaneus`, `talus`.
  Эдгээрийг өөр файлаас `articulates_with`, `origin_bone_ids`, `bone_ids`-д ашиглаж болно (тухайн файлд тодорхойлох шаардлагагүй).
- Асуулт: `prac-<structure-id>-01`, `theo-<сэдэв-эсвэл-бүтэц>-01`.

## Хэмжээ
- **Бүтэц:** тухайн хэсгийн текстэд **тодоор (**bold**) тэмдэглэгдсэн, эсвэл хүснэгтэд нэрлэгдсэн** бүх анатомийн бүтэц
  (яс, ясны хэсэг/товгор/нүх, үе, шөрмөс, булчин). Физиологи, эсийн түвшний ойлголтуудыг (osteoblast г.м.) оруулахгүй —
  тэдгээрийг зөвхөн онолын асуултад ашиглаж болно.
- **Практик асуулт:** зурагт холбогдсон бүтэц бүрд 1 (зураггүй бүтэцд гаргахгүй).
- **Онолын асуулт:** бүтэц тутамд дунджаар 1 орчим, сэдэвт хамгийн багадаа 10. Олон сонголттой (4 хариулт),
  буруу хариултууд нь утга учиртай боловч эх текстээр буруу нь батлагдах ёстой. `explanation_mn` нь эх текстэд тулгуурлана.
  `topic_tag`-ийг тохируулж тавь. Хариулт нь эх текстээс шууд гарахгүй асуулт бүү гарга.

## Шалгалт (дуусгахаас өмнө заавал)
`python3 /home/claude/proj/validate.py /home/claude/proj/content/<таны-файл>.json`
"өөр файлд байж магадгүй" гэсэн холбоосын анхааруулгаас бусад бүх АСУУДЛЫГ засна.
Том файлыг хэд хэдэн хэсэгт (Python скриптээр жагсаалт нэмэх) бичиж болно; эцэст нь нэг JSON файл байна.
