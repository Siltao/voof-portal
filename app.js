// Supabase Configuration
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

// Detectar tipo de mídia
function getMediaType(url) {
    if (!url) return 'image';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('vimeo.com')) return 'vimeo';
    if (url.match(/\.(mp4|webm|ogg|mov)$/i)) return 'video';
    return 'image';
}

// Extrair ID do YouTube
function getYouTubeID(url) {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
}

// Extrair ID do Vimeo
function getVimeoID(url) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
}

// Registrar visualização
async function trackView(postId) {
    try {
        await supabaseClient.rpc('increment_post_views', { post_uuid: postId });
        console.log('📊 Visualização registrada:', postId);
    } catch (error) {
        console.log('Analytics error:', error);
    }
}

// Toggle mute
function toggleMute(event, postId) {
    event.stopPropagation();
    const video = document.querySelector(`video[data-post-id="${postId}"]`);
    const btn = event.target;
    
    if (video) {
        video.muted = !video.muted;
        btn.textContent = video.muted ? '🔇' : '🔊';
    }
}

window.toggleMute = toggleMute;

// Load posts from Supabase
async function loadPosts(category = 'all') {
    try {
        console.log('🔄 Carregando posts do Supabase...', category);

        let query = supabaseClient
            .from('posts')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (category !== 'all') {
            // Suporta tanto categories (array) quanto category (string)
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

// Render feed
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
        
        return `
        <div class="story-card" data-post-id="${post.id}" data-index="${index}">
            ${isVideo ? `
                <video 
                    class="story-video" 
                    src="${post.video_url}" 
                    playsinline 
                    autoplay 
                    muted 
                    loop
                    data-post-id="${post.id}">
                </video>
                <button class="mute-btn" onclick="toggleMute(event, '${post.id}')">🔇</button>
            ` : `
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
}

// Add swipe and click listeners
function addSwipeListeners() {
    const cards = document.querySelectorAll('.story-card');
    
    cards.forEach(card => {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;

        card.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        });

        card.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe(card);
        });

        card.addEventListener('click', (e) => {
            if (Math.abs(touchEndX - touchStartX) < 10 && Math.abs(touchEndY - touchStartY) < 10) {
                openArticle(card.dataset.postId);
            }
        });

        function handleSwipe(element) {
            const swipeThresholdX = 50;
            const swipeThresholdY = 50;
            const diffX = Math.abs(touchEndX - touchStartX);
            const diffY = Math.abs(touchEndY - touchStartY);

            if (diffX > swipeThresholdX || diffY > swipeThresholdY) {
                if (diffY > diffX) {
                    return;
                }
                openArticle(element.dataset.postId);
            }
        }
    });
}

// Open article
async function openArticle(postId) {
    try {
        const post = currentPosts.find(p => p.id === postId);
        if (!post) return;

        // Rastrear visualização
        trackView(postId);

        currentArticle = post;
        const modal = document.getElementById('article-modal');
        const content = document.getElementById('article-content');

        let galleryHTML = '';
        if (post.post_type === 'video') {
            galleryHTML = `
                <div class="article-gallery">
                    <video 
                        class="gallery-video" 
                        src="${post.video_url}" 
                        controls
                        playsinline>
                    </video>
                </div>
            `;
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
            </div>
        `;

        modal.classList.add('active');
        
        const closeBtnContainer = document.querySelector('.close-btn-container');
        if (closeBtnContainer) {
            closeBtnContainer.style.display = 'block';
        }

        // Adicionar swipe lateral para fechar
        let articleTouchStartX = 0;
        let articleTouchEndX = 0;

        const swipeHandler = (e) => {
            if (e.type === 'touchstart') {
                articleTouchStartX = e.changedTouches[0].screenX;
            } else if (e.type === 'touchend') {
                articleTouchEndX = e.changedTouches[0].screenX;
                const diff = articleTouchEndX - articleTouchStartX;
                
                if (Math.abs(diff) > 100) {
                    closeArticle();
                    modal.removeEventListener('touchstart', swipeHandler);
                    modal.removeEventListener('touchend', swipeHandler);
                }
            }
        };

        modal.addEventListener('touchstart', swipeHandler);
        modal.addEventListener('touchend', swipeHandler);

    } catch (error) {
        console.error('Error opening article:', error);
    }
}

// Close article
function closeArticle() {
    const modal = document.getElementById('article-modal');
    modal.classList.remove('active');
    currentArticle = null;
    
    const closeBtnContainer = document.querySelector('.close-btn-container');
    if (closeBtnContainer) {
        closeBtnContainer.style.display = 'none';
    }
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
            title: 'Bem-vindo ao VOOF v2!',
            short_description: 'Agora com suporte a vídeos, múltiplas categorias e analytics!',
            full_text: 'O VOOF foi atualizado para v2!\n\nNovidades:\n- Posts em vídeo\n- Múltiplas categorias por post\n- Sistema de analytics\n- Swipe lateral para fechar\n\nCrie posts no admin.html para ver tudo funcionando!',
            category: 'tecnologia',
            categories: ['tecnologia', 'ia'],
            post_type: 'text',
            cover_image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
            gallery_images: ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=800'],
            author: 'VOOF Team',
            created_at: new Date().toISOString(),
            view_count: 0
        }
    ];
    
    allPosts = currentPosts;
    renderFeed();
}

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
    console.log('🚀 Inicializando VOOF v2...');
    
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

    console.log('✅ VOOF v2 inicializado com sucesso!');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
