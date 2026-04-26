document.addEventListener('DOMContentLoaded', () => {
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

        const hour = now.getHours();
        const html = document.documentElement;
        if (hour >= 7 && hour < 19) {
            html.classList.add("light");
        } else {
            html.classList.remove("light");
        }
    }

    updateClock();
    setInterval(updateClock, 1000);

    // Music Player Logic
    const audio = document.getElementById('bgMusic');
    const musicModal = document.getElementById('music-modal');

    if (audio) {
        audio.volume = 0.3;

        const playMusic = () => {
            audio.play().catch(err => {
                console.log('Playback prevented:', err);
                const resumePlay = () => {
                    audio.play();
                    document.removeEventListener('click', resumePlay);
                    document.removeEventListener('touchstart', resumePlay);
                };
                document.addEventListener('click', resumePlay);
                document.addEventListener('touchstart', resumePlay);
            });
        };

        const autoPlayPref = localStorage.getItem('musicAutoPlay');

        if (autoPlayPref === 'true') {
            playMusic();
            if (typeof WeixinJSBridge !== 'undefined') {
                WeixinJSBridge.invoke('getNetworkType', {}, playMusic);
            } else {
                document.addEventListener("WeixinJSBridgeReady", playMusic);
            }
        } else if (autoPlayPref === 'false') {
        } else {
            if (musicModal) {
                setTimeout(() => {
                    musicModal.classList.add('active');
                }, 800);
            }
        }

        window.handleMusicChoice = (shouldPlay) => {
            const remember = document.getElementById('music-remember').checked;
            if (shouldPlay) {
                playMusic();
                if (remember) { localStorage.setItem('musicAutoPlay', 'true'); }
            } else {
                if (remember) { localStorage.setItem('musicAutoPlay', 'false'); }
            }
            if (musicModal) { musicModal.classList.remove('active'); }
        };
    }
});

// Modal & Copy Logic
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
    if (modal) { modal.classList.remove('active'); }
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
        });
    }
};

document.addEventListener('click', (e) => {
    const modal = document.getElementById('contact-modal');
    const modalBox = document.querySelector('.modal-box');
    if (modal && modal.classList.contains('active') && !modalBox.contains(e.target) && !e.target.closest('.social-btn')) {
        closeModal();
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW failed', err));
    });
}
