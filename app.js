// ========================================
// VOOF v3 - Sistema Completo de Interações
// Double Tap, Reações, Tempo de Leitura, Compartilhar
// ========================================

const SUPABASE_URL = 'https://lbvtpawkufemglkaepqb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxidnRwYXdrdWZlbWdsa2FlcHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDg2MTksImV4cCI6MjA4NjIyNDYxOX0.knLhtuTd0DekAMFwlC3QjapFjEiXmcuuWG4AstzxoKQ';

if (typeof window.voofSupabase === 'undefined') {
    window.voofSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const supabaseClient = window.voofSupabase;
let currentPosts = [];
let allPosts = [];
let currentCategory = 'all';
let currentArticle = null;
let isSearchMode = false;

// Session ID único para rastrear interações
let userSession = localStorage.getItem('voof_session');
if (!userSession) {
    userSession = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('voof_session', userSession);
}

// Controle de tempo de leitura
let readingStartTime = null;
let currentReadingPostId = null;

// ========================================
// FUNÇÕES DE DETECÇÃO DE MÍDIA
// ========================================

function getMediaType(url) {
    if (!url) return 'image';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('vimeo.com')) return 'vimeo';
    if (url.match(/\.(mp4|webm|ogg|mov)$/i)) return 'video';
    return 'image';
}

function getYouTubeID(url) {
    if (url.includes('/shorts/')) {
        const match = url.match(/\/shorts\/([^?&]+)/);
        return match ? match[1] : null;
    }
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
}

function getVimeoID(url) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
}

// ========================================
// SISTEMA DE INTERAÇÕES
// ========================================

// Registrar visualização
async function trackView(postId) {
    try {
        await supabaseClient.rpc('increment_post_views', { post_uuid: postId });
        console.log('📊 View registrada');
    } catch (error) {
        console.log('Analytics error:', error);
    }
}

// Double Tap - Curtir
async function handleDoubleTap(postId) {
    try {
        const result = await supabaseClient.rpc('increment_post_like', {
            post_uuid: postId,
            user_session_id: userSession
        });
        
        if (result.data) {
            showLikeAnimation(postId);
            console.log('❤️ Like registrado:', result.data.likes_count);
        }
    } catch (error) {
        console.error('Erro ao curtir:', error);
    }
}

// Mostrar animação de coração
function showLikeAnimation(postId) {
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (!card) return;
    
    const heart = document.createElement('div');
    heart.className = 'like-heart-animation';
    heart.innerHTML = '❤️';
    card.appendChild(heart);
    
    setTimeout(() => {
        heart.style.opacity = '0';
        heart.style.transform = 'translateY(-100px) scale(2)';
    }, 10);
    
    setTimeout(() => {
        heart.remove();
    }, 1000);
}

// Adicionar reação
async function addReaction(postId, reactionType) {
    try {
        const result = await supabaseClient.rpc('add_post_reaction', {
            post_uuid: postId,
            reaction: reactionType,
            user_session_id: userSession
        });
        
        if (result.data && result.data.reactions) {
            updateReactionCounts(result.data.reactions);
            showReactionFeedback(reactionType);
        }
    } catch (error) {
        console.error('Erro ao adicionar reação:', error);
    }
}

// Atualizar contadores de reação
function updateReactionCounts(reactions) {
    Object.keys(reactions).forEach(type => {
        const elem = document.querySelector(`[data-reaction="${type}"] .reaction-count`);
        if (elem) {
            elem.textContent = reactions[type] || 0;
        }
    });
}

// Feedback visual de reação
function showReactionFeedback(reactionType) {
    const emojis = {
        like: '👍',
        love: '❤️',
        interesting: '💡',
        wow: '😮',
        sad: '😢',
        angry: '😠'
    };
    
    const feedback = document.createElement('div');
    feedback.className = 'reaction-feedback';
    feedback.textContent = emojis[reactionType];
    document.body.appendChild(feedback);
    
    setTimeout(() => feedback.remove(), 2000);
}

