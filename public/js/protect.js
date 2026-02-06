// ============================================
// System Protection Script (Nuclear Option)
// ============================================

(function () {
    'use strict';

    let devtoolsOpen = false;
    const threshold = 160;

    // 1. NUKE FUNCTION: Wipes the entire page
    function nuke(reason) {
        if (devtoolsOpen) return; // Already nuked
        devtoolsOpen = true;

        try {
            document.documentElement.innerHTML = `
                <div style="
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: #000; color: #ef4444; z-index: 999999;
                    display: flex; flex-direction: column; justify-content: center; align-items: center;
                    font-family: monospace; text-align: center;
                ">
                    <h1 style="font-size: 50px;">🚫 SECURITY ALERT</h1>
                    <p style="font-size: 24px;">Hệ thống phát hiện can thiệp!</p>
                    <p style="color: #666;">Reason: ${reason}</p>
                    <button onclick="location.reload()" style="
                        background: #6366f1; color: white; border: none; padding: 12px 24px;
                        font-size: 16px; font-weight: 600; border-radius: 8px; margin-top: 24px;
                        cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.4);
                    " onmouseover="this.style.background='#4f46e5'" onmouseout="this.style.background='#6366f1'">
                        ↻ Tải lại trang
                    </button>
                </div>
            `;
            // Stop all JS
            window.stop();
            throw new Error('Security Violation');
        } catch (e) { }
    }

    // 2. Disable Input
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
            (e.ctrlKey && ['U', 'S'].includes(e.key.toUpperCase()))) {
            e.preventDefault();
            return false;
        }
    });

    // 3. DevTools Detection Strategies

    // Strategy A: Window Size (Docked DevTools)
    function checkWindowSize() {
        // Skip for mobile devices (they have dynamic viewports)
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            return;
        }

        if (window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) {
            nuke('Firebug Detected');
        }
        if (window.outerWidth - window.innerWidth > threshold ||
            window.outerHeight - window.innerHeight > threshold) {
            nuke('Docked DevTools Detected');
        }
    }

    // Strategy B: Console Object Getter (Console Open)
    const bait = new Image();
    Object.defineProperty(bait, 'id', {
        get: function () {
            nuke('Console Inspection Detected');
        }
    });

    // Strategy C: Debugger Loop (Execution Pause)
    let start = Date.now();

    function securityLoop() {
        if (devtoolsOpen) return;

        // 1. Check Window
        checkWindowSize();

        // 2. Check Console Bait
        // Chrome/Edge/Firefox trigger getter when logging element
        console.log(bait);
        console.clear();

        // 3. Debugger Timing Check
        const t0 = Date.now();
        debugger; // Will pause if DevTools is open and breakpoints active
        const t1 = Date.now();

        if (t1 - t0 > 100) {
            nuke('Debugger Pause Detected');
        }

        // 4. Interval Timing Check
        // If the implementation of setInterval/requestAnimationFrame lags significantly
        if (Date.now() - start > 1000) { // Should be ~200ms
            // nuke('Execution Lag (Debugger?)'); 
            // Commented out to prevent false positives on slow PCs, enabled if needed
        }
        start = Date.now();

        // Recursion
        setTimeout(securityLoop, 200);
    }

    // Initialize
    window.addEventListener('load', () => {
        checkWindowSize();
        // Prevent Drag/Drop
        document.body.addEventListener('dragstart', e => e.preventDefault());
        document.body.addEventListener('drop', e => e.preventDefault());

        // Start Loop
        securityLoop();
    });

    // Immediate check
    checkWindowSize();

})();
