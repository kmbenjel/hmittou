# حمار الشعراء (أرجوزة) | د. عبد الهادي حميتو

Welcome to the official repository for **Hmittou**, an interactive reading platform, digital manuscript, and PDF publication engine dedicated to the famous Rajaz poem "حمار الشعراء" (The Donkey of Poets) by the late Moroccan scholar **Dr. Abdelhadi Hmittou**.

---

## 📖 دليل القارئ والتجربة التفاعلية (Arabic User Guide)

<div align="center">
  <img src="assets/hmittou-icon-192.png" width="96" alt="شعار أرجوزة حمار الشعراء" />
</div>

أهلاً بك في منصة القراءة التفاعلية المخصصة لقصيدة **"حمار الشعراء"**؛ الأرجوزة الرائعة النظم والفوائد للعلامة المغربي **د. عبد الهادي حميتو** رحمه الله، والتي يدافع فيها عن بحر الرَّجَز ويزيل عنه لَقَبَهُ التاريخي المستصغر له.

تم تصميم هذا الموقع لتقديم **تجربة قراءة أصيلة وتفاعلية** تحاكي جماليات المخطوطات العربية اليدوية، مع دمج أحدث تقنيات الويب المتجاوبة والميسرة للوصول.

---

### ✨ مزايا المنصة وخصائصها الفريدة

#### 1. المحاذاة الشعرية المتناظرة (سيمترية بحر الرَّجَز)
تُعرض أبيات القصيدة بأسلوب الشطرين المتوازيين (الصدر والعجز) مع الحفاظ على **عمود مركزي مستقيم تماماً** يفصل بينهما، تماماً كما تُكتب الدواوين المطبوعة واليدوية الفاخرة.

#### 2. الاستطالة الجمالية الذكية (الكشيدة والمد)
لتحقيق التناظر التام بين شطري البيت، يقوم خوارزمي مخصص بالبحث عن مواضع الحروف القابلة للوصل والمد تفادياً للأبعاد الفاصلة الاصطناعية.
* **الأمان الخطّي**: يمنع الخوارزمي تمديد الحروف التي لا تتصل بما بعدها (مثل الواو، الألف، الراء، الدال، وأيضاً الياء المقصورة والهمزة على الواو `ؤ` و`ى`) لضمان عدم حدوث تشوه كاليغرافي.
* **المدود الطبيعية**: يتم تمديد الحروف المتصلة بالقدر الذي يتطلبه توازن السطرين بدقة متناهية.

<div align="center">
  <img src="assets/hmittou-social-card.jpg" width="550" alt="بطاقة المعاينة الاجتماعية للقصيدة" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
</div>

#### 3. لوحة التحكم السفلية المدمجة (Bottom Navigation Console)
تظهر في أسفل الشاشة على الهواتف الذكية لوحة تحكم عائمة بتصميم زجاجي انسيابي (Glassmorphism) تمنحك إمكانية:
* **تبديل المظهر**: التحويل الفوري بين المظهر الفاتح (Light Mode) والمظهر الداكن (Dark Mode) المريح للعين ليلاً.
* **التحكم في الخط**: تكبير وتصغير الخط مباشرة لتسهيل القراءة.
* **التنقل الذكي**: الانتقال بضغطة زر إلى أعلى الصفحة، أو إلى قسم **"التكملة"** (البيت 133)، أو لأسفل الصفحة.
* **التكامل والتحميل**: الاستماع للقصيدة بالصوت عبر SoundCloud، مشاركة القصيدة مع أصدقائك عبر WhatsApp، أو فتح وتحميل ديوان القصيدة كملف PDF.

#### 4. النسخ النظيف للقصيدة
عند قيامك بنسخ أي شطر أو بيت من الموقع لمشاركته، يقوم الموقع تلقائياً **بتطهير النص من الكشيدات وحروف المد الزائدة** (ـ) ليعود النص لحالته الإملائية الطبيعية السهلة القراءة على الهواتف والأجهزة الأخرى.

---

## 🛠️ Codebase Architecture & Developer Documentation (English)

This repository is built as a self-contained, high-performance web experience and publishing pipeline. It adheres to a strict Single-File build principle to ensure instant loading and zero server-side compilation requirements.

### 1. Structural File Layout
* [index.html](index.html): The complete frontend application containing HTML5 markup, CSS3 styling, and JavaScript logic in one unified, high-performance file.
* [assets/](assets/): Brand assets including responsive favicons, Apple touch icons, and social graph cards (`og:image`).
* [fonts/](fonts/): Local font files hosting the **Amiri** font families (`amiri-regular-*.woff2` and `amiri-bold-*.woff2`) to prevent third-party network blocking.
* [scripts/](scripts/): Builder utilities for compilation, metadata date stamping, and automated PDF exports.
* [data/](data/): Supplementary project data, including the aligned Arabic YouTube subtitles.