// Compartilhar
async function shareArticle(postId, title, url) {
    try {
        // Registrar compartilhamento
        await supabaseClient.rpc('increment_post_share', {
            post_uuid: postId,
            user_session_id: userSession
        });
        
        // Usar Web Share API se disponível
        if (navigator.share) {
            await navigator.share({
                title: title,
                text: 'Confira esta notícia no VOOF!',
                url: url || window.location.href
            });
        } else {
            // Fallback: copiar link
            const fullUrl = url || window.location.href;
            await navigator.clipboard.writeText(fullUrl);
            alert('Link copiado! 📋');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Erro ao compartilhar:', error);
        }
    }
}

// Iniciar rastreamento de tempo
function startReadingTimer(postId) {
    readingStartTime = Date.now();
    currentReadingPostId = postId;
}

// Parar e salvar tempo de leitura
async function stopReadingTimer() {
    if (!readingStartTime || !currentReadingPostId) return;
    
    const timeSpent = Math.floor((Date.now() - readingStartTime) / 1000);
    
    // Só salvar se leu por pelo menos 3 segundos
    if (timeSpent >= 3) {
        try {
            await supabaseClient.rpc('track_reading_time', {
                post_uuid: currentReadingPostId,
                seconds_read: timeSpent,
                user_session_id: userSession
            });
            console.log(`⏱️ Tempo de leitura: ${timeSpent}s`);
        } catch (error) {
            console.error('Erro ao salvar tempo:', error);
        }
    }
    
    readingStartTime = null;
    currentReadingPostId = null;
}

// ========================================
// TOGGLE MUTE
// ========================================

function toggleMute(event, postId) {
    event.stopPropagation();
    const video = document.querySelector(`video[data-post-id="${postId}"]`);
    const btn = event.target;
    
    if (video) {
        video.muted = !video.muted;
        btn.textContent = video.muted ? '🔇' : '🔊';
    }
}

function toggleYouTubeMute(event, postId) {
    event.stopPropagation();
    const iframe = event.target.previousElementSibling;
    const btn = event.target;
    
    if (iframe && iframe.tagName === 'IFRAME') {
        const currentSrc = iframe.src;
        if (currentSrc.includes('mute=1')) {
            iframe.src = currentSrc.replace('mute=1', 'mute=0');
            btn.textContent = '🔊';
        } else {
            iframe.src = currentSrc.replace('mute=0', 'mute=1');
            btn.textContent = '🔇';
        }
    }
}

window.toggleMute = toggleMute;
window.toggleYouTubeMute = toggleYouTubeMute;
window.addReaction = addReaction;
window.shareArticle = shareArticle;

// ========================================
// CARREGAR POSTS
// ========================================

async function loadPosts(category = 'all') {
    try {
        console.log('🔄 Carregando posts do Supabase...', category);

        let query = supabaseClient
            .from('posts')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (category !== 'all') {
            query = query.or(`categories.cs.{${category}},category.eq.${category}`);
        }

        const { data, error } = await query;

        console.log('📦 Resposta do Supabase:', { data, error, count: data?.length });

        if (error) {
            console.error('❌ Erro ao carregar posts:', error);
            loadDemoContent();
            return;
        }

        if (data && data.length > 0) {
            console.log(`✅ ${data.length} posts carregados com sucesso!`);
            currentPosts = data;
            allPosts = data;
            renderFeed();
        } else {
            console.log('⚠️ Nenhum post aprovado encontrado. Carregando demo.');
            loadDemoContent();
        }
    } catch (error) {
        console.error('❌ Erro crítico ao carregar posts:', error);
        loadDemoContent();
    }
}

// ========================================
// CONTINUAÇÃO DO APP-V3.JS
// Cole este código após a função loadPosts()
// ========================================

