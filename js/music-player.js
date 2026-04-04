(function() {
    // 检查是否被禁用
    if (window.__musicPlayerDisabled) {
        var player = document.getElementById('musicPlayer');
        if (player) player.style.display = 'none';
        return;
    }

    var player = document.getElementById('musicPlayer');
    var audio = document.getElementById('musicAudio');
    var coverImg = document.getElementById('musicCover');
    var coverPlaceholder = document.getElementById('musicCoverPlaceholder');
    var titleEl = document.getElementById('musicTitle');
    var artistEl = document.getElementById('musicArtist');
    var playBtn = document.getElementById('musicPlay');
    var prevBtn = document.getElementById('musicPrev');
    var nextBtn = document.getElementById('musicNext');
    var iconPlay = playBtn.querySelector('.icon-play');
    var iconPause = playBtn.querySelector('.icon-pause');

    var isPlaying = false;
    var currentSong = null;
    var isLoading = false;

    // 加载随机歌曲
    function loadRandomSong() {
        if (isLoading) {
            return Promise.resolve(null);
        }
        isLoading = true;

        titleEl.textContent = '加载中...';
        artistEl.textContent = '随机音乐';

        return fetch('https://www.cunyuapi.top/rwyymusic')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                currentSong = data || {};

                // 更新封面
                if (data && data.pic_url) {
                    coverImg.src = data.pic_url;
                    coverImg.onload = function() {
                        coverImg.classList.add('loaded');
                        coverPlaceholder.style.display = 'none';
                    };
                    coverImg.onerror = function() {
                        coverImg.classList.remove('loaded');
                        coverPlaceholder.style.display = 'flex';
                    };
                } else {
                    coverImg.classList.remove('loaded');
                    coverPlaceholder.style.display = 'flex';
                }

                // 更新信息
                titleEl.textContent = (data && data.name) || '未知歌曲';
                artistEl.textContent = (data && (data.artists || data.artist)) || '未知歌手';

                // 设置音频源
                if (data && data.song_url) {
                    audio.src = data.song_url;
                } else {
                    audio.removeAttribute('src');
                }

                isLoading = false;
            })
            .catch(function(err) {
                console.error('加载音乐失败:', err);
                titleEl.textContent = '音乐接口不可用';
                artistEl.textContent = '请检查网络或稍后重试';
                isLoading = false;
                playBtn.disabled = true;
                prevBtn.disabled = true;
                nextBtn.disabled = true;
            });
    }

    // 播放/暂停
    function togglePlay() {
        if (!audio.src && currentSong && currentSong.song_url) {
            audio.src = currentSong.song_url;
        }

        if (!audio.src) {
            loadRandomSong();
            return;
        }

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(function(e) {
                console.error('播放失败:', e);
            });
        }
    }

    // 更新播放状态 UI
    function updatePlayState(playing) {
        isPlaying = playing;
        if (playing) {
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
            player.classList.add('playing');
        } else {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
            player.classList.remove('playing');
        }
    }

    // 事件绑定
    playBtn.addEventListener('click', togglePlay);

    prevBtn.addEventListener('click', function() {
        loadRandomSong();
    });

    nextBtn.addEventListener('click', function() {
        if (isPlaying) {
            audio.pause();
            audio.currentTime = 0;
        }
        loadRandomSong().then(function() {
            if (isPlaying || audio.src) {
                audio.play().catch(function() {});
            }
        });
    });

    audio.addEventListener('play', function() {
        updatePlayState(true);
    });

    audio.addEventListener('pause', function() {
        updatePlayState(false);
    });

    audio.addEventListener('ended', function() {
        loadRandomSong().then(function() {
            if (audio.src) {
                audio.play().catch(function() {});
            }
        });
    });

    // 点击封面也可以播放
    player.addEventListener('click', function(e) {
        if (e.target === coverImg || e.target === coverPlaceholder) {
            togglePlay();
        }
    });

    // 页面加载完成后预加载一首歌曲
    loadRandomSong();
})();
