if (window.trustedTypes && window.trustedTypes.createPolicy) {
    if (!window.trustedTypes.defaultPolicy) {
        window.trustedTypes.createPolicy('default', {
            createHTML: (string) => string,
            createScriptURL: (string) => string,
            createScript: (string) => string,
        });
    }
}

const printLayout = new URLSearchParams(window.location.search).get('print');
if (printLayout === 'mobile') {
    const style = document.createElement('style');
    style.textContent = `@page { size: 120mm 210mm portrait; margin: 12mm 8mm 13mm 8mm }`;
    document.head.appendChild(style);
} else if (printLayout === 'desktop') {
    const style = document.createElement('style');
    style.textContent = `@page { size: A4 portrait; margin: 16mm 15mm 18mm 15mm }`;
    document.head.appendChild(style);
}

if (printLayout) {
    const addPrintClass = () => {
        if (document.body) {
            document.body.classList.add('print-' + printLayout);
        } else {
            setTimeout(addPrintClass, 0);
        }
    };
    addPrintClass();
}
