// Supabase Configuration
const SUPABASE_URL = 'https://1bvtpawkufemgikeepqb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxidnRwYXdrdWZlbWdsa2FlcHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDg2MTksImV4cCI6MjA4NjIyNDYxOX0.knLhtuTd0DekAMFwlC3QjapFjEiXmcuuWG4AstzxoKQ';

if (typeof window.voofSupabase === 'undefined') {
    window.voofSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const supabaseClient = window.voofSupabase;
let currentPosts = [];
let currentCategory = 'all';
let currentArticle = null;

// Load posts from Supabase
async function loadPosts(category = 'all') {
    try {
        let query = supabaseClient
            .from('posts')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (category !== 'all') {
            query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) throw error;

        currentPosts = data || [];
        renderFeed();
    } catch (error) {
        console.error('Error loading posts:', error);
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

    feedContainer.innerHTML = currentPosts.map((post, index) => `
        <div class="story-card" data-post-id="${post.id}" data-index="${index}">
            <img src="${post.cover_image || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800'}" 
                 alt="${post.title}" 
                 class="story-image">
            <div class="story-overlay"></div>
            <div class="story-content">
                <div class="story-header">
                    <span class="category-badge">${post.category}</span>
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
    `).join('');

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

        // Touch events for mobile
        card.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        });

        card.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe(card);
        });

        // Click event for both mobile and desktop
        card.addEventListener('click', (e) => {
            // Only open if not scrolling
            if (Math.abs(touchEndX - touchStartX) < 10 && Math.abs(touchEndY - touchStartY) < 10) {
                openArticle(card.dataset.postId);
            }
        });

        function handleSwipe(element) {
            const swipeThresholdX = 50;
            const swipeThresholdY = 50;
            const diffX = Math.abs(touchEndX - touchStartX);
            const diffY = Math.abs(touchEndY - touchStartY);

            // Se swipe em qualquer direção (exceto scroll vertical normal)
            if (diffX > swipeThresholdX || diffY > swipeThresholdY) {
                // Não abrir se for scroll vertical para baixo ou para cima
                if (diffY > diffX) {
                    // É um scroll vertical, não abrir
                    return;
                }
                // Swipe horizontal - abrir artigo
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

        currentArticle = post;
        const modal = document.getElementById('article-modal');
        const content = document.getElementById('article-content');

        let galleryHTML = '';
        if (post.gallery_images && post.gallery_images.length > 0) {
            galleryHTML = `
                <div class="article-gallery">
                    ${post.gallery_images.map(img => `
                        <img src="${img}" alt="Gallery image" class="gallery-image">
                    `).join('')}
                </div>
            `;
        } else {
            galleryHTML = `
                <div class="article-gallery">
                    <img src="${post.cover_image}" alt="${post.title}" class="gallery-image">
                </div>
            `;
        }

        content.innerHTML = `
            ${galleryHTML}
            <div class="article-body">
                <h1 class="article-title">${post.title}</h1>
                <div class="article-info">
                    <span class="info-item"><strong>Categoria:</strong> ${post.category}</span>
                    <span class="info-item"><strong>Autor:</strong> ${post.author || 'VOOF Team'}</span>
                    <span class="info-item"><strong>Data:</strong> ${formatDate(post.created_at)}</span>
                </div>
                <div class="article-text">
                    ${formatArticleText(post.full_text)}
                </div>
            </div>
        `;

        modal.classList.add('active');
        
        // Show close button for mobile
        const closeBtnContainer = document.querySelector('.close-btn-container');
        if (closeBtnContainer) {
            closeBtnContainer.style.display = 'block';
        }
    } catch (error) {
        console.error('Error opening article:', error);
    }
}

// Close article
function closeArticle() {
    const modal = document.getElementById('article-modal');
    modal.classList.remove('active');
    currentArticle = null;
    
    // Hide close button
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
    currentPosts = [
        {
            id: 'demo-1',
            title: 'Novo God of War anunciado para 2026',
            short_description: 'Santa Monica Studios surpreende fãs com trailer épico do próximo capítulo da saga de Kratos.',
            full_text: 'A Sony anunciou oficialmente o próximo jogo da franquia God of War durante o evento State of Play. O novo título promete expandir a mitologia nórdica com novos reinos e desafios.\n\nO trailer de revelação mostrou Kratos e Atreus em uma jornada ainda mais épica, enfrentando deuses nunca antes vistos na franquia. A previsão de lançamento é para o final de 2026.',
            category: 'playstation',
            cover_image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800',
            gallery_images: [
                'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800',
                'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800'
            ],
            author: 'João Silva',
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-2',
            title: 'Xbox anuncia nova geração de controles',
            short_description: 'Microsoft revela controles com feedback háptico avançado e bateria de 40 horas.',
            full_text: 'A Microsoft anunciou uma nova linha de controles Xbox com tecnologia de ponta. Os novos controles contam com feedback háptico adaptativo, gatilhos com resistência variável e uma bateria que promete até 40 horas de uso contínuo.\n\nOs controles estarão disponíveis em diversas cores e edições especiais, chegando ao mercado brasileiro no segundo trimestre de 2026.',
            category: 'xbox',
            cover_image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800',
            gallery_images: [
                'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800'
            ],
            author: 'Maria Santos',
            created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
            id: 'demo-3',
            title: 'Nintendo Switch 2 tem data de revelação',
            short_description: 'Vazamento indica que Nintendo pode revelar novo console em março de 2026.',
            full_text: 'Fontes próximas à Nintendo indicam que a empresa planeja revelar o sucessor do Switch durante um evento especial em março. O novo console promete gráficos em 4K no modo dock e retrocompatibilidade com jogos do Switch original.\n\nEspecula-se que o console chegue ao mercado no segundo semestre de 2026 com um lineup forte de jogos first-party.',
            category: 'nintendo',
            cover_image: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800',
            gallery_images: [
                'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800'
            ],
            author: 'Ana Oliveira',
            created_at: new Date(Date.now() - 259200000).toISOString()
        }
    ];
    
    renderFeed();
}

// Category filter
function filterByCategory(category) {
    currentCategory = category;
    loadPosts(category);
}

// Initialize app
async function init() {
    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 1500);

    // Load initial posts
    await loadPosts();

    // Event listeners
    const categorySelect = document.getElementById('category-select');
    const categorySelectDesktop = document.getElementById('category-select-desktop');
    
    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            filterByCategory(e.target.value);
            if (categorySelectDesktop) {
                categorySelectDesktop.value = e.target.value;
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

    // Close button mobile
    const closeBtnMobile = document.getElementById('close-btn-mobile');
    if (closeBtnMobile) {
        closeBtnMobile.addEventListener('click', closeArticle);
    }

    // Close on desktop header click
    const articleHeader = document.querySelector('.article-header');
    if (articleHeader && window.innerWidth > 768) {
        articleHeader.addEventListener('click', (e) => {
            if (e.target === articleHeader || e.target.tagName === 'DIV') {
                closeArticle();
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeArticle();
        }
    });

    // Initially hide close button
    const closeBtnContainer = document.querySelector('.close-btn-container');
    if (closeBtnContainer) {
        closeBtnContainer.style.display = 'none';
    }
}

// Start app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
