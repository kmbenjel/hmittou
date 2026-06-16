// ── Main Application Script ──────────────────────────────────────────────────
// Externalized from inline <script> in index.html for CSP compliance.

const READER_PREFS_KEY = 'hmittou.readerPrefs';

function toIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function formatArabicGregorianDate(date) {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

function getPageModifiedDate() {
    const fallback = document.getElementById('last-updated')?.dataset.fallbackDate;
    if (new URLSearchParams(window.location.search).has('print') && fallback) {
        const printDate = new Date(fallback + 'T00:00:00');
        if (!Number.isNaN(printDate.getTime())) return printDate;
    }

    const lastModified = new Date(document.lastModified);
    if (!Number.isNaN(lastModified.getTime())) return lastModified;
    const fallbackDate = fallback ? new Date(fallback + 'T00:00:00') : new Date();
    return Number.isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate;
}

function updateLastModifiedMetadata() {
    const date = getPageModifiedDate();
    const isoDate = toIsoDate(date);
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated) {
        lastUpdated.textContent = 'آخر تحديث: ' + formatArabicGregorianDate(date);
    }

    const meta = document.querySelector('meta[name="last-modified"]');
    if (meta) meta.setAttribute('content', isoDate);

    const structuredData = document.querySelector('script[type="application/ld+json"]');
    if (!structuredData) return;

    try {
        const data = JSON.parse(structuredData.textContent);
        data.dateModified = isoDate;
        structuredData.textContent = JSON.stringify(data, null, 2);
    } catch (e) {}
}

