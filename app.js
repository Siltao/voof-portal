// Supabase Configuration
// VOCÊ PRECISA SUBSTITUIR ESSAS CREDENCIAIS PELAS SUAS DO SUPABASE
const SUPABASE_URL = 'https://lbvtpawkufemglkaepqb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxidnRwYXdrdWZlbWdsa2FlcHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDg2MTksImV4cCI6MjA4NjIyNDYxOX0.knLhtuTd0DekAMFwlC3QjapFjEiXmcuuWG4AstzxoKQ';

let supabase;
let currentPosts = [];
let currentCategory = 'all';
let currentArticle = null;

// Initialize Supabase
function initSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase initialized');
    } catch (error) {
        console.error('Error initializing Supabase:', error);
    }
}

// Load posts from Supabase
async function loadPosts(category = 'all') {
    try {
        let query = supabase
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
        // Show demo content if Supabase is not configured
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

    // Add swipe listeners
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
            // Desktop click to open article
            if (window.innerWidth > 768) {
                openArticle(card.dataset.postId);
            }
        });

        function handleSwipe(element) {
            const swipeThreshold = 100;
            const diff = touchEndX - touchStartX;

            if (diff > swipeThreshold) {
                // Swipe right - open article
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

        // Build gallery HTML
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
    
    // Convert line breaks to paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    return paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
}

// Load demo content (for when Supabase is not configured)
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
            title: 'The Last of Us Parte 3 confirmado',
            short_description: 'Naughty Dog confirma desenvolvimento do terceiro capítulo da aclamada série.',
            full_text: 'Em entrevista exclusiva, Neil Druckmann confirmou que The Last of Us Parte 3 está em desenvolvimento. O diretor criativo prometeu uma história ainda mais impactante e emocionante.\n\n"Estamos trabalhando em algo especial que vai surpreender os fãs da franquia", declarou Druckmann. O jogo deve ser lançado exclusivamente para PlayStation 5.',
            category: 'playstation',
            cover_image: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800',
            gallery_images: [
                'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800'
            ],
            author: 'Pedro Costa',
            created_at: new Date(Date.now() - 172800000).toISOString()
        },
        {
            id: 'demo-4',
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
        },
        {
            id: 'demo-5',
            title: 'Stranger Things: Última temporada ganha trailer',
            short_description: 'Netflix divulga trailer épico da temporada final da série que conquistou o mundo.',
            full_text: 'A Netflix finalmente revelou o primeiro trailer da quinta e última temporada de Stranger Things. O vídeo promete uma conclusão épica para a história de Eleven e seus amigos.\n\nA temporada final será dividida em duas partes, com a primeira chegando em julho de 2026. Os fãs podem esperar batalhas épicas contra o Mundo Invertido e revelações surpreendentes sobre o passado de Hawkins.',
            category: 'series',
            cover_image: 'https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=800',
            gallery_images: [
                'https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=800'
            ],
            author: 'Lucas Ferreira',
            created_at: new Date(Date.now() - 345600000).toISOString()
        }
    ];
    
    renderFeed();
}

// Category filter
function filterByCategory(category) {
    currentCategory = category;
    
    // Update active button
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
    // Hide loading screen after a delay
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 1500);

    // Initialize Supabase
    initSupabase();

    // Load initial posts
    await loadPosts();

    // Event listeners
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

    // Hide scroll indicator after first scroll
    const feedContainer = document.getElementById('feed-container');
    feedContainer.addEventListener('scroll', () => {
        document.querySelector('.scroll-indicator').style.display = 'none';
    }, { once: true });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeArticle();
        }
    });
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
