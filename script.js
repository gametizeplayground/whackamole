document.addEventListener('DOMContentLoaded', () => {
    const moles = document.querySelectorAll('.mole');
    const holes = document.querySelectorAll('.hole');
    const scoreElement = document.getElementById('score');
    const timerElement = document.getElementById('timer');
    const hammer = document.getElementById('hammer');
    const gameBoard = document.querySelector('.game-board');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    let score = 0;
    let timer = 30;
    let timerInterval = null;
    let gameActive = false;
    let gameStarted = false;
    let hammerTimeout = null;
    let gameStartTime = 0;
    
    // Multiple active moles system
    let activeMoles = new Map(); // Map of mole index to mole data
    let spawnInterval = null;
    let maxActiveMoles = 1;
    let baseSpawnRate = 2000; // Base time between spawns in ms
    let currentSpawnRate = 2000;

    // Fruit and non-fruit items
    const fruits = ['Apple', 'Banana', 'Orange', 'Grape', 'Mango', 'Peach', 'Cherry', 'Lemon', 'Kiwi', 'Pear'];
    const nonFruits = ['Car', 'Book', 'Chair', 'Phone', 'Rock', 'Ball', 'Cup', 'Hat', 'Key', 'Pen'];

    // Mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    // Sound effects - Improved desktop/mobile handling
    class ThrottledAudioPool {
        constructor(src, poolSize = 3) {
            this.pool = [];
            this.currentIndex = 0;
            this.poolSize = poolSize;
            this.lastPlayTime = 0;
            // Different settings for desktop vs mobile
            this.minInterval = isMobile ? 100 : 50; // Less aggressive throttling on desktop
            this.playingCount = 0;
            this.maxSimultaneous = isMobile ? Math.min(poolSize, 4) : Math.min(poolSize, 8);
            
            // Create audio pool
            for (let i = 0; i < poolSize; i++) {
                const audio = new Audio(src);
                audio.preload = 'auto';
                audio.volume = 0.8; // Higher volume for better desktop experience
                
                // Track when audio finishes
                audio.addEventListener('ended', () => {
                    this.playingCount = Math.max(0, this.playingCount - 1);
                });
                
                // Add error handling
                audio.addEventListener('error', (e) => {
                    console.log('Audio error:', e);
                });
                
                this.pool.push(audio);
            }
        }
        
        play() {
            const now = Date.now();
            
            // Less aggressive throttling for desktop
            if (now - this.lastPlayTime < this.minInterval) {
                return;
            }
            
            // Limit simultaneous sounds
            if (this.playingCount >= this.maxSimultaneous) {
                return;
            }
            
            try {
                const audio = this.pool[this.currentIndex];
                
                // Stop current audio if playing to avoid overlap (only on mobile)
                if (isMobile && !audio.paused) {
                    audio.pause();
                    this.playingCount = Math.max(0, this.playingCount - 1);
                }
                
                audio.currentTime = 0;
                
                // Play with promise handling
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        this.playingCount++;
                    }).catch((error) => {
                        console.log('Audio play failed:', error);
                    });
                } else {
                    this.playingCount++;
                }
                
                this.lastPlayTime = now;
                this.currentIndex = (this.currentIndex + 1) % this.poolSize;
                
            } catch (error) {
                console.log('Audio error:', error);
            }
        }
    }

    // Create audio pools - more instances for desktop
    const soundHitPool = new ThrottledAudioPool('assets/sound_hit1.ogg', isMobile ? 8 : 16);
    const soundScorePool = new ThrottledAudioPool('assets/sound_score.ogg', 3);
    const soundWrongPool = new ThrottledAudioPool('assets/sound_wrong.mp3', 3);

    // Audio enabling - improved for desktop
    let audioEnabled = false;
    function enableAudio() {
        if (!audioEnabled) {
            // For desktop, try to initialize audio more aggressively
            const testAudio = soundHitPool.pool[0];
            const originalVolume = testAudio.volume;
            
            // Try to play a very quiet sound to unlock audio context
            testAudio.volume = 0.01;
            const playPromise = testAudio.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    testAudio.pause();
                    testAudio.currentTime = 0;
                    testAudio.volume = originalVolume;
                    audioEnabled = true;
                    console.log('Audio enabled successfully');
                }).catch((error) => {
                    console.log('Audio unlock failed:', error);
                    testAudio.volume = originalVolume;
                });
            } else {
                testAudio.volume = originalVolume;
                audioEnabled = true;
            }
        }
    }

    // Sound functions with better desktop support
    function playSoundHit() {
        if (!audioEnabled) {
            enableAudio(); // Try to enable audio if not already enabled
        }
        console.log('Playing hit sound, audioEnabled:', audioEnabled);
        soundHitPool.play();
    }

    function playSoundScore() {
        if (!audioEnabled) {
            enableAudio();
        }
        // Play on both mobile and desktop, but with different volume
        if (isMobile) {
            // Lower volume on mobile
            soundScorePool.pool.forEach(audio => audio.volume = 0.4);
        }
        soundScorePool.play();
    }

    function playSoundWrong() {
        if (!audioEnabled) {
            enableAudio();
        }
        // Play on both mobile and desktop
        if (isMobile) {
            // Lower volume on mobile
            soundWrongPool.pool.forEach(audio => audio.volume = 0.4);
        }
        soundWrongPool.play();
    }

    // Calculate difficulty progression
    function updateDifficulty() {
        const elapsedTime = Date.now() - gameStartTime;
        const seconds = elapsedTime / 1000;
        
        // Increase max moles every 5 seconds (max 4 moles)
        maxActiveMoles = Math.min(4, Math.floor(seconds / 5) + 1);
        
        // Decrease spawn rate over time (faster spawning)
        const speedMultiplier = Math.max(0.3, 1 - (seconds / 60)); // Gets 70% faster over 60 seconds
        currentSpawnRate = baseSpawnRate * speedMultiplier;
    }

    // Start the game
    function startGame() {
        console.log('Game started!');
        score = 0;
        timer = 30;
        gameActive = true;
        gameStarted = true;
        gameStartTime = Date.now();
        maxActiveMoles = 1;
        currentSpawnRate = baseSpawnRate;
        activeMoles.clear();
        
        scoreElement.textContent = 'SCORE 0';
        timerElement.textContent = '30s';
        hammer.style.display = 'none';
        moles.forEach(mole => mole.classList.remove('show'));
        
        startTimer();
        startSpawning();
    }

    // Assign sloth image to each mole with label container
    moles.forEach((mole, i) => {
        mole.className = 'mole';
        mole.innerHTML = `
            <img src="assets/sloth gets ready.png" class="mole-img" alt="Sloth Gets Ready" draggable="false">
            <div class="mole-label"></div>
        `;
    });

    function getRandomItem() {
        const isFruit = Math.random() < 0.7; // 70% chance for fruit
        const items = isFruit ? fruits : nonFruits;
        const item = items[Math.floor(Math.random() * items.length)];
        return { isFruit, label: item };
    }

    function getAvailableHoles() {
        const available = [];
        for (let i = 0; i < moles.length; i++) {
            if (!activeMoles.has(i)) {
                available.push(i);
            }
        }
        return available;
    }

    function spawnMole() {
        if (!gameActive) return;
        
        updateDifficulty();
        
        // Only spawn if we haven't reached max active moles and have available holes
        const availableHoles = getAvailableHoles();
        if (activeMoles.size >= maxActiveMoles || availableHoles.length === 0) {
            return;
        }
        
        const idx = availableHoles[Math.floor(Math.random() * availableHoles.length)];
        const itemData = getRandomItem();
        
        const moleData = {
            index: idx,
            isFruit: itemData.isFruit,
            label: itemData.label,
            timeout: null
        };
        
        // Set the label
        const labelElement = moles[idx].querySelector('.mole-label');
        labelElement.textContent = itemData.label;
        labelElement.className = `mole-label ${itemData.isFruit ? 'fruit' : 'non-fruit'}`;
        
        // Show the mole
        moles[idx].classList.add('show');
        activeMoles.set(idx, moleData);
        
        // Set timeout for this mole to disappear
        const upTime = 1500 + Math.random() * 1500; // 1.5-3 seconds
        moleData.timeout = setTimeout(() => {
            if (activeMoles.has(idx)) {
                moles[idx].classList.remove('show');
                activeMoles.delete(idx);
            }
        }, upTime);
    }

    function startSpawning() {
        if (spawnInterval) clearInterval(spawnInterval);
        
        // Spawn first mole immediately
        spawnMole();
        
        spawnInterval = setInterval(() => {
            if (gameActive) {
                spawnMole();
                // Update spawn rate dynamically
                clearInterval(spawnInterval);
                startSpawning();
            }
        }, currentSpawnRate);
    }

    holes.forEach((hole, idx) => {
        hole.addEventListener('click', (e) => {
            if (!gameActive) return;
            if (activeMoles.has(idx) && moles[idx].classList.contains('show')) {
                const moleData = activeMoles.get(idx);
                
                // Clear the timeout and remove from active moles
                clearTimeout(moleData.timeout);
                activeMoles.delete(idx);
                
                const img = moles[idx].querySelector('.mole-img');
                
                if (moleData.isFruit) {
                    // Correct hit - fruit
                    if (img) img.src = 'assets/sloth got whacked.png';
                    showPointPopup(moles[idx], '+10', 'correct');
                    score += 10;
                    playSoundScore();
                    
                    // Hide mole after showing dead animation
                    setTimeout(() => { 
                        if (img) img.src = 'assets/sloth gets ready.png'; 
                        moles[idx].classList.remove('show');
                    }, 500);
                } else {
                    // Wrong hit - non-fruit
                    if (img) img.src = 'assets/sloth got whacked.png';
                    showPointPopup(moles[idx], '-3', 'wrong');
                    score -= 3;
                    if (score < 0) score = 0; // Don't go below 0
                    playSoundWrong();
                    
                    // Hide mole after showing wrong feedback
                    setTimeout(() => { 
                        if (img) img.src = 'assets/sloth gets ready.png';
                        moles[idx].classList.remove('show');
                    }, 500);
                }
                
                scoreElement.textContent = `SCORE ${score}`;
            }
        });
    });

    function showPointPopup(moleElem, text, type) {
        const popup = document.createElement('span');
        popup.className = `point-popup ${type}`;
        popup.textContent = text;
        const moleRect = moleElem.getBoundingClientRect();
        const boardRect = gameBoard.getBoundingClientRect();
        const left = moleRect.left - boardRect.left + moleRect.width / 2;
        const top = moleRect.top - boardRect.top;
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
        popup.style.position = 'absolute';
        gameBoard.appendChild(popup);
        setTimeout(() => { popup.remove(); }, 700);
    }

    gameBoard.addEventListener('click', (e) => {
        if (!gameActive) return;
        
        // Enable audio on first interaction and ensure hit sound plays
        if (!audioEnabled) {
            enableAudio();
        }
        
        clearTimeout(hammerTimeout);
        
        // Get position relative to game board
        const boardRect = gameBoard.getBoundingClientRect();
        const left = e.clientX - boardRect.left;
        const top = e.clientY - boardRect.top;
        
        hammer.style.left = left + 'px';
        hammer.style.top = top + 'px';
        hammer.style.display = 'block';
        hammer.classList.add('click');
        
        // Play hit sound with improved reliability
        playSoundHit();
        
        hammerTimeout = setTimeout(() => {
            hammer.classList.remove('click');
            hammer.style.display = 'none';
        }, 350);
    });

    function startTimer() {
        timerElement.textContent = timer + 's';
        timerInterval = setInterval(() => {
            timer--;
            timerElement.textContent = timer + 's';
            if (timer <= 0) {
                endGame();
            }
        }, 1000);
    }

    let highScore = parseInt(localStorage.getItem('whack_high_score') || '0', 10);
    const highScoreElement = document.getElementById('high-score');
    function updateHighScoreDisplay() {
        highScoreElement.textContent = `HIGH SCORE ${highScore}`;
    }
    updateHighScoreDisplay();

    function endGame() {
        gameActive = false;
        clearInterval(timerInterval);
        clearInterval(spawnInterval);
        
        // Clear all active moles
        activeMoles.forEach((moleData, idx) => {
            clearTimeout(moleData.timeout);
            moles[idx].classList.remove('show');
        });
        activeMoles.clear();
        
        hammer.style.display = 'none';
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('whack_high_score', highScore);
            updateHighScoreDisplay();
        }
        if (restartBtn) restartBtn.style.display = 'inline-block';
    }

    // Ensure the Start Game button is visible and clickable
    if (startBtn) {
        startBtn.style.display = 'inline-block';
        startBtn.style.pointerEvents = 'auto';
        startBtn.style.zIndex = '100';
        startBtn.addEventListener('click', () => {
            console.log('Start Game button clicked');
            
            // Enable audio immediately when starting game
            enableAudio();
            
            // Small delay to ensure audio context is ready
            setTimeout(() => {
                if (startBtn) startBtn.style.display = 'none';
                if (restartBtn) restartBtn.style.display = 'none';
                if (hammer) hammer.style.display = 'none';
                startGame();
            }, 100);
        });
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            // Enable audio on interaction
            enableAudio();
            
            // Small delay to ensure audio context is ready
            setTimeout(() => {
                if (restartBtn) restartBtn.style.display = 'none';
                if (startBtn) startBtn.style.display = 'none';
                if (hammer) hammer.style.display = 'none';
                startGame();
            }, 100);
        });
    }

    if (hammer) hammer.style.display = 'none';
    if (startBtn) startBtn.style.display = 'inline-block';
    if (restartBtn) restartBtn.style.display = 'none';
});

// Add some fun keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        const startBtn = document.getElementById('start-btn');
        if (startBtn && startBtn.style.display !== 'none') {
            startBtn.click();
        }
    }
    
    if (e.code === 'KeyR') {
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn && restartBtn.style.display !== 'none') {
            restartBtn.click();
        }
    }
}); 