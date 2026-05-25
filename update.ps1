$path = "C:\Users\pc\.gemini\antigravity\scratch\kmbenjel.github.io\hmittou\index.html"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# 1. Update CSS for controls (move to right, add glassmorphism)
$content = $content -replace "\.controls \{ position: fixed; top: 20px; left: 20px;", ".controls { position: fixed; top: 20px; right: 20px;"
$content = $content -replace "\.nav-controls \{ position: fixed; bottom: 20px; left: 20px;", ".nav-controls { position: fixed; bottom: 20px; right: 20px;"

$oldBtnCss = "\.control-btn \{ [^\}]+\}"
$newBtnCss = ".control-btn { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(8px); border: 1px solid rgba(0,0,0,0.1); color: #333; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-weight: bold; font-family: sans-serif; transition: 0.3s; }"
$content = $content -replace $oldBtnCss, $newBtnCss

$oldDarkBtnCss = "body\.dark-mode \.control-btn \{ [^\}]+\}"
$newDarkBtnCss = "body.dark-mode .control-btn { background: rgba(30, 30, 30, 0.7); border-color: rgba(255,255,255,0.1); color: #fff; }"
$content = $content -replace $oldDarkBtnCss, $newDarkBtnCss

# 2. Add animation and progress bar CSS
$animCss = "
        .bayt { margin-bottom: 35px; display: block; opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease-out, transform 0.6s ease-out; }
        .bayt.visible { opacity: 1; transform: translateY(0); }
        #progressBarContainer { position: fixed; top: 0; left: 0; width: 100%; height: 4px; background: transparent; z-index: 2000; }
        #progressBar { height: 100%; width: 0%; background: linear-gradient(90deg, #888, #333); }
        body.dark-mode #progressBar { background: linear-gradient(90deg, #555, #fff); }
"
$content = $content -replace "\.bayt \{ margin-bottom: 35px; display: block; \}", $animCss

# 3. Add SEO tags to head
$seoTags = @"
    <meta name="description" content="أرجوزتان للعلامة الدكتور عبد الهادي حميتو: حمار الشعراء.">
    <meta name="keywords" content="حمار الشعراء, عبد الهادي حميتو, شعر عربي, أرجوزة">
    <meta name="author" content="د. عبد الهادي حميتو">
    <meta property="og:type" content="website">
    <meta property="og:title" content="حمار الشعراء - د. عبد الهادي حميتو">
    <meta property="og:description" content="أرجوزتان للعلامة الدكتور عبد الهادي حميتو في الشعر واللغة.">
    <meta property="og:url" content="https://kmbenjel.github.io/hmittou/">
    <meta property="twitter:card" content="summary">
    <title>
"@
$content = $content -replace "<title>", $seoTags

# 4. Add progress bar HTML right after <body>
$content = $content -replace "<body>", "<body>`n    <div id=`"progressBarContainer`"><div id=`"progressBar`"></div></div>"

# 5. Change A to أ
$content = $content -replace ">A\+</button>", ">أ+</button>"
$content = $content -replace ">A-</button>", ">أ-</button>"

# 6. Add JS for progress bar and intersection observer
$js = @"
        // Progress Bar
        window.addEventListener('scroll', () => {
            let winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            let height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            let scrolled = (winScroll / height) * 100;
            document.getElementById('progressBar').style.width = scrolled + '%';
        });

        // Intersection Observer for fade-in verses
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.bayt').forEach((bayt) => {
            observer.observe(bayt);
        });
"@
$content = $content -replace "</script>`r`n</body>", "$js`n    </script>`n</body>"

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Updated index.html safely!"