---

### 2. Symmetrical "Kaseedah" Layout (The Spine Grid)
Traditional Arabic poetry is structured around two matching hemistiches: the **Sadr** (right column) and the **'Ajuz** (left column). In modern web layout, achieving a perfectly straight central gutter ("middle spine") with flexible text is notoriously difficult. We achieve this through a specialized CSS Grid design:

```css
.bayt {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3.75rem; /* The central spine width */
}
.verse:first-child {
    text-align: left; /* Pulls Sadr inward to the left */
}
.verse:last-child {
    text-align: right; /* Pulls 'Ajuz inward to the right */
}
```
Because the document direction is set to Right-To-Left (`dir="rtl"`), the browser places the first child on the right side. By aligning the text of both columns inward toward the central gap, we form a perfectly straight vertical center axis ("spine").

---

### 3. Symmetrical Justification (The Kashida Algorithm)
Because words have varying character counts, the Sadr and 'Ajuz lines will naturally have different widths. Standard text justification (`text-align: justify`) creates awkward, calligraphically incorrect gaps between Arabic letters. 

To solve this, we implement a custom **Dynamic Kashida (Tatweel) justification algorithm** in JavaScript:
1. **Ruler Measurement**: On page load and resize, the system measures the natural, un-stretched width of each hemistich inside a hidden DOM element.
2. **Kashida Exclusion Rules**: The script scans each word's characters and determines valid insertion points for the Arabic Tatweel character (`ـ`). To maintain calligraphic integrity, it excludes:
   - Letters that do not connect to their left neighbor (e.g. `ا`, `أ`, `إ`, `آ`, `د`, `ذ`, `ر`, `ز`, `و`, `ؤ`, `ى`).
   - Words consisting of fewer than 3 letters (e.g. short prepositions like `في`, `من`, `عن`).
   - Double-stretching inside a single word (stretches are restricted to at most one optimal position per word).
   - Junctions immediately preceding final `ي` or `ى` ligatures.
   - Letters carrying tanween markers (e.g. `ـًا`).
3. **Simulated State Selector**: The algorithm generates all possible stretched variations in-memory (calculating the width mathematically using `naturalWidth + count * tatweelWidth`), completely avoiding browser layout thrashing. It picks the pair (Sadr & 'Ajuz) that minimizes the width difference and aligns closest to the target line width.
4. **Subpixel Word Spacing Justification**: To eliminate the minor residual pixel variations remaining after integer tatweel insertions, the script calculates the tiny remaining deficit and distributes it microscopically using CSS `word-spacing`. This yields pixel-perfect alignment.

---

### 4. Build Pipeline & Scripting Tools
To update build metadata and generate printed PDF assets, the repository provides three automated scripts:

#### A. Metadata Stamping (`scripts/stamp_metadata_dates.py`)
Stamps the build-time compilation date dynamically before deployment:
* Updates `<meta name="last-modified" content="YYYY-MM-DD">`.
* Updates `"dateModified": "YYYY-MM-DD"` inside the `application/ld+json` schema.
* Updates the footer text showing the last update date in Arabic (e.g., `آخر تحديث: 10 يونيو 2026`).
* Updates `<lastmod>` inside [sitemap.xml](sitemap.xml).

#### B. PDF Exporter (`scripts/generate_pdfs_puppeteer.js`)
Uses Headless Chrome (via Puppeteer) to compile two dedicated PDF print outputs:
1. **Mobile PDF** (`hmittou.pdf`): Formatted with single-column portrait stacking, custom page sizes (`120mm x 210mm`), dynamic page-numbering, and large typography (`21pt`).
2. **Desktop PDF** (`hmittou_desktop.pdf`): Formatted as a side-by-side dual-column layout on an `A4 portrait` page with strict margins.
* **Layout Integrity Rules**: The print stylesheets include page-break selectors and force inward padding resets (`padding: 0 45pt 0 45pt !important`) on `.bayt` to ensure absolute-positioned line numbers never bleed into unprintable areas.

#### C. Build Master (`scripts/generate_pdfs.py`)
A wrapper Python script that aggregates the stamping and Puppeteer PDF builds.

---

### 5. Developer Guide (Local Run)

#### Step 1: Install Dependencies
To install the Puppeteer dependencies required for compiling the PDFs:
```bash
npm install
```

#### Step 2: Serve Locally
Since the script uses Service Workers (PWA) and loads local web assets, you should run a local web server:
```bash
python3 -m http.server 8000
```
Then navigate to `http://localhost:8000` in your browser.

#### Step 3: Run the Build Pipeline
To stamp modified dates and compile the latest PDF manuals:
```bash
python3 scripts/generate_pdfs.py
```
This will automatically generate [hmittou.pdf](hmittou.pdf) and [hmittou_desktop.pdf](hmittou_desktop.pdf) in the project root.
