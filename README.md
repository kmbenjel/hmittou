# Hmittou - Traditional Arabic Poetry Reader

A highly tailored, responsive web application and PDF generation engine for reading and printing traditional Arabic poetry (Rajaz). The project uses a pure HTML, CSS, and JS architecture to deliver a mathematically precise "Kaseedah" layout.

## Features
- **Perfect Spine Layout**: Employs CSS Grid to render a flawless, symmetrical central spine for the verses (Sadr and Ajuz), accurately recreating traditional manuscript aesthetics.
- **Dynamic PDF Generation**: Includes custom `@media print` rules tailored for headless Chrome to generate strict `120mm x 210mm` (mobile booklet) and `A4` (desktop) PDF exports without margin bleeding or off-centering.
- **Custom Orthography**: Built-in JavaScript utilities to convert Western digits to Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) and gracefully strip layout Kashidas/Tatweel (ـ) from user clipboards.
- **Responsive UI**: Features dark mode and dynamic font-scaling, ensuring the classical text remains accessible on all devices.

## For AI Agents (Claude, GPT, Gemini)
If you are an AI assistant tasked with modifying this repository, you **MUST** read [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) before proposing any structural changes to the CSS layout or HTML. The print engine relies on highly specific margin resets and grid architectures that should not be regressed into standard Flexbox centering hacks.

## Usage
Simply serve `index.html` via any local HTTP server:
```bash
python3 -m http.server 8000
```

To generate the PDFs using headless Chrome:
```bash
python3 scripts/generate_pdfs.py # Assuming a generation script is present
```
