// Supabase Configuration
const SUPABASE_URL = 'https://1bvtpawkufemgikeepqb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IjFidnRwYXdrdWZlbWdpa2VlcHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MTAxMTAsImV4cCI6MjA1NDE4NjExMH0.ZyIGtnTXOsEilCJYrXQ1QjE3Nz42NQg2MTkzImV4cCI6MTcwMjgxNjIxfQ.eyJpc3M3NDE3NzdsdXBhYmFzZSI6MTcwMjgxNjIxfQ';

// Verificar se já existe uma instância
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
                    <p style="color: var(--text-secondary);">Configure o Supabase ou adicione posts para começar!</p>
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
                        <span>Arraste para ler mais</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    addSwipeListeners();
}

// Add swipe listeners
function addSwipeListeners() {
    const cards = document.querySelectorAll('.story-card');
    
    cards.forEach(card => {
        let touchStartX = 0;
        let touchEndX = 0;

        card.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        card.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe(card);
        });

        card.addEventListener('click', (e) => {
            if (window.innerWidth > 768) {
                openArticle(card.dataset.postId);
            }
        });

        function handleSwipe(element) {
            const swipeThreshold = 100;
            const diff = touchEndX - touchStartX;

            if (diff > swipeThreshold) {
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
    } catch (error) {
        console.error('Error opening article:', error);
    }
}

// Close article
function closeArticle() {
    const modal = document.getElementById('article-modal');
    modal.classList.remove('active');
    currentArticle = null;
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
            title: 'Bem-vindo ao VOOF!',
            short_description: 'O portal de notícias geek mais moderno do Brasil está no ar!',
            full_text: 'Configure o Supabase e comece a publicar suas notícias!\n\nAcesse voof.com.br/admin.html para gerenciar o conteúdo.',
            category: 'tecnologia',
            cover_image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
            gallery_images: ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=800'],
            author: 'VOOF Team',
            created_at: new Date().toISOString()
        }
    ];
    renderFeed();
}

// Category filter
function filterByCategory(category) {
    currentCategory = category;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (category === 'all') {
        document.querySelector('[data-filter="all"]').classList.add('active');
    }
    
    loadPosts(category);
}

// Initialize app
async function init() {
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 1500);

    await loadPosts();

    document.querySelector('.close-btn').addEventListener('click', closeArticle);
    
    document.getElementById('category-select').addEventListener('change', (e) => {
        filterByCategory(e.target.value);
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter;
            if (filter) {
                filterByCategory(filter);
                document.getElementById('category-select').value = filter;
            }
        });
    });

    const feedContainer = document.getElementById('feed-container');
    feedContainer.addEventListener('scroll', () => {
        document.querySelector('.scroll-indicator').style.display = 'none';
    }, { once: true });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeArticle();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