// Render feed (COM DOUBLE TAP)
function renderFeed() {
    const feedContainer = document.getElementById('feed-container');
    
    if (currentPosts.length === 0) {
        feedContainer.innerHTML = `
            <div class="story-card" style="display: flex; align-items: center; justify-content: center;">
                <div style="text-align: center; padding: 2rem;">
                    <h2 style="font-size: 2rem; margin-bottom: 1rem;">Nenhuma notícia encontrada</h2>
                    <p style="color: var(--text-secondary);">Selecione outra categoria ou aguarde novas publicações!</p>
                </div>
            </div>
        `;
        return;
    }

    feedContainer.innerHTML = currentPosts.map((post, index) => {
        const isVideo = post.post_type === 'video';
        const categories = post.categories || [post.category];
        const categoryDisplay = categories[0];
        
        let videoHTML = '';
        if (isVideo && post.video_url) {
            if (post.video_url.includes('youtube.com') || post.video_url.includes('youtu.be')) {
                let videoId = getYouTubeID(post.video_url);
                videoHTML = `
                    <iframe 
                        class="story-video" 
                        src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&playsinline=1"
                        frameborder="0"
                        allow="autoplay; encrypted-media"
                        allowfullscreen>
                    </iframe>
                    <button class="mute-btn" onclick="toggleYouTubeMute(event, '${post.id}')">🔇</button>
                `;
            } else if (post.video_url.includes('tiktok.com')) {
                const tiktokMatch = post.video_url.match(/video\/(\d+)/);
                const videoId = tiktokMatch ? tiktokMatch[1] : '';
                videoHTML = `
                    <iframe 
                        class="story-video" 
                        src="https://www.tiktok.com/embed/v2/${videoId}?autoplay=1"
                        frameborder="0"
                        allow="autoplay; encrypted-media"
                        allowfullscreen>
                    </iframe>
                `;
            } else if (post.video_url.includes('vimeo.com')) {
                const videoId = getVimeoID(post.video_url);
                videoHTML = `
                    <iframe 
                        class="story-video" 
                        src="https://player.vimeo.com/video/${videoId}?autoplay=1&muted=1&loop=1&controls=0&playsinline=1"
                        frameborder="0"
                        allow="autoplay; encrypted-media"
                        allowfullscreen>
                    </iframe>
                `;
            } else {
                videoHTML = `
                    <video 
                        class="story-video" 
                        src="${post.video_url}" 
                        playsinline 
                        webkit-playsinline
                        autoplay 
                        muted 
                        loop
                        preload="auto"
                        data-post-id="${post.id}"
                        onloadedmetadata="this.muted=true;this.play();">
                    </video>
                    <button class="mute-btn" onclick="toggleMute(event, '${post.id}')">🔇</button>
                `;
            }
        }
        
        return `
        <div class="story-card" data-post-id="${post.id}" data-index="${index}">
            ${isVideo ? videoHTML : `
                <img src="${post.cover_image || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800'}" 
                     alt="${post.title}" 
                     class="story-image"
                     loading="lazy">
            `}
            <div class="story-overlay"></div>
            <div class="story-content">
                <div class="story-header">
                    <span class="category-badge">${categoryDisplay}</span>
                    ${categories.length > 1 ? `<span class="category-badge" style="opacity: 0.8; font-size: 0.7rem;">+${categories.length - 1}</span>` : ''}
                    <div class="story-meta">
                        <div>${post.author || 'VOOF Team'}</div>
                        <div>${formatDate(post.created_at)}</div>
                    </div>
                </div>
                <div class="story-footer">
                    <h2 class="story-title">${post.title}</h2>
                    <p class="story-description">${post.short_description}</p>
                    <div class="swipe-hint">
                        <span class="swipe-arrow">→</span>
                        <span>Toque ou arraste para ler</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');

    addSwipeListeners();
    
    setTimeout(() => {
        const allVideos = document.querySelectorAll('#feed-container video');
        allVideos.forEach(video => {
            video.muted = true;
            video.play().catch(e => console.log('Video autoplay blocked'));
        });
    }, 100);
}

// Add swipe and click listeners (COM DOUBLE TAP)
function addSwipeListeners() {
    const cards = document.querySelectorAll('.story-card');
    
    cards.forEach(card => {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        let isSwiping = false;
        let lastTapTime = 0;
        const doubleTapDelay = 300; // ms

        card.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
            touchEndX = touchStartX;
            touchEndY = touchStartY;
            isSwiping = false;
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            const moveX = e.changedTouches[0].screenX;
            const moveY = e.changedTouches[0].screenY;
            const diffX = Math.abs(moveX - touchStartX);
            const diffY = Math.abs(moveY - touchStartY);
            
            if (diffX > 10 || diffY > 10) {
                isSwiping = true;
            }
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            
            const diffX = Math.abs(touchEndX - touchStartX);
            const diffY = Math.abs(touchEndY - touchStartY);
            const currentTime = new Date().getTime();
            const tapInterval = currentTime - lastTapTime;
            
            // Double Tap Detection
            if (!isSwiping && diffX < 10 && diffY < 10 && tapInterval < doubleTapDelay && tapInterval > 0) {
                e.preventDefault();
                handleDoubleTap(card.dataset.postId);
                lastTapTime = 0; // Reset
            }
            // Single Tap - Abrir matéria
            else if (!isSwiping && diffX < 10 && diffY < 10) {
                lastTapTime = currentTime;
                setTimeout(() => {
                    if (lastTapTime === currentTime) {
                        openArticle(card.dataset.postId);
                    }
                }, doubleTapDelay);
            }
            // Swipe horizontal
            else if (diffX > 50 && diffX > diffY) {
                e.preventDefault();
                openArticle(card.dataset.postId);
            }
        });

        // Desktop click
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('mute-btn')) return;
            openArticle(card.dataset.postId);
        });
    });
    
    setupVideoObserver();
}

// Observar vídeos no viewport
function setupVideoObserver() {
    const feedContainer = document.getElementById('feed-container');
    if (!feedContainer) return;

    const options = {
        root: feedContainer,
        threshold: 0.5,
        rootMargin: '0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const card = entry.target;
            const video = card.querySelector('video');

            if (entry.isIntersecting) {
                if (video) {
                    video.muted = true;
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(e => {
                            setTimeout(() => {
                                video.play().catch(() => {});
                            }, 100);
                        });
                    }
                }
            } else {
                if (video) {
                    video.pause();
                }
            }
        });
    }, options);

    const cards = document.querySelectorAll('.story-card');
    cards.forEach(card => {
        observer.observe(card);
    });

    const firstCard = document.querySelector('.story-card');
    if (firstCard) {
        const firstVideo = firstCard.querySelector('video');
        if (firstVideo) {
            firstVideo.muted = true;
            firstVideo.play().catch(e => console.log('First video autoplay blocked'));
        }
    }
}

// ========================================
// PARTE 3 DO APP-V3.JS
// Cole após a função setupVideoObserver()
// ========================================

// Open article (COM REAÇÕES E TEMPO)
async function openArticle(postId) {
    try {
        const post = currentPosts.find(p => p.id === postId);
        if (!post) return;

        // Rastrear visualização
        trackView(postId);
        
        // Iniciar timer de leitura
        startReadingTimer(postId);

        currentArticle = post;
        const modal = document.getElementById('article-modal');
        const content = document.getElementById('article-content');

        let galleryHTML = '';
        if (post.post_type === 'video') {
            let videoEmbed = '';
            
            if (post.video_url.includes('youtube.com') || post.video_url.includes('youtu.be')) {
                const videoId = getYouTubeID(post.video_url);
                videoEmbed = `
                    <iframe 
                        class="gallery-video" 
                        src="https://www.youtube.com/embed/${videoId}?rel=0"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        style="width: 100%; height: 60vh;">
                    </iframe>
                `;
            } else if (post.video_url.includes('tiktok.com')) {
                const tiktokMatch = post.video_url.match(/video\/(\d+)/);
                const videoId = tiktokMatch ? tiktokMatch[1] : '';
                videoEmbed = `
                    <iframe 
                        class="gallery-video" 
                        src="https://www.tiktok.com/embed/v2/${videoId}"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        style="width: 100%; height: 60vh;">
                    </iframe>
                `;
            } else if (post.video_url.includes('vimeo.com')) {
                const videoId = getVimeoID(post.video_url);
                videoEmbed = `
                    <iframe 
                        class="gallery-video" 
                        src="https://player.vimeo.com/video/${videoId}"
                        frameborder="0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowfullscreen
                        style="width: 100%; height: 60vh;">
                    </iframe>
                `;
            } else {
                videoEmbed = `
                    <video 
                        class="gallery-video" 
                        src="${post.video_url}" 
                        controls
                        playsinline
                        style="width: 100%; max-height: 60vh;">
                    </video>
                `;
            }
            
            galleryHTML = `<div class="article-gallery">${videoEmbed}</div>`;
        } else if (post.gallery_images && post.gallery_images.length > 0) {
            galleryHTML = `
                <div class="article-gallery">
                    ${post.gallery_images.map(img => `
                        <img src="${img}" alt="Gallery image" class="gallery-image" loading="lazy">
                    `).join('')}
                </div>
            `;
        } else {
            galleryHTML = `
                <div class="article-gallery">
                    <img src="${post.cover_image}" alt="${post.title}" class="gallery-image" loading="lazy">
                </div>
            `;
        }

        const categories = post.categories || [post.category];

        content.innerHTML = `
            ${galleryHTML}
            <div class="article-body">
                <h1 class="article-title">${post.title}</h1>
                <div class="article-info">
                    <span class="info-item"><strong>Categorias:</strong> ${categories.join(', ')}</span>
                    <span class="info-item"><strong>Autor:</strong> ${post.author || 'VOOF Team'}</span>
                    <span class="info-item"><strong>Data:</strong> ${formatDate(post.created_at)}</span>
                </div>
                <div class="article-text">
                    ${formatArticleText(post.full_text)}
                </div>
                
                <!-- BARRA DE REAÇÕES -->
                <div class="reactions-bar">
                    <div class="reactions-title">Como você se sentiu?</div>
                    <div class="reactions-buttons">
                        <button class="reaction-btn" data-reaction="like" onclick="addReaction('${post.id}', 'like')">
                            <span class="reaction-emoji">👍</span>
                            <span class="reaction-label">Curtir</span>
                            <span class="reaction-count">${post.reaction_like || 0}</span>
                        </button>
                        <button class="reaction-btn" data-reaction="love" onclick="addReaction('${post.id}', 'love')">
                            <span class="reaction-emoji">❤️</span>
                            <span class="reaction-label">Amei</span>
                            <span class="reaction-count">${post.reaction_love || 0}</span>
                        </button>
                        <button class="reaction-btn" data-reaction="interesting" onclick="addReaction('${post.id}', 'interesting')">
                            <span class="reaction-emoji">💡</span>
                            <span class="reaction-label">Interessante</span>
                            <span class="reaction-count">${post.reaction_interesting || 0}</span>
                        </button>
                        <button class="reaction-btn" data-reaction="wow" onclick="addReaction('${post.id}', 'wow')">
                            <span class="reaction-emoji">😮</span>
                            <span class="reaction-label">Uau</span>
                            <span class="reaction-count">${post.reaction_wow || 0}</span>
                        </button>
                        <button class="reaction-btn" data-reaction="sad" onclick="addReaction('${post.id}', 'sad')">
                            <span class="reaction-emoji">😢</span>
                            <span class="reaction-label">Triste</span>
                            <span class="reaction-count">${post.reaction_sad || 0}</span>
                        </button>
                        <button class="reaction-btn" data-reaction="angry" onclick="addReaction('${post.id}', 'angry')">
                            <span class="reaction-emoji">😠</span>
                            <span class="reaction-label">Raiva</span>
                            <span class="reaction-count">${post.reaction_angry || 0}</span>
                        </button>
                    </div>
                </div>
                
                <!-- COPYRIGHT -->
                <div class="article-copyright">
                    <p>© 2026 VOOF. Todos os direitos reservados.</p>
                    <p>Este conteúdo não pode ser reproduzido sem autorização.</p>
                </div>
            </div>
        `;

        modal.classList.add('active');
        
        const closeBtnContainer = document.querySelector('.close-btn-container');
        if (closeBtnContainer) {
            closeBtnContainer.style.display = 'block';
        }

        // Swipe lateral para fechar
        let touchStartX = 0;
        const swipeClose = (e) => {
            if (e.type === 'touchstart') {
                touchStartX = e.changedTouches[0].screenX;
            } else if (e.type === 'touchend') {
                const diff = e.changedTouches[0].screenX - touchStartX;
                if (Math.abs(diff) > 100) closeArticle();
            }
        };
        modal.addEventListener('touchstart', swipeClose);
        modal.addEventListener('touchend', swipeClose);

    } catch (error) {
        console.error('Error opening article:', error);
    }
}

// Close article (COM STOP TIMER)
function closeArticle() {
    const modal = document.getElementById('article-modal');
    
    // Parar timer de leitura
    stopReadingTimer();
    
    // Parar todos os vídeos
    const videos = modal.querySelectorAll('video');
    const iframes = modal.querySelectorAll('iframe');
    
    videos.forEach(video => {
        video.pause();
        video.currentTime = 0;
        video.muted = true;
    });
    
    iframes.forEach(iframe => {
        const src = iframe.src;
        iframe.src = '';
        setTimeout(() => iframe.src = src, 100);
    });
    
    modal.classList.remove('active');
    currentArticle = null;
    
    const closeBtnContainer = document.querySelector('.close-btn-container');
    if (closeBtnContainer) {
        closeBtnContainer.style.display = 'none';
    }
    
    // Reativar vídeos do feed
    setTimeout(() => {
        const feedVideos = document.querySelectorAll('#feed-container video');
        feedVideos.forEach(video => {
            const rect = video.getBoundingClientRect();
            const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
            if (isVisible) {
                video.muted = true;
                video.play().catch(e => console.log('Autoplay prevented'));
            }
        });
    }, 500);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('pt-BR', options);
}

// Format article text
function formatArticleText(text) {
    if (!text) return '';
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    return paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
}

// Load demo content
function loadDemoContent() {
    console.log('📦 Carregando conteúdo demo...');
    currentPosts = [
        {
            id: 'demo-1',
            title: 'Bem-vindo ao VOOF v3!',
            short_description: 'Agora com interações! Dê double tap para curtir e reaja às matérias.',
            full_text: 'O VOOF está na v3 com sistema completo de interações!\n\nNovidades:\n- Double tap para curtir\n- 6 tipos de reações\n- Sistema de compartilhamento\n- Analytics avançado\n\nCrie posts no admin.html e teste todas as funcionalidades!',
            category: 'tecnologia',
            categories: ['tecnologia', 'ia'],
            post_type: 'text',
            cover_image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
            gallery_images: ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=800'],
            author: 'VOOF Team',
            created_at: new Date().toISOString(),
            view_count: 0,
            likes_count: 0,
            reaction_like: 0,
            reaction_love: 0,
            reaction_interesting: 0,
            reaction_wow: 0,
            reaction_sad: 0,
            reaction_angry: 0
        }
    ];
    
    allPosts = currentPosts;
    renderFeed();
}

// ========================================
// PARTE 4 (FINAL) DO APP-V3.JS
// Cole após loadDemoContent()
// ========================================

// Category filter
function filterByCategory(category) {
    currentCategory = category;
    isSearchMode = false;
    
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    if (searchInput) searchInput.style.display = 'none';
    if (categorySelect) categorySelect.style.display = 'block';
    
    loadPosts(category);
}

// Search function
function searchPosts(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        filterByCategory('all');
        return;
    }

    isSearchMode = true;
    const term = searchTerm.toLowerCase().trim();
    
    currentPosts = allPosts.filter(post => {
        const categories = post.categories || [post.category];
        return (
            post.title.toLowerCase().includes(term) ||
            post.short_description.toLowerCase().includes(term) ||
            post.full_text.toLowerCase().includes(term) ||
            categories.some(cat => cat.toLowerCase().includes(term)) ||
            (post.author && post.author.toLowerCase().includes(term))
        );
    });

    console.log(`🔍 Busca por "${searchTerm}": ${currentPosts.length} resultados`);
    renderFeed();
}

// Toggle search input
function toggleSearchInput() {
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    
    if (searchInput && categorySelect) {
        searchInput.style.display = 'block';
        categorySelect.style.display = 'none';
        searchInput.focus();
    }
}

// Initialize app
async function init() {
    console.log('🚀 Inicializando VOOF v3...');
    
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 1500);

    await loadPosts();

    const categorySelect = document.getElementById('category-select');
    const categorySelectDesktop = document.getElementById('category-select-desktop');
    const searchInput = document.getElementById('search-input');
    
    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            if (e.target.value === 'search') {
                toggleSearchInput();
            } else {
                filterByCategory(e.target.value);
                if (categorySelectDesktop) {
                    categorySelectDesktop.value = e.target.value;
                }
            }
        });
    }
    
    if (categorySelectDesktop) {
        categorySelectDesktop.addEventListener('change', (e) => {
            filterByCategory(e.target.value);
            if (categorySelect) {
                categorySelect.value = e.target.value;
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchPosts(e.target.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.style.display = 'none';
                categorySelect.style.display = 'block';
                categorySelect.value = 'all';
                filterByCategory('all');
            }
        });

        let searchTimeout;
        searchInput.addEventListener('blur', () => {
            searchTimeout = setTimeout(() => {
                if (searchInput.value.trim() === '') {
                    searchInput.style.display = 'none';
                    categorySelect.style.display = 'block';
                    categorySelect.value = 'all';
                }
            }, 3000);
        });

        searchInput.addEventListener('focus', () => {
            clearTimeout(searchTimeout);
        });
    }

    const closeBtnMobile = document.getElementById('close-btn-mobile');
    if (closeBtnMobile) {
        closeBtnMobile.addEventListener('click', closeArticle);
    }

    const articleHeader = document.querySelector('.article-header');
    if (articleHeader && window.innerWidth > 768) {
        articleHeader.addEventListener('click', (e) => {
            if (e.target === articleHeader || e.target.tagName === 'DIV') {
                closeArticle();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeArticle();
        }
    });

    const closeBtnContainer = document.querySelector('.close-btn-container');
    if (closeBtnContainer) {
        closeBtnContainer.style.display = 'none';
    }

    console.log('✅ VOOF v3 inicializado com sucesso!');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ========================================
// ADMIN-V3.JS - FUNÇÕES DE ANALYTICS
// Adicione estas funções no seu admin-v2.js
// ========================================

// Carregar Analytics
async function loadAnalytics() {
    if (!isAdmin()) {
        alert('Apenas administradores podem ver analytics');
        return;
    }

    try {
        const period = document.getElementById('analytics-period').value;
        const category = document.getElementById('analytics-category').value;
        const sortBy = document.getElementById('analytics-sort').value;

        // Calcular data de início
        let dateFilter = '';
        if (period !== 'all') {
            const daysAgo = parseInt(period);
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            dateFilter = date.toISOString();
        }

        // Query base
        let query = supabaseClient
            .from('posts')
            .select('*')
            .eq('status', 'approved');

        // Filtrar por data
        if (dateFilter) {
            query = query.gte('published_at', dateFilter);
        }

        // Filtrar por categoria
        if (category !== 'all') {
            query = query.contains('categories', [category]);
        }

        // Ordenar
        switch (sortBy) {
            case 'views':
                query = query.order('view_count', { ascending: false });
                break;
            case 'likes':
                query = query.order('likes_count', { ascending: false });
                break;
            case 'shares':
                query = query.order('shares_count', { ascending: false });
                break;
            case 'reading_time':
                query = query.order('avg_reading_time', { ascending: false });
                break;
            case 'date':
                query = query.order('published_at', { ascending: false });
                break;
            default:
                query = query.order('view_count', { ascending: false });
        }

        const { data, error } = await query;

        if (error) throw error;

        renderAnalytics(data || []);
    } catch (error) {
        console.error('Erro ao carregar analytics:', error);
        alert('Erro ao carregar métricas: ' + error.message);
    }
}

// Renderizar Analytics
function renderAnalytics(posts) {
    // Calcular totais
    const totals = posts.reduce((acc, post) => {
        acc.views += post.view_count || 0;
        acc.likes += post.likes_count || 0;
        acc.shares += post.shares_count || 0;
        acc.reactions += (post.reaction_like || 0) + (post.reaction_love || 0) + 
                        (post.reaction_interesting || 0) + (post.reaction_wow || 0) + 
                        (post.reaction_sad || 0) + (post.reaction_angry || 0);
        acc.totalReadingTime += (post.avg_reading_time || 0) * (post.reading_sessions || 1);
        acc.sessions += post.reading_sessions || 0;
        return acc;
    }, { views: 0, likes: 0, shares: 0, reactions: 0, totalReadingTime: 0, sessions: 0 });

    const avgReadingTime = totals.sessions > 0 ? Math.floor(totals.totalReadingTime / totals.sessions) : 0;
    const engagementRate = totals.views > 0 ? 
        ((totals.likes + totals.reactions + totals.shares) / totals.views * 100).toFixed(2) : 0;

    // Atualizar cards de resumo
    document.getElementById('total-views').textContent = formatNumber(totals.views);
    document.getElementById('total-likes').textContent = formatNumber(totals.likes);
    document.getElementById('total-reactions').textContent = formatNumber(totals.reactions);
    document.getElementById('total-shares').textContent = formatNumber(totals.shares);
    document.getElementById('avg-reading-time').textContent = formatTime(avgReadingTime);
    document.getElementById('engagement-rate').textContent = engagementRate + '%';

    // Renderizar tabela
    const container = document.getElementById('analytics-table-container');
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p class="empty-state-text">Nenhum post encontrado com os filtros selecionados</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="analytics-table">
            <thead>
                <tr>
                    <th>Título</th>
                    <th>Categoria</th>
                    <th>👁️ Views</th>
                    <th>💚 Likes</th>
                    <th>🎭 Reações</th>
                    <th>🔗 Shares</th>
                    <th>⏱️ Tempo Médio</th>
                    <th>📈 Engajamento</th>
                    <th>📅 Data</th>
                </tr>
            </thead>
            <tbody>
                ${posts.map(post => {
                    const totalReactions = (post.reaction_like || 0) + (post.reaction_love || 0) + 
                                          (post.reaction_interesting || 0) + (post.reaction_wow || 0) + 
                                          (post.reaction_sad || 0) + (post.reaction_angry || 0);
                    
                    const engagement = post.view_count > 0 ? 
                        (((post.likes_count || 0) + totalReactions + (post.shares_count || 0)) / post.view_count * 100).toFixed(1) : 0;
                    
                    const categories = post.categories || [post.category];
                    
                    return `
                        <tr>
                            <td class="post-title-cell" title="${post.title}">${post.title}</td>
                            <td>${categories[0]}</td>
                            <td class="metric-cell">${formatNumber(post.view_count || 0)}</td>
                            <td class="metric-cell">${formatNumber(post.likes_count || 0)}</td>
                            <td>
                                <div class="reactions-breakdown">
                                    ${post.reaction_like ? `<span class="reaction-item">👍 ${post.reaction_like}</span>` : ''}
                                    ${post.reaction_love ? `<span class="reaction-item">❤️ ${post.reaction_love}</span>` : ''}
                                    ${post.reaction_interesting ? `<span class="reaction-item">💡 ${post.reaction_interesting}</span>` : ''}
                                    ${post.reaction_wow ? `<span class="reaction-item">😮 ${post.reaction_wow}</span>` : ''}
                                    ${post.reaction_sad ? `<span class="reaction-item">😢 ${post.reaction_sad}</span>` : ''}
                                    ${post.reaction_angry ? `<span class="reaction-item">😠 ${post.reaction_angry}</span>` : ''}
                                    ${totalReactions === 0 ? '-' : ''}
                                </div>
                            </td>
                            <td class="metric-cell">${formatNumber(post.shares_count || 0)}</td>
                            <td>${formatTime(post.avg_reading_time || 0)}</td>
                            <td class="metric-cell">${engagement}%</td>
                            <td>${formatDate(post.published_at || post.created_at)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Exportar para CSV
function exportAnalyticsCSV() {
    const period = document.getElementById('analytics-period').value;
    const category = document.getElementById('analytics-category').value;
    
    alert('Exportação CSV em desenvolvimento!\n\nEm breve você poderá exportar todas as métricas.');
    
    // TODO: Implementar exportação CSV real
    // const rows = posts.map(...)
    // const csv = rows.join('\n')
    // download(csv, 'voof-analytics.csv')
}

// Formatar número
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// Formatar tempo (segundos para min:seg)
function formatTime(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Expor funções globalmente
window.loadAnalytics = loadAnalytics;
window.exportAnalyticsCSV = exportAnalyticsCSV;

// ========================================
// MODIFICAR FUNÇÃO switchTab
// Adicione este case no switch da função existente
// ========================================

// Dentro da função switchTab(), adicione:
/*
case 'analytics':
    loadAnalytics();
    break;
*/

// ========================================
// ADICIONAR NO INIT
// Na função init(), após carregar permissões, adicione:
// ========================================

/*
// Mostrar tab analytics apenas para admin
const analyticsTab = document.getElementById('analytics-tab');
if (analyticsTab) {
    analyticsTab.style.display = isAdmin() ? 'block' : 'none';
}
*/


// FIM DO APP-V3.JS





