document.addEventListener('DOMContentLoaded', () => {
    // Clock Functionality
    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        const clockElement = document.getElementById('clock');
        if (clockElement) {
            clockElement.textContent = timeString;
        }

        // Auto theme based on time (7:00 - 18:59 is light mode)
        const hour = now.getHours();
        const html = document.documentElement;
        if (hour >= 7 && hour < 19) {
            html.classList.add("light");
        } else {
            html.classList.remove("light");
        }
    }
    
    // Update immediately and then every second
    updateClock();
    setInterval(updateClock, 1000);

    // Music Player Logic
    const audio = document.getElementById('bgMusic');
    const musicModal = document.getElementById('music-modal');

    if (audio) {
        audio.volume = 0.3; // Set default volume

        const playMusic = () => {
            audio.play().catch(err => {
                console.log('Playback prevented:', err);
                // Fallback: wait for interaction if direct play fails
                const resumePlay = () => {
                    audio.play();
                    document.removeEventListener('click', resumePlay);
                    document.removeEventListener('touchstart', resumePlay);
                };
                document.addEventListener('click', resumePlay);
                document.addEventListener('touchstart', resumePlay);
            });
        };

        // Check LocalStorage for preference
        const autoPlayPref = localStorage.getItem('musicAutoPlay');

        if (autoPlayPref === 'true') {
            // User previously said YES + Remember
            playMusic();
            
            // WeChat compatibility for auto-play
            if (typeof WeixinJSBridge !== 'undefined') {
                WeixinJSBridge.invoke('getNetworkType', {}, playMusic);
            } else {
                document.addEventListener("WeixinJSBridgeReady", playMusic);
            }
        } else if (autoPlayPref === 'false') {
            // User previously said NO + Remember -> Do nothing
        } else {
            // No preference -> Show Modal
            if (musicModal) {
                // Small delay for smooth entrance
                setTimeout(() => {
                    musicModal.classList.add('active');
                }, 800);
            }
        }

        // Global handler for the music modal
        window.handleMusicChoice = (shouldPlay) => {
            const remember = document.getElementById('music-remember').checked;

            if (shouldPlay) {
                playMusic();
                if (remember) {
                    localStorage.setItem('musicAutoPlay', 'true');
                }
            } else {
                if (remember) {
                    localStorage.setItem('musicAutoPlay', 'false');
                }
            }

            // Close modal
            if (musicModal) {
                musicModal.classList.remove('active');
            }
        };
    }
});

// Modal Logic
window.openModal = function(title, data, iconClass) {
    const modal = document.getElementById('contact-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalData = document.getElementById('modal-data');
    const modalIcon = document.getElementById('modal-icon');
    
    if (modal && modalTitle && modalData && modalIcon) {
        modalTitle.textContent = title;
        modalData.textContent = data;
        modalIcon.className = iconClass;
        modal.classList.add('active');
    }
};

window.closeModal = function() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
        modal.classList.remove('active');
    }
};

window.copyData = function() {
    const dataBox = document.getElementById('modal-data');
    if (dataBox) {
        navigator.clipboard.writeText(dataBox.textContent).then(() => {
            const toast = document.getElementById('copy-toast');
            if (toast) {
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 2000);
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            const range = document.createRange();
            range.selectNode(dataBox);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            window.getSelection().removeAllRanges();
            
            const toast = document.getElementById('copy-toast');
            if (toast) {
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 2000);
            }
        });
    }
};

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('contact-modal');
    const modalBox = document.querySelector('.modal-box');
    if (modal && modal.classList.contains('active') && !modalBox.contains(e.target) && !e.target.closest('.social-btn')) {
        closeModal();
    }
});

// Register Service Worker for Caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