function getReaderPrefs() {
    try {
        return JSON.parse(localStorage.getItem(READER_PREFS_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function setReaderPrefs(nextPrefs) {
    try {
        const prefs = Object.assign({}, getReaderPrefs(), nextPrefs);
        localStorage.setItem(READER_PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {}
}

function applyReaderPrefs() {
    const prefs = getReaderPrefs();
    if (prefs.darkMode === true) {
        document.documentElement.classList.add('dark-mode');
    } else if (prefs.darkMode === false) {
        document.documentElement.classList.remove('dark-mode');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark-mode');
    }
    if (typeof prefs.fontSize === 'number' && prefs.fontSize >= 12 && prefs.fontSize <= 32) {
        // inline !important so user zoom wins over the landscape font-size override
        document.documentElement.style.setProperty('font-size', prefs.fontSize + 'px', 'important');
    }
    syncThemeUi();
}

function syncThemeUi() {
    const isDark = document.documentElement.classList.contains('dark-mode');
    document.querySelectorAll('[data-action="toggle-theme"]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(isDark));
    });
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', isDark ? '#121212' : '#f5f5f4');
}

function toggleTheme() {
    document.documentElement.classList.toggle('dark-mode');
    setReaderPrefs({ darkMode: document.documentElement.classList.contains('dark-mode') });
    syncThemeUi();
}

// deltaPx: change in root font size, in pixels (fine 1px steps so zoom can
// creep right up to the screen edge instead of overshooting it).
function changeFontSize(deltaPx) {
    const html = document.documentElement;
    const current = parseFloat(getComputedStyle(html).fontSize) || 16;
    const next = current + deltaPx;
    if (next < 12 || next > 32) return;

    // Apply first, then measure the real result and revert if it overflows.
    // This avoids any assumption about how width scales with font size.
    const prevValue = html.style.getPropertyValue('font-size');
    const prevPriority = html.style.getPropertyPriority('font-size');
    html.style.setProperty('font-size', next + 'px', 'important');

    if (deltaPx > 0 && wouldOverflow()) {
        if (prevValue) html.style.setProperty('font-size', prevValue, prevPriority);
        else html.style.removeProperty('font-size');
        return;
    }

    setReaderPrefs({ fontSize: next });
    setTimeout(() => { safeCall(applyKashida); safeCall(updateNumberVisibility); }, 60);
}

// True if any verse text no longer fits. On desktop/landscape verses live in
// fixed columns, so we test against the column box. On portrait phones the
// verse spans the viewport, so we test against the screen width (the
// bayt::before numbers are allowed to overflow, so they are not measured).
function wouldOverflow() {
    const isColumned = window.matchMedia('(min-width: 680px)').matches;
    const verses = document.querySelectorAll('.verse');
    if (isColumned) {
        for (const v of verses) {
            if (v.scrollWidth > v.clientWidth + 1) return true;
        }
    } else {
        const limit = window.innerWidth - 10;
        for (const v of verses) {
            if (v.scrollWidth > limit) return true;
        }
    }
    return false;
}

// ── Kashida (Tatweel) Stretching ──────────────────────────────────────
const KASHIDA_JOINERS = /[بتثجحخسشصضطظعغفقكلمنهيئـ][ً-ٰٟ]*/g;
const TATWEEL = 'ـ';

// Helper to check if a matched position is inside the 'لا' ligature
function isInsideLa(orig, matchIndex, p) {
    if (orig[matchIndex] !== 'ل') return false;
    const diacritics = /[\u064B-\u065F\u0670\u0640]/;
    let i = p;
    while (i < orig.length && diacritics.test(orig[i])) {
        i++;
    }
    if (i < orig.length) {
        const nextChar = orig[i];
        if (['ا', 'أ', 'إ', 'آ'].includes(nextChar)) {
            return true;
        }
    }
    return false;
}

// Get all valid positions for kashida insertion
function getKashidaPositions(orig) {
    const positions = [];
    KASHIDA_JOINERS.lastIndex = 0;
    let m;

    while ((m = KASHIDA_JOINERS.exec(orig)) !== null) {
        const p = m.index + m[0].length;
        if (p >= orig.length) continue;
        if (!/[بتثجحخدذرزسشصضطظعغفقكلمنهويىئؤةـ]/.test(orig[p])) continue;
        if (isInsideLa(orig, m.index, p)) continue;
        
        // Rule: Do not stretch very short words (fewer than 3 letters)
        // This exclusion also applies to words when linked with prefix conjunctions وَ or فَ
        const lastSpaceBefore = orig.lastIndexOf(' ', m.index);
        const startOfWord = lastSpaceBefore === -1 ? 0 : lastSpaceBefore + 1;
        let endOfWord = orig.indexOf(' ', p);
        if (endOfWord === -1) endOfWord = orig.length;
        const word = orig.slice(startOfWord, endOfWord);
        const cleanWord = word.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
        
        // Exclude all variations of "Allah" from stretching
        if (/^(و|ف)?(ب|ل)?(ال|ل)لهم?$/.test(cleanWord)) {
            continue;
        }
        
        let effectiveLength = cleanWord.length;
        if (cleanWord.length > 0 && (cleanWord[0] === 'و' || cleanWord[0] === 'ف')) {
            effectiveLength = cleanWord.length - 1;
        }
        if (effectiveLength < 3) {
            continue;
        }
        
        // Exclude the prefixes لل (indices < 2) and [وفب]لل (indices < 3) in words
        const cleanBeforeSlice = orig.slice(startOfWord, p).replace(/[\u064B-\u065F\u0670\u0640]/g, '');
        const cleanIndexInWord = cleanBeforeSlice.length;
        if (cleanWord.startsWith('لل') && cleanIndexInWord < 2) {
            continue;
        }
        if (/^[وفب]لل/.test(cleanWord) && cleanIndexInWord < 3) {
            continue;
        }
        
        positions.push(p);
    }
    
    // Filter positions to ensure at most one kashida per word (keeping the first valid one)
    const uniquePositions = [];
    let lastSpaceIdx = -2;
    for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const currentWordStart = orig.lastIndexOf(' ', pos - 1);
        if (currentWordStart > lastSpaceIdx) {
            uniquePositions.push(pos);
            lastSpaceIdx = currentWordStart;
        }
    }
    return uniquePositions;
}

// Reconstruct string with R tatweels distributed evenly
function insertTatweels(orig, positions, R) {
    if (R <= 0 || positions.length === 0) return orig;
    let counts = new Array(positions.length).fill(0);
    for (let round = 0; round < R; round++) {
        counts[round % positions.length]++;
    }
    let out = '', prev = 0;
    for (let i = 0; i < positions.length; i++) {
        out += orig.slice(prev, positions[i]) + TATWEEL.repeat(counts[i]);
        prev = positions[i];
    }
    out += orig.slice(prev);
    return out;
}

function applyKashida() {
    const bayts = document.querySelectorAll('.bayt');
    if (!bayts.length) return;

    const verses = document.querySelectorAll('.verse');
    const isDesktop = window.matchMedia('(min-width: 680px)').matches;
    const maxTatweels = isDesktop ? 36 : 30;

    // 1. Initialize original texts and cache kashida positions on first run
    if (!verses[0]._origText) {
        verses.forEach(v => {
            v._origText = v.textContent.trim();
            v._kashidaPositions = getKashidaPositions(v._origText);
        });
    }

    // 2. Setup canvas context for font metrics measurement (0 layout reflows!)
    const isWide = window.matchMedia('(min-width: 1024px)').matches;
    const prefs = getReaderPrefs();
    let rootSize = 16;
    if (typeof prefs.fontSize === 'number' && prefs.fontSize >= 12 && prefs.fontSize <= 32) {
        rootSize = prefs.fontSize;
    } else if (isDesktop) {
        rootSize = isWide ? 22 : 18;
    }
    const fontSizePx = 1.4 * rootSize;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `normal ${fontSizePx}px Amiri, serif`;
    const tatweelWidth = ctx.measureText(TATWEEL.repeat(50)).width / 50 || 5.0;

    const updates = [];

    // 3. Process each bayt in-memory using canvas (0 DOM operations!)
    bayts.forEach((bayt, idx) => {
        // Symmetrical indexing: v1 and v2 are at 2*idx and 2*idx+1
        const s1 = verses[2 * idx];
        const s2 = verses[2 * idx + 1];
        if (!s1 || !s2) return;
        
        const orig1 = s1._origText;
        const orig2 = s2._origText;

        // Measure natural widths using canvas (0 reflows)
        const w1 = ctx.measureText(orig1).width;
        const w2 = ctx.measureText(orig2).width;

        let sAnchor, sStretched, origStretched, targetW, wNatural, isS1Anchor;
        if (w1 >= w2) {
            sAnchor = s1;
            sStretched = s2;
            origStretched = orig2;
            targetW = w1;
            wNatural = w2;
            isS1Anchor = true;
        } else {
            sAnchor = s2;
            sStretched = s1;
            origStretched = orig1;
            targetW = w2;
            wNatural = w1;
            isS1Anchor = false;
        }

        const positions = sStretched._kashidaPositions;
        const diff = targetW - wNatural;

        if (diff < 0.5 || positions.length === 0) {
            updates.push({
                sAnchor,
                sStretched,
                textAnchor: isS1Anchor ? orig1 : orig2,
                textStretched: origStretched,
                wordSpacing: '',
                letterSpacing: ''
            });
            return;
        }

        // In-memory binary search on canvas
        const R_est = Math.round(diff / tatweelWidth);
        const limitR = Math.max(1, Math.min(maxTatweels, R_est));

        let low = 0;
        let high = limitR;
        let bestR = 0;
        let bestDiff = Infinity;
        let bestW = wNatural;

        while (low <= high) {
            let mid = Math.floor((low + high) / 2);
            const candidateText = insertTatweels(origStretched, positions, mid);
            const w = ctx.measureText(candidateText).width;
            const d = w - targetW;
            
            if (Math.abs(d) < bestDiff) {
                bestDiff = Math.abs(d);
                bestR = mid;
                bestW = w;
            }

            if (w < targetW) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        const textStretched = insertTatweels(origStretched, positions, bestR);
        const deficit = targetW - bestW;
        const spaces = (textStretched.match(/ /g) || []).length;

        let wordSpacing = '';
        let letterSpacing = '';

        if (spaces > 0) {
            wordSpacing = (deficit / spaces) + 'px';
        } else {
            const charCount = [...textStretched].length;
            if (charCount > 1) {
                letterSpacing = (deficit / (charCount - 1)) + 'px';
            }
        }

        updates.push({
            sAnchor,
            sStretched,
            textAnchor: isS1Anchor ? orig1 : orig2,
            textStretched,
            wordSpacing,
            letterSpacing
        });
    });

    // 4. Batch DOM Write: Apply final texts and subpixel styles (1 single write batch, 0 reads!)
    updates.forEach(up => {
        up.sAnchor.textContent = up.textAnchor;
        up.sAnchor.style.wordSpacing = '';
        up.sAnchor.style.letterSpacing = '';

        up.sStretched.textContent = up.textStretched;
        up.sStretched.style.wordSpacing = up.wordSpacing;
        up.sStretched.style.letterSpacing = up.letterSpacing;
    });
}

// Hide the verse numbers on mobile portrait once they would reach the screen
// edge. They sit at right:-0.6rem of the bayt; the widest verse keeps a
// comfortable gap from the text at every zoom level, so the edge is the only
// binding constraint. Runs on load, zoom and resize — never on scroll.
function updateNumberVisibility() {
    const bayt = document.querySelector('.bayt');
    if (!bayt) return;
    let hide = false;
    if (window.matchMedia('(max-width: 679px)').matches) {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const numberRight = bayt.getBoundingClientRect().right + 0.6 * rem;
        hide = numberRight > window.innerWidth - 4; // fade just before the glyph clips
    }
    document.body.classList.toggle('hide-bayt-numbers', hide);
}


function scrollToTop() { window.scrollTo({top: 0, behavior: 'smooth'}); }
function scrollToBottom() { document.getElementById('bottom').scrollIntoView({behavior: 'smooth'}); }
function scrollToPart2() { document.getElementById('part2').scrollIntoView({behavior: 'smooth'}); }

function updatePdfLink() {
    const pdfCard = document.getElementById('pdf-card');
    if (pdfCard) {
        const isDesktop = window.matchMedia('(min-width: 680px)').matches;
        const pdfFile = isDesktop ? 'hmittou_desktop.pdf' : 'hmittou.pdf';
        pdfCard.setAttribute('href', pdfFile);
        pdfCard.setAttribute('download', pdfFile);
    }
}

function updateWhatsappLink() {
    const whatsappCard = document.getElementById('whatsapp-card');
    if (whatsappCard) {
        const text = `*حمار الشعراء*
رجز للعلّامة د. عبد الهادي حميتو رحمه الله.
قراءة وضبط وبرمجة: خالد بنجلّون
🔗 https://hmittou.benjelloun.dev/`;
        whatsappCard.setAttribute('href', 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text));
    }
}

function scrollToSound() {
    document.getElementById('soundcloud-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightResource('soundcloud-card');
}
function scrollToWhatsapp() {
    document.getElementById('whatsapp-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightResource('whatsapp-card');
}
function scrollToPdf() {
    document.getElementById('pdf-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightResource('pdf-card');
}
function highlightResource(id) {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.add('highlight-flash');
    setTimeout(() => card.classList.remove('highlight-flash'), 1500);
}



// Progress Bar & Auto-Hiding Controls (debounced with requestAnimationFrame)
let _scrollTicking = false;
let lastScrollTop = 0;
let bottomDockElement = null;
let desktopControlsElements = null;
let dockHideTimer = null;
const DOCK_HIDE_DELAY = 1500; // let the dock linger so readers notice it before it slides away

function scheduleDockHide() {
    if (!bottomDockElement || dockHideTimer || bottomDockElement.classList.contains('dock-hidden')) return;
    dockHideTimer = setTimeout(() => {
        if (bottomDockElement) bottomDockElement.classList.add('dock-hidden');
        dockHideTimer = null;
    }, DOCK_HIDE_DELAY);
}
function showDock() {
    if (dockHideTimer) { clearTimeout(dockHideTimer); dockHideTimer = null; }
    if (bottomDockElement) bottomDockElement.classList.remove('dock-hidden');
}

window.addEventListener('scroll', () => {
    if (!_scrollTicking) {
        requestAnimationFrame(() => {
            const winScroll = window.scrollY || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            
            // 1. Update progress bar
            const pb = document.getElementById('progressBar');
            if (pb) pb.style.width = ((winScroll / height) * 100) + '%';
            
            // 2. Dynamic controls hiding (on scroll down) / showing (on scroll up)
            if (!bottomDockElement) bottomDockElement = document.querySelector('.bottom-dock');
            if (!desktopControlsElements) desktopControlsElements = document.querySelectorAll('.controls, .nav-controls, .left-controls');
            
            if (winScroll < 50) {
                // Always show near the top
                showDock();
                if (desktopControlsElements) desktopControlsElements.forEach(c => c.classList.remove('controls-hidden'));
            } else if (Math.abs(lastScrollTop - winScroll) > 10) {
                if (winScroll > lastScrollTop) {
                    // Scrolling down: let the dock linger briefly, then hide it
                    scheduleDockHide();
                    if (desktopControlsElements) desktopControlsElements.forEach(c => c.classList.add('controls-hidden'));
                } else {
                    // Scrolling up: reveal controls immediately
                    showDock();
                    if (desktopControlsElements) desktopControlsElements.forEach(c => c.classList.remove('controls-hidden'));
                }
                lastScrollTop = winScroll;
            }
            _scrollTicking = false;
        });
        _scrollTicking = true;
    }
}, { passive: true });

// Safe runner to prevent layout or other initialization crashes from blocking critical updates
function safeCall(fn) {
    try { fn(); } catch (e) { console.error("Error executing " + fn.name + ":", e); }
}

// Consolidated initialization — runs once, with font-ready and load as retries
let _initialized = false;
function initAll() {
    // 1. Run applyKashida first so its DOM style queries run against a clean DOM state
    safeCall(applyKashida);
    // 2. Run other layout writes afterwards
    safeCall(updatePdfLink);
    safeCall(updateWhatsappLink);
    safeCall(updateNumberVisibility);
    _initialized = true;
}
safeCall(applyReaderPrefs);
safeCall(updateLastModifiedMetadata);
document.fonts.ready.then(() => { initAll(); });
window.addEventListener('load', () => { if (!_initialized) initAll(); });
let _kTimer;
window.addEventListener('resize', () => {
    clearTimeout(_kTimer);
    _kTimer = setTimeout(() => {
        safeCall(updatePdfLink);
        safeCall(applyKashida);
        safeCall(updateNumberVisibility);
    }, 250);
}, { passive: true });

// Clean copied text by stripping out Tatweel (Kashida) characters
document.addEventListener('copy', (e) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const text = selection.toString();
    const cleanedText = text.replace(/ـ/g, '');
    e.clipboardData.setData('text/plain', cleanedText);
    e.preventDefault();
});

// Register Service Worker for PWA offline support (skipping bots and Lighthouse to prevent crawl errors)
if ('serviceWorker' in navigator) {
    const isBot = navigator.webdriver || /bot|googlebot|crawler|spider|robot|crawling|lighthouse|headless/i.test(navigator.userAgent);
    if (!isBot) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then((reg) => console.log('Service Worker registered:', reg.scope))
                .catch((err) => {
                    // Silent catch for search crawlers/incognito mode that block service workers
                });
        });
    }
}

// ── Dynamic Event Binding (replaces inline onclick attributes) ────────────
// Bind all buttons with data-action attributes to their corresponding functions
const actionMap = {
    'toggle-theme': toggleTheme,
    'zoom-in': () => changeFontSize(1),
    'zoom-out': () => changeFontSize(-1),
    'scroll-top': scrollToTop,
    'scroll-part2': scrollToPart2,
    'scroll-bottom': scrollToBottom,
    'scroll-sound': scrollToSound,
    'scroll-whatsapp': scrollToWhatsapp,
    'scroll-pdf': scrollToPdf
};

document.querySelectorAll('[data-action]').forEach(btn => {
    const handler = actionMap[btn.dataset.action];
    if (handler) {
        btn.addEventListener('click', handler);
    }
});
